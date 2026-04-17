// Parser for Hisense WF3S8043BB3 (device type 027 - washing machine).
// Maps the raw `statusList` object from ConnectLife's appliance endpoint to
// friendly fields the web app consumes. Property names come from the
// oyvindwe/connectlife-ha data dictionary for type 027 + real device dumps.
//
// Unknown properties fall through in `raw`, so you can inspect them from
// Firebase and extend this map when you spot new fields in your device.

// Wash state enum (f_status). 7 is the common "finished/end" value.
// Exact values can vary by firmware — confirm against a real dump for your unit.
const STATE_MAP = {
  0: 'off',
  1: 'standby',
  2: 'running',      // cycle in progress
  3: 'paused',
  4: 'delayed',      // delay-start queued
  5: 'rinse_hold',
  6: 'spinning',
  7: 'finished',     // end-of-cycle — this is what triggers post-wash cutoff
  8: 'error',
};

// Program selection (f_program / selected_program_id). These are indices into
// the machine's program menu; the actual display names live in the mobile app.
// Treat unknowns as "program_<n>" and let the user rename in the admin UI.
const PROGRAM_NAMES = {
  0: 'Cotton',
  1: 'Cotton Eco',
  2: 'Synthetics',
  3: 'Wool',
  4: 'Delicates',
  5: 'Quick 15',
  6: 'Rinse + Spin',
  7: 'Spin',
  8: 'Drain',
  9: 'Mixed',
  10: 'Sports',
  11: 'Baby Care',
  12: 'Allergy Care',
  13: 'Hygiene',
  14: 'Dark Care',
  15: 'Shirts',
  16: 'Duvet',
  17: 'Hand Wash',
  18: 'Self Clean',
};

// Door lock flag - 1 = locked, 0 = unlocked
const DOOR_MAP = { 0: 'unlocked', 1: 'locked' };

function pickNumber(obj, ...keys) {
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') {
      const n = Number(obj[k]);
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

function pickString(obj, ...keys) {
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return String(obj[k]);
  }
  return null;
}

/**
 * @param {object} appliance - one entry from the /api/v1/appliance response
 * @returns {object} normalised machine status
 */
export function parseWasher(appliance) {
  const status = appliance.statusList || appliance.status || {};

  const stateCode = pickNumber(status, 'f_status', 'Status', 'status');
  const programCode = pickNumber(status, 'f_program', 'selected_program_id', 'program');
  const remainMin = pickNumber(status, 'remain_time', 'remainTime', 'remaining_time');
  const tempC = pickNumber(status, 't_temp', 'temp', 'target_temperature');
  const spinRpm = pickNumber(status, 'spin_speed', 'f_spin', 'spin');
  const doorCode = pickNumber(status, 'door_lock', 'f_door_lock', 'door');
  const powerOn = pickNumber(status, 'power', 'f_power', 'on_off');

  const state = stateCode != null ? (STATE_MAP[stateCode] ?? `unknown_${stateCode}`) : 'unknown';
  const program = programCode != null
    ? (PROGRAM_NAMES[programCode] ?? `program_${programCode}`)
    : null;

  return {
    // Identity
    puid: appliance.puid || appliance.deviceId || null,
    wifi_id: appliance.wifiId || appliance.wifi_id || null,
    device_type: appliance.deviceTypeCode || appliance.deviceType || '027',
    device_nickname: pickString(appliance, 'deviceNickName', 'deviceName', 'nickname'),
    online: appliance.deviceFeatureCode != null || appliance.online === true || appliance.onlineState === 1,

    // Live state
    state,                         // off | standby | running | paused | delayed | rinse_hold | spinning | finished | error
    state_code: stateCode,
    is_finished: state === 'finished',
    is_running: state === 'running' || state === 'spinning' || state === 'rinse_hold',
    power_on: powerOn === 1,

    // Program
    program,
    program_code: programCode,

    // Progress
    remain_minutes: remainMin,
    temp_c: tempC,
    spin_rpm: spinRpm,
    door: doorCode != null ? (DOOR_MAP[doorCode] ?? `unknown_${doorCode}`) : null,

    // Everything else, for admin inspection / future mapping
    raw: status,

    // Metadata
    fetched_at: Date.now(),
  };
}
