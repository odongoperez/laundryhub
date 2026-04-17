// Live smoke test — hits ConnectLife ONCE with your real credentials, parses
// the response, and prints the result. Does NOT touch Firebase.
//
// Use this:
//   1. To verify your credentials work before deploying
//   2. To dump the raw statusList so you can see what fields your
//      WF3S8043BB3 firmware actually exposes (useful for tightening the parser)
//
// Run:
//   export CONNECTLIFE_USERNAME=odongoperezangel@gmail.com
//   export CONNECTLIFE_PASSWORD='your-password'
//   node test/smoke.js
//
// Or from the VM: sudo -u laundryhub bash -c "set -a; . /etc/laundryhub/env; set +a; node /opt/laundryhub/connectlife-poller/test/smoke.js"

import { ConnectLifeClient } from '../src/connectlife.js';
import { parseWasher } from '../src/washer-parser.js';

const username = process.env.CONNECTLIFE_USERNAME;
const password = process.env.CONNECTLIFE_PASSWORD;
const puid = process.env.WASHER_PUID || '1wfj0800029vw53t3pf0186';

if (!username || !password) {
  console.error('Set CONNECTLIFE_USERNAME and CONNECTLIFE_PASSWORD env vars');
  process.exit(1);
}

const log = {
  info:  (...a) => console.log('[smoke]', ...a),
  warn:  (...a) => console.warn('[smoke]', ...a),
  error: (...a) => console.error('[smoke]', ...a),
};

const client = new ConnectLifeClient({ username, password, logger: log });

try {
  log.info('fetching appliances...');
  const t0 = Date.now();
  const appliances = await client.getAppliances();
  const elapsed = Date.now() - t0;
  log.info(`got response in ${elapsed}ms`);

  const list = Array.isArray(appliances) ? appliances : (appliances.appliances || []);
  console.log(`\n--- found ${list.length} appliance(s) ---\n`);

  for (const a of list) {
    const id = a.puid || a.deviceId || a.wifiId || '(no id)';
    const isTarget = String(id).toLowerCase() === puid.toLowerCase();
    console.log(`${isTarget ? '★' : ' '} ${id}  type=${a.deviceTypeCode || a.deviceType || '?'}  name=${a.deviceNickName || '?'}`);
  }

  const target = list.find(a => {
    const id = a.puid || a.deviceId || a.wifiId || '';
    return String(id).toLowerCase() === puid.toLowerCase();
  }) || list[0];

  if (!target) { log.error('no appliances found'); process.exit(2); }

  console.log('\n--- raw statusList ---');
  console.log(JSON.stringify(target.statusList || target.status || {}, null, 2));

  console.log('\n--- parsed ---');
  const parsed = parseWasher(target);
  const { raw, ...summary } = parsed;
  console.log(JSON.stringify(summary, null, 2));

  console.log('\n✓ smoke test passed');
  process.exit(0);
} catch (err) {
  log.error('failed:', err.message);
  process.exit(1);
}
