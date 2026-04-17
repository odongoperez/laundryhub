# Quickstart — deploy in order

Work through these five blocks. Each is independent: if step 3 fails you can
still test step 2 in isolation.

## 1. Validate locally (2 min)

Before deploying anything, confirm the FSM + parser work on your machine:

```bash
cd connectlife-poller
npm install
npm test
```

Expected: `9 passed, 0 failed` (FSM) and `8 passed, 0 failed` (parser).

Then smoke-test the real ConnectLife API:

```bash
export CONNECTLIFE_USERNAME=odongoperezangel@gmail.com
export CONNECTLIFE_PASSWORD='Majupaz2019!'
npm run smoke
```

You should see your WF3S8043BB3 show up with `★` next to its PUID and a dump
of the raw `statusList`. **Save that output** — you'll want it to fine-tune
`washer-parser.js` for your exact firmware.

If smoke fails: wrong password, ConnectLife T&C unaccepted, or account locked.
Open the ConnectLife mobile app, log in, accept any pending terms, retry.

## 2. Get Firebase service account JSON (3 min)

1. Firebase Console → `laundryhub-4e35b` → ⚙ Project Settings → **Service accounts** tab
2. Click **Generate new private key** → Confirm → file downloads
3. Flatten to a single line:
   ```bash
   jq -c . ~/Downloads/laundryhub-4e35b-firebase-adminsdk-*.json > sa.oneline.json
   cat sa.oneline.json  # copy this
   ```
   (No `jq`? Paste into https://jsonformatter.org and click "Compact".)

## 3. Oracle Cloud VM (~15 min — one time)

Follow `docs/oracle-cloud-setup.md` top to bottom. The condensed version:

1. Sign up at https://signup.cloud.oracle.com (Frankfurt region)
2. Create instance → Ubuntu 22.04 → Ampere A1.Flex 1 OCPU / 6 GB RAM → save SSH key
3. SSH in: `ssh -i key.pem ubuntu@<public-ip>`
4. Run bootstrap:
   ```bash
   curl -O https://raw.githubusercontent.com/odongoperez/laundryhub/main/connectlife-poller/deploy/bootstrap.sh
   chmod +x bootstrap.sh && sudo ./bootstrap.sh
   ```
5. Edit `/etc/laundryhub/env`:
   ```bash
   sudo nano /etc/laundryhub/env
   ```
   Fill in `CONNECTLIFE_PASSWORD` and paste the one-line `FIREBASE_SERVICE_ACCOUNT_JSON`.
6. Start and watch:
   ```bash
   sudo systemctl restart laundryhub-poller
   sudo journalctl -u laundryhub-poller -f
   ```
   You should see `poll ok XXXms | standby / ... | fsm=idle relay=off` within 10s.

**Check in Firebase console:** `/status` should have live data, `/health.ok`
should be `true`, `/relay_command.on` should be `false`.

## 4. Vercel admin UI (5 min)

1. In Vercel project settings → Environment Variables, add:
   - `FIREBASE_SERVICE_ACCOUNT_JSON` — same one-line JSON from step 2
   - `FIREBASE_DATABASE_URL` — `https://laundryhub-4e35b-default-rtdb.europe-west1.firebasedatabase.app`
   - `ADMIN_TOKEN` — any long random string. Generate with `openssl rand -hex 32`
2. Push the `vercel-admin/` contents to your repo (or set Vercel's root directory to `vercel-admin`).
3. Wait for auto-deploy. Open `https://laundryhub.vercel.app/admin`.
4. Paste your admin token, click **Load**. You should see live status and the
   two duration fields.

## 5. ESP32 firmware (5 min)

1. Open `esp32-firmware/laundryhub_v7.ino` in Arduino IDE.
2. Select board: **ESP32 Dev Module**, correct COM port.
3. Upload. Open Serial Monitor at 115200.
4. You should see:
   ```
   [LaundryHub ESP32 v7]
   [wifi] connecting to Stechbahn 18 01
   [wifi] connected ip=192.168.x.x
   [poll] ok relay=OFF reason=idle
   ```
5. **Integration test:** from `/admin`, click **Force Stop Relay**. Within 3s
   the ESP32 should log another `[poll] ok relay=OFF reason=force_stop`.

Now press "Start Session" from whatever UI you add on the main page (or curl):
```bash
curl -X POST https://laundryhub.vercel.app/api/session/start \
  -H 'content-type: application/json' \
  -d '{"user":"allan"}'
```
→ within 10s the ESP32 should log `relay=ON reason=armed_waiting_...`.

## 6. First real wash (verification)

1. Start a session from the web app.
2. Press Start on the physical washer. Within 10s the Oracle poller should
   see the state change and log `FSM armed -> washing`.
3. Do a short wash (Quick 15 program if available).
4. When the washer beeps done, the poller should log `FSM washing -> finished_cooldown`.
5. After 5 min, the poller logs `FSM finished_cooldown -> idle` and the
   ESP32 logs `[relay] OFF (power cut)`.

If all of that works you're done.

## Troubleshooting cheat sheet

| Symptom | Likely cause | Fix |
|---|---|---|
| Poller can't auth | T&C updated | Accept in mobile app |
| Poller can't auth | Wrong password in env | `sudo nano /etc/laundryhub/env`, restart |
| `/status` never appears in Firebase | Bad service account JSON | Regenerate, re-paste |
| ESP32 relay never changes | Wrong auth key | Double-check `FIREBASE_AUTH` in firmware matches the Web API key |
| Admin page shows 401 | `ADMIN_TOKEN` mismatch | Compare Vercel env to what you're typing |
| `state: "unknown_N"` | Firmware-specific code not mapped | Add to `STATE_MAP` in `washer-parser.js`, redeploy |
| Health shows stale >60s | VM rebooted or network issue | `sudo systemctl restart laundryhub-poller`, check Oracle VM is running |
