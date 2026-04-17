// Relay controller — decides whether the ESP32 relay should be ON or OFF and
// writes the decision to /relay_command in Firebase. The ESP32 reads that path
// and drives GPIO 26 (active-low).
//
// State machine:
//
//   IDLE ─(user presses "Start" in app, triggers session_start)→ SESSION_ACTIVE
//     SESSION_ACTIVE: relay ON for `relay_on_duration` seconds
//                     (lets user press start on the physical machine, which then
//                      starts drawing power on its own during the wash)
//     SESSION_ACTIVE ─(timer expires, machine NOT finished)→ WASH_IN_PROGRESS
//                     relay goes OFF but the machine continues because washers
//                     keep their own latching power — wait, that's not how
//                     this works. See note below.
//
// CORRECTION — how this actually works for LaundryHub:
// The relay is a HARD power cutoff. If the relay opens mid-wash, the machine
// stops. So the rule is: once a session starts, keep the relay CLOSED (ON)
// continuously from session start through `wash finished + post_wash_delay`.
// The `relay_on_duration` is just a SAFETY FALLBACK: if ConnectLife never
// reports the wash starting (user didn't press Start, or ConnectLife went
// offline), cut power after that timeout to avoid standby drain.
//
// So the real FSM is:
//
//   IDLE
//     ├─ user starts session → go to ARMED
//   ARMED (relay ON, waiting for user to press physical Start)
//     ├─ ConnectLife state becomes running/spinning → WASHING
//     └─ relay_on_duration elapsed, still not running → TIMEOUT_OFF → IDLE
//   WASHING (relay ON, wash in progress)
//     └─ ConnectLife state becomes "finished" → FINISHED_COOLDOWN
//   FINISHED_COOLDOWN (relay ON, waiting post_wash_delay)
//     └─ post_wash_delay elapsed → POWERING_DOWN → IDLE
//
// State lives in Firebase at /relay_state so it survives poller restarts.

export const RelayState = Object.freeze({
  IDLE: 'idle',
  ARMED: 'armed',
  WASHING: 'washing',
  FINISHED_COOLDOWN: 'finished_cooldown',
});

/**
 * @param {object} ctx
 * @param {object} ctx.currentRelayState - from Firebase /relay_state
 * @param {object} ctx.washer            - parsed washer status from this poll
 * @param {object} ctx.adminConfig       - { relay_on_duration, post_wash_delay } in seconds
 * @param {number} ctx.now               - Date.now()
 * @returns {{ fsm: object, relay_on: boolean, reason: string }}
 */
export function decide(ctx) {
  const { currentRelayState, washer, adminConfig, now } = ctx;
  const relayOnDurationMs = (adminConfig.relay_on_duration ?? 300) * 1000;
  const postWashDelayMs  = (adminConfig.post_wash_delay  ?? 300) * 1000;

  const state = currentRelayState?.phase || RelayState.IDLE;
  const sessionStartedAt = currentRelayState?.session_started_at || 0;
  const finishedAt       = currentRelayState?.finished_at || 0;

  // --- IDLE: nothing happening ---
  if (state === RelayState.IDLE) {
    return {
      fsm: { phase: RelayState.IDLE, session_started_at: 0, finished_at: 0, updated_at: now },
      relay_on: false,
      reason: 'idle',
    };
  }

  // --- ARMED: relay on, waiting for user to press Start on the machine ---
  if (state === RelayState.ARMED) {
    // Machine started washing → move to WASHING
    if (washer.is_running) {
      return {
        fsm: { phase: RelayState.WASHING, session_started_at: sessionStartedAt, finished_at: 0, updated_at: now },
        relay_on: true,
        reason: 'washing_started',
      };
    }
    // Machine reports finished while ARMED — rare, but handle it (previous wash end-state lingering)
    if (washer.is_finished && sessionStartedAt > 0 && now - sessionStartedAt > 30_000) {
      return {
        fsm: { phase: RelayState.FINISHED_COOLDOWN, session_started_at: sessionStartedAt, finished_at: now, updated_at: now },
        relay_on: true,
        reason: 'finished_detected_while_armed',
      };
    }
    // Session timed out before user pressed Start → power down
    if (now - sessionStartedAt > relayOnDurationMs) {
      return {
        fsm: { phase: RelayState.IDLE, session_started_at: 0, finished_at: 0, updated_at: now },
        relay_on: false,
        reason: 'armed_timeout',
      };
    }
    // Still waiting
    return {
      fsm: { phase: RelayState.ARMED, session_started_at: sessionStartedAt, finished_at: 0, updated_at: now },
      relay_on: true,
      reason: `armed_waiting_${Math.round((relayOnDurationMs - (now - sessionStartedAt)) / 1000)}s`,
    };
  }

  // --- WASHING: relay on, wash in progress ---
  if (state === RelayState.WASHING) {
    if (washer.is_finished) {
      return {
        fsm: { phase: RelayState.FINISHED_COOLDOWN, session_started_at: sessionStartedAt, finished_at: now, updated_at: now },
        relay_on: true,
        reason: 'wash_finished_start_cooldown',
      };
    }
    return {
      fsm: { phase: RelayState.WASHING, session_started_at: sessionStartedAt, finished_at: 0, updated_at: now },
      relay_on: true,
      reason: `washing_${washer.state}_${washer.remain_minutes ?? '?'}min`,
    };
  }

  // --- FINISHED_COOLDOWN: relay on, waiting post_wash_delay before cutoff ---
  if (state === RelayState.FINISHED_COOLDOWN) {
    if (now - finishedAt >= postWashDelayMs) {
      return {
        fsm: { phase: RelayState.IDLE, session_started_at: 0, finished_at: 0, updated_at: now },
        relay_on: false,
        reason: 'cooldown_complete_power_off',
      };
    }
    return {
      fsm: { phase: RelayState.FINISHED_COOLDOWN, session_started_at: sessionStartedAt, finished_at: finishedAt, updated_at: now },
      relay_on: true,
      reason: `cooldown_${Math.round((postWashDelayMs - (now - finishedAt)) / 1000)}s_remaining`,
    };
  }

  // Unknown state → fail safe to IDLE/off
  return {
    fsm: { phase: RelayState.IDLE, session_started_at: 0, finished_at: 0, updated_at: now },
    relay_on: false,
    reason: `unknown_state_${state}_reset`,
  };
}

/**
 * Called when a user presses "Start Session" in the web app. The web app writes
 * /commands/start_session with a timestamp; the poller sees it and moves the
 * FSM from IDLE → ARMED. We handle that here.
 */
export function handleStartCommand(currentRelayState, now) {
  const state = currentRelayState?.phase || RelayState.IDLE;
  if (state !== RelayState.IDLE) {
    return {
      accepted: false,
      fsm: currentRelayState,
      reason: `cannot_start_from_${state}`,
    };
  }
  return {
    accepted: true,
    fsm: { phase: RelayState.ARMED, session_started_at: now, finished_at: 0, updated_at: now },
    reason: 'session_armed',
  };
}

/**
 * Called when admin presses "Force Stop" in the web app.
 */
export function handleForceStop(now) {
  return {
    fsm: { phase: RelayState.IDLE, session_started_at: 0, finished_at: 0, updated_at: now },
    reason: 'force_stop',
  };
}
