// Standalone test harness for the relay FSM.
// No network calls, no Firebase, no ConnectLife. Pure unit test of the state
// machine logic. Run with:
//
//   cd connectlife-poller
//   node test/fsm.test.js
//
// Exits 0 if all scenarios pass, 1 on any failure.

import { decide, handleStartCommand, handleForceStop, RelayState } from '../src/relay-controller.js';

const SCENARIOS = [];
function scenario(name, fn) { SCENARIOS.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(`assertion failed: ${msg}`); }

// Helpers to build washer status objects
const washer = (state, extras = {}) => ({
  state,
  is_running: ['running', 'spinning', 'rinse_hold'].includes(state),
  is_finished: state === 'finished',
  remain_minutes: extras.remain ?? null,
  program: extras.program ?? null,
});

const CFG = { relay_on_duration: 300, post_wash_delay: 300 };
const CFG_FAST = { relay_on_duration: 60, post_wash_delay: 30 }; // for timeout tests

// --- Scenario 1: happy path full cycle ---
scenario('happy path: idle → armed → washing → cooldown → idle', () => {
  let now = 1_000_000;
  let state = { phase: RelayState.IDLE, session_started_at: 0, finished_at: 0 };

  // User starts session
  const start = handleStartCommand(state, now);
  assert(start.accepted, 'start should be accepted from idle');
  assert(start.fsm.phase === RelayState.ARMED, 'should transition to armed');
  state = start.fsm;

  // 30s later, still waiting for user to press Start — machine is standby
  now += 30_000;
  let d = decide({ currentRelayState: state, washer: washer('standby'), adminConfig: CFG, now });
  assert(d.fsm.phase === RelayState.ARMED, 'stay armed while waiting');
  assert(d.relay_on === true, 'relay on while armed');
  state = d.fsm;

  // 10s later, user presses Start → washer reports running
  now += 10_000;
  d = decide({ currentRelayState: state, washer: washer('running', { remain: 45 }), adminConfig: CFG, now });
  assert(d.fsm.phase === RelayState.WASHING, 'transition to washing');
  assert(d.relay_on === true, 'relay on during wash');
  state = d.fsm;

  // 30 min later, spinning
  now += 30 * 60_000;
  d = decide({ currentRelayState: state, washer: washer('spinning', { remain: 5 }), adminConfig: CFG, now });
  assert(d.fsm.phase === RelayState.WASHING, 'still washing during spin');
  state = d.fsm;

  // Wash done
  now += 5 * 60_000;
  d = decide({ currentRelayState: state, washer: washer('finished'), adminConfig: CFG, now });
  assert(d.fsm.phase === RelayState.FINISHED_COOLDOWN, 'transition to cooldown');
  assert(d.relay_on === true, 'relay still on during cooldown');
  state = d.fsm;
  const finishedAt = state.finished_at;
  assert(finishedAt > 0, 'finished_at set');

  // 2 min into cooldown — still on
  now += 2 * 60_000;
  d = decide({ currentRelayState: state, washer: washer('finished'), adminConfig: CFG, now });
  assert(d.fsm.phase === RelayState.FINISHED_COOLDOWN, 'still cooling down');
  assert(d.relay_on === true, 'relay still on mid-cooldown');
  state = d.fsm;

  // 5 min total into cooldown — time's up
  now += 3 * 60_000 + 1000;
  d = decide({ currentRelayState: state, washer: washer('finished'), adminConfig: CFG, now });
  assert(d.fsm.phase === RelayState.IDLE, 'back to idle');
  assert(d.relay_on === false, 'relay off after cooldown');
});

// --- Scenario 2: armed timeout (user never presses Start) ---
scenario('armed timeout: user never starts wash, power cuts after relay_on_duration', () => {
  let now = 2_000_000;
  let state = handleStartCommand({ phase: RelayState.IDLE }, now).fsm;

  // 30 seconds in — still armed
  now += 30_000;
  let d = decide({ currentRelayState: state, washer: washer('standby'), adminConfig: CFG_FAST, now });
  assert(d.fsm.phase === RelayState.ARMED, 'still armed under timeout');
  state = d.fsm;

  // 61s since session start — past 60s timeout
  now += 31_000;
  d = decide({ currentRelayState: state, washer: washer('standby'), adminConfig: CFG_FAST, now });
  assert(d.fsm.phase === RelayState.IDLE, 'timed out back to idle');
  assert(d.relay_on === false, 'relay off after timeout');
  assert(d.reason === 'armed_timeout', 'correct reason');
});

