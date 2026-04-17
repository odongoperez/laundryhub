// Tests for washer-parser.js — uses synthetic appliance payloads shaped like
// what ConnectLife's /api/v1/appliance endpoint returns for a type 027 device.
//
// Run: node test/parser.test.js

import { parseWasher } from '../src/washer-parser.js';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEq(actual, expected, field) {
  if (actual !== expected) throw new Error(`${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// --- Representative payload: running Cotton Eco wash, 45 min remaining ---
test('parses a running wash correctly', () => {
  const appliance = {
    puid: '1wfj0800029vw53t3pf0186',
    wifiId: 'HI-WF3S-ABC',
    deviceTypeCode: '027',
    deviceNickName: 'Kitchen Washer',
    onlineState: 1,
    statusList: {
      f_status: 2,            // running
      f_program: 1,           // Cotton Eco
      remain_time: 45,
      t_temp: 40,
      spin_speed: 1200,
      door_lock: 1,
      power: 1,
      f_extra_nonsense: 'hello',
    },
  };
  const w = parseWasher(appliance);
  assertEq(w.state, 'running', 'state');
  assertEq(w.state_code, 2, 'state_code');
  assertEq(w.is_running, true, 'is_running');
  assertEq(w.is_finished, false, 'is_finished');
  assertEq(w.program, 'Cotton Eco', 'program');
  assertEq(w.program_code, 1, 'program_code');
  assertEq(w.remain_minutes, 45, 'remain_minutes');
  assertEq(w.temp_c, 40, 'temp_c');
  assertEq(w.spin_rpm, 1200, 'spin_rpm');
  assertEq(w.door, 'locked', 'door');
  assertEq(w.power_on, true, 'power_on');
  assertEq(w.puid, '1wfj0800029vw53t3pf0186', 'puid');
  assert(w.raw.f_extra_nonsense === 'hello', 'raw preserves unknown props');
});

test('parses finished state', () => {
  const w = parseWasher({
    puid: 'x',
    statusList: { f_status: 7, f_program: 1, remain_time: 0, door_lock: 0 },
  });
  assertEq(w.state, 'finished', 'state');
  assertEq(w.is_finished, true, 'is_finished flag');
  assertEq(w.is_running, false, 'is_running flag');
  assertEq(w.door, 'unlocked', 'door unlocked at end');
});

test('parses standby/idle state', () => {
  const w = parseWasher({
    puid: 'x',
    statusList: { f_status: 1, f_program: 0, power: 1 },
  });
  assertEq(w.state, 'standby', 'state');
  assertEq(w.is_running, false, 'not running');
  assertEq(w.is_finished, false, 'not finished');
});

test('handles unknown state codes gracefully', () => {
  const w = parseWasher({
    puid: 'x',
    statusList: { f_status: 99, f_program: 42 },
  });
  assertEq(w.state, 'unknown_99', 'unknown state tagged');
  assertEq(w.program, 'program_42', 'unknown program tagged');
});

test('handles missing fields without crashing', () => {
  const w = parseWasher({ puid: 'x', statusList: {} });
  assertEq(w.state, 'unknown', 'state is unknown');
  assertEq(w.program, null, 'program is null');
  assertEq(w.remain_minutes, null, 'remain is null');
  assertEq(w.is_finished, false, 'is_finished false by default');
});

test('handles empty appliance object', () => {
  const w = parseWasher({});
  assertEq(w.state, 'unknown', 'state unknown');
  assertEq(w.puid, null, 'puid null');
});

test('handles alternate property names (status instead of statusList)', () => {
  const w = parseWasher({
    puid: 'y',
    status: { Status: 2, program: 5 },  // uppercase + alternate key
  });
  assertEq(w.state, 'running', 'state parses from "Status"');
  assertEq(w.program, 'Quick 15', 'program parses from "program"');
});

test('spin state correctly flagged as running', () => {
  const w = parseWasher({ puid: 'x', statusList: { f_status: 6 } });
  assertEq(w.state, 'spinning', 'state');
  assertEq(w.is_running, true, 'spinning counts as running for relay purposes');
});

// --- Run ---
let passed = 0, failed = 0;
for (const { name, fn } of tests) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.log(`  ✗ ${name}\n    → ${err.message}`); failed++; }
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
