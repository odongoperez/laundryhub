// LaundryHub ConnectLife poller — main loop.
//
// Runs on Oracle Cloud Always Free VM as a systemd service. Polls ConnectLife
// every POLL_INTERVAL_MS, parses the WF3S8043BB3 appliance, runs the relay
// FSM, writes everything to Firebase.
//
// Env vars (read from /etc/laundryhub/env by systemd):
//   CONNECTLIFE_USERNAME
//   CONNECTLIFE_PASSWORD
//   FIREBASE_DATABASE_URL
//   FIREBASE_SERVICE_ACCOUNT_JSON   (raw JSON string)
//   WASHER_PUID                     (filter: 1wfj0800029vw53t3pf0186)
//   POLL_INTERVAL_MS                (default 10000)

import { ConnectLifeClient } from './connectlife.js';
import { parseWasher } from './washer-parser.js';
import { FirebaseWriter } from './firebase-writer.js';
import { decide, handleStartCommand, handleForceStop, RelayState } from './relay-controller.js';

const log = {
  info:  (...a) => console.log(new Date().toISOString(), 'INFO', ...a),
  warn:  (...a) => console.warn(new Date().toISOString(), 'WARN', ...a),
  error: (...a) => console.error(new Date().toISOString(), 'ERROR', ...a),
};

function requireEnv(name) {
  const v = process.env[name];
  if (!v) { log.error(`Missing env var ${name}`); process.exit(1); }
  return v;
}

const CONNECTLIFE_USERNAME = requireEnv('CONNECTLIFE_USERNAME');
const CONNECTLIFE_PASSWORD = requireEnv('CONNECTLIFE_PASSWORD');
const FIREBASE_DATABASE_URL = requireEnv('FIREBASE_DATABASE_URL');
const FIREBASE_SERVICE_ACCOUNT_JSON = requireEnv('FIREBASE_SERVICE_ACCOUNT_JSON');
const WASHER_PUID = process.env.WASHER_PUID || '1wfj0800029vw53t3pf0186';
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 10000);

const DEFAULT_ADMIN_CONFIG = {
  relay_on_duration: 300,   // seconds — max time to wait for user to press physical Start
  post_wash_delay: 300,     // seconds — wait after "finished" before cutting power
};

const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);

const client = new ConnectLifeClient({
  username: CONNECTLIFE_USERNAME,
  password: CONNECTLIFE_PASSWORD,
  logger: log,
});

const firebase = new FirebaseWriter({
  databaseURL: FIREBASE_DATABASE_URL,
  serviceAccount,
  logger: log,
});

let consecutiveFailures = 0;
let lastSuccessfulPoll = 0;

async function handlePendingCommands(currentRelayState) {
  const now = Date.now();

  const start = await firebase.readAndClearCommand('start_session');
  if (start) {
    const result = handleStartCommand(currentRelayState, now);
    if (result.accepted) {
      await firebase.writeRelayState(result.fsm);
      await firebase.appendEvent({ type: 'session_start', user: start.user || 'unknown' });
      log.info(`session armed by ${start.user || 'unknown'}`);
      return result.fsm;
    } else {
      await firebase.appendEvent({ type: 'session_start_rejected', reason: result.reason, user: start.user });
      log.warn(`start rejected: ${result.reason}`);
    }
  }

  const stop = await firebase.readAndClearCommand('force_stop');
  if (stop) {
    const result = handleForceStop(now);
    await firebase.writeRelayState(result.fsm);
    await firebase.appendEvent({ type: 'force_stop', user: stop.user || 'unknown' });
    log.info(`force stopped by ${stop.user || 'unknown'}`);
    return result.fsm;
  }

  return currentRelayState;
}