// --- Scenario 3: force stop mid-wash ---
scenario('force stop interrupts a running wash', () => {
  const now = 3_000_000;
  const d = handleForceStop(now);
  assert(d.fsm.phase === RelayState.IDLE, 'force_stop returns to idle');
  assert(d.fsm.session_started_at === 0, 'session cleared');
  assert(d.reason === 'force_stop', 'correct reason');
});

// --- Scenario 4: cannot start while already armed ---
scenario('reject start command when not idle', () => {
  const now = 4_000_000;
  const armed = { phase: RelayState.ARMED, session_started_at: now - 10_000, finished_at: 0 };
  const result = handleStartCommand(armed, now);
  assert(!result.accepted, 'start should be rejected');
  assert(result.reason === 'cannot_start_from_armed', 'correct reason');
});

// --- Scenario 5: unknown/garbage state fails safely to idle + off ---
scenario('unknown FSM state fails safe to idle + relay off', () => {
  const d = decide({
    currentRelayState: { phase: 'gibberish', session_started_at: 0, finished_at: 0 },
    washer: washer('standby'),
    adminConfig: CFG,
    now: 5_000_000,
  });
  assert(d.fsm.phase === RelayState.IDLE, 'reset to idle');
  assert(d.relay_on === false, 'relay off on unknown state');
});

// --- Scenario 6: wash pauses and resumes (paused state stays in washing phase) ---
scenario('paused mid-wash keeps relay on', () => {
  let now = 6_000_000;
  let state = { phase: RelayState.WASHING, session_started_at: now - 5 * 60_000, finished_at: 0 };

  let d = decide({ currentRelayState: state, washer: washer('paused'), adminConfig: CFG, now });
  assert(d.fsm.phase === RelayState.WASHING, 'stay in washing when paused');
  assert(d.relay_on === true, 'relay on when paused');
  state = d.fsm;

  // Resumes
  now += 2 * 60_000;
  d = decide({ currentRelayState: state, washer: washer('running'), adminConfig: CFG, now });
  assert(d.fsm.phase === RelayState.WASHING, 'still washing after resume');
  assert(d.relay_on === true, 'relay on after resume');
});

// --- Scenario 7: machine reports finished immediately when armed (residual state) ---
scenario('armed + finished within 30s is ignored (residual state from previous cycle)', () => {
  const now = 7_000_000;
  const state = { phase: RelayState.ARMED, session_started_at: now - 5_000, finished_at: 0 };
  const d = decide({ currentRelayState: state, washer: washer('finished'), adminConfig: CFG, now });
  // Within 30s of arming, we ignore "finished" because it's stale from last cycle
  assert(d.fsm.phase === RelayState.ARMED, 'ignore stale finished within 30s of arming');
});

// --- Scenario 8: armed + finished after 30s IS treated as a valid cycle completion ---
scenario('armed + finished after 30s enters cooldown', () => {
  const now = 8_000_000;
  const state = { phase: RelayState.ARMED, session_started_at: now - 45_000, finished_at: 0 };
  const d = decide({ currentRelayState: state, washer: washer('finished'), adminConfig: CFG, now });
  assert(d.fsm.phase === RelayState.FINISHED_COOLDOWN, 'accept finished after 30s threshold');
});

// --- Scenario 9: custom admin config values are respected ---
scenario('admin config changes affect timing', () => {
  const now = 9_000_000;
  const state = { phase: RelayState.FINISHED_COOLDOWN, session_started_at: now - 60 * 60_000, finished_at: now - 30_000 };

  // 30s into cooldown with 60s post_wash_delay — still on
  let d = decide({ currentRelayState: state, washer: washer('finished'), adminConfig: { post_wash_delay: 60, relay_on_duration: 300 }, now });
  assert(d.relay_on === true, 'still cooling with 60s delay');

  // Same state, but config says only 20s — should be done
  d = decide({ currentRelayState: state, washer: washer('finished'), adminConfig: { post_wash_delay: 20, relay_on_duration: 300 }, now });
  assert(d.fsm.phase === RelayState.IDLE, 'cooldown ended with shorter config');
  assert(d.relay_on === false, 'relay off after shortened cooldown');
});

// --- Run ---
let passed = 0, failed = 0;
for (const { name, fn } of SCENARIOS) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    → ${err.message}`);
    failed++;
  }
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