async function pollOnce() {
  const started = Date.now();
  try {
    // 1. Fetch current FSM + admin config from Firebase (they're tiny)
    const [currentRelayState, adminConfig] = await Promise.all([
      firebase.readRelayState(),
      firebase.readAdminConfig(),
    ]);

    // 2. Apply any pending commands from the web app (start / force_stop)
    const stateAfterCommands = await handlePendingCommands(currentRelayState || { phase: RelayState.IDLE });

    // 3. Poll ConnectLife
    const appliances = await client.getAppliances();
    const rawList = Array.isArray(appliances) ? appliances : (appliances.appliances || []);
    const target = rawList.find(a => {
      const id = a.puid || a.deviceId || a.wifiId || '';
      return String(id).toLowerCase() === WASHER_PUID.toLowerCase();
    }) || rawList[0];

    if (!target) throw new Error('No appliance found on ConnectLife account');
    const washer = parseWasher(target);

    // 4. Run FSM to decide relay state
    const effectiveConfig = { ...DEFAULT_ADMIN_CONFIG, ...adminConfig };
    const decision = decide({
      currentRelayState: stateAfterCommands,
      washer,
      adminConfig: effectiveConfig,
      now: Date.now(),
    });

    // 5. Write everything back to Firebase in parallel
    await Promise.all([
      firebase.writeStatus(washer),
      firebase.writeRelayCommand({
        relay_on: decision.relay_on,
        reason: decision.reason,
        updated_at: Date.now(),
      }),
      firebase.writeRelayState(decision.fsm),
    ]);

    // 6. Log state transition if it changed
    if ((stateAfterCommands?.phase || RelayState.IDLE) !== decision.fsm.phase) {
      log.info(`FSM ${stateAfterCommands?.phase || 'idle'} -> ${decision.fsm.phase} (${decision.reason})`);
      await firebase.appendEvent({
        type: 'fsm_transition',
        from: stateAfterCommands?.phase || 'idle',
        to: decision.fsm.phase,
        reason: decision.reason,
        washer_state: washer.state,
      });
    }

    lastSuccessfulPoll = Date.now();
    consecutiveFailures = 0;

    const elapsed = Date.now() - started;
    log.info(
      `poll ok ${elapsed}ms | ${washer.state}` +
      (washer.program ? ` / ${washer.program}` : '') +
      (washer.remain_minutes != null ? ` / ${washer.remain_minutes}min` : '') +
      ` | fsm=${decision.fsm.phase} relay=${decision.relay_on ? 'ON' : 'off'}`
    );

    await firebase.writeHealth({
      ok: true,
      last_poll_at: lastSuccessfulPoll,
      poll_duration_ms: elapsed,
      consecutive_failures: 0,
    });
  } catch (err) {
    consecutiveFailures += 1;
    log.error(`poll failed (#${consecutiveFailures}):`, err.message);
    try {
      await firebase.writeHealth({
        ok: false,
        last_error: err.message,
        last_error_at: Date.now(),
        last_poll_at: lastSuccessfulPoll,
        consecutive_failures: consecutiveFailures,
      });
    } catch (fbErr) {
      log.error('firebase health write failed:', fbErr.message);
    }

    // If we've been failing for > 10 minutes, conservatively cut power.
    // The machine's own electronics preserve state across power cuts, so this
    // is annoying but safe. Don't do this if we've never succeeded (startup
    // misconfiguration would strand users).
    if (consecutiveFailures > 60 && lastSuccessfulPoll > 0) {
      log.warn('extended failure — cutting relay for safety');
      try {
        await firebase.writeRelayCommand({
          relay_on: false,
          reason: 'safety_cutoff_extended_api_failure',
          updated_at: Date.now(),
        });
        await firebase.writeRelayState({ phase: RelayState.IDLE, session_started_at: 0, finished_at: 0, updated_at: Date.now() });
      } catch { /* ignore */ }
    }
  }
}

async function main() {
  log.info(`starting poller puid=${WASHER_PUID} interval=${POLL_INTERVAL_MS}ms`);
  // Run immediately, then on interval
  await pollOnce();
  setInterval(pollOnce, POLL_INTERVAL_MS);
}

process.on('SIGTERM', () => { log.info('SIGTERM received, exiting'); process.exit(0); });
process.on('SIGINT',  () => { log.info('SIGINT received, exiting'); process.exit(0); });
process.on('unhandledRejection', (r) => log.error('unhandledRejection:', r));

main().catch(err => { log.error('fatal:', err); process.exit(1); });
