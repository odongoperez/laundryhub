# LaundryHub ConnectLife Integration

Polls the Hisense WF3S8043BB3 washing machine via the ConnectLife cloud API,
pushes live status to Firebase Realtime DB, and controls the ESP32 relay based
on wash state.

## Architecture

```
┌─────────────────────┐
│ Oracle Cloud VM     │   Always-free 24/7 Node.js process
│ (poller, every 10s) │
└──────────┬──────────┘
           │  1. Auth via Gigya → get JWT → exchange for access_token
           │  2. GET api.connectlife.io/api/v1/appliance
           │  3. Parse WF3S8043BB3 status (state, program, remaining, temp, spin)
           │  4. Run FSM: idle → armed → washing → finished_cooldown → idle
           │  5. Write status + relay_command to Firebase
           │
           ▼
┌─────────────────────┐
│ Firebase Realtime DB│   laundryhub-4e35b (europe-west1)
│   /status           │
│   /relay_command    │   ← single source of truth for ESP32
│   /relay_state      │
│   /admin/config     │
│   /commands/*       │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
┌─────────┐  ┌──────────────────┐
│ ESP32   │  │ Vercel (Next.js) │
│ GPIO 26 │  │ laundryhub.app   │
│ polls   │  │ - admin page     │
│ every 3s│  │ - session start  │
└─────────┘  │ - force stop     │
             │ - live status    │
             └──────────────────┘
```

## What's in this repo

| Path | Purpose |
|---|---|
| `connectlife-poller/` | Node.js service that runs on Oracle Cloud |
| `connectlife-poller/src/connectlife.js` | API client (Gigya → JWT → OAuth → appliances) |
| `connectlife-poller/src/washer-parser.js` | Maps raw statusList → friendly fields for WF3S8043BB3 |
| `connectlife-poller/src/relay-controller.js` | Finite state machine (idle/armed/washing/cooldown) |
| `connectlife-poller/src/firebase-writer.js` | Firebase Admin SDK wrapper |
| `connectlife-poller/src/index.js` | Main poll loop |
| `connectlife-poller/deploy/` | bootstrap.sh, systemd unit, update.sh |
| `vercel-admin/app/admin/page.js` | Admin UI (edit durations, see live state, force stop) |
| `vercel-admin/app/api/session/start/route.js` | POST /api/session/start |
| `vercel-admin/app/api/session/stop/route.js` | POST /api/session/stop |
| `vercel-admin/app/api/admin/config/route.js` | GET/PUT /api/admin/config |
| `vercel-admin/lib/firebase-admin.js` | Firebase Admin init helper |
| `vercel-admin/lib/firebase-client.js` | Firebase client SDK config |
| `esp32-firmware/laundryhub_v7.ino` | ESP32 firmware, reads /relay_command |
| `docs/firebase-schema.md` | Full Firebase RTDB schema reference |
| `docs/oracle-cloud-setup.md` | Step-by-step Oracle Cloud VM setup |

## Relay behaviour

The relay is a **hard power cutoff**: if it opens mid-wash, the machine stops.
So the controller keeps the relay closed continuously from session start
through wash finish + post-wash delay.

**FSM phases:**

| Phase | Relay | Enters when | Exits when |
|---|---|---|---|
| `idle` | OFF | boot, or previous phase ended | user presses Start → `armed` |
| `armed` | ON | user presses Start in web app | wash starts → `washing`, or `relay_on_duration` timeout → `idle` |
| `washing` | ON | ConnectLife reports running/spinning | ConnectLife reports finished → `finished_cooldown` |
| `finished_cooldown` | ON | wash finished | `post_wash_delay` elapsed → `idle` |

**`relay_on_duration`** (default 5 min) is the max time the relay stays armed
waiting for the user to press Start on the physical machine. If they don't,
power is cut.

**`post_wash_delay`** (default 5 min) is how long power stays on after the
wash finishes — lets the user come get their clothes before the machine
goes dark.

Both are editable live via `/admin`.

## Quickstart

1. **Oracle Cloud VM**: follow [`docs/oracle-cloud-setup.md`](docs/oracle-cloud-setup.md)
2. **Vercel deploy**: push to GitHub, Vercel auto-deploys. Set env vars:
   - `FIREBASE_SERVICE_ACCOUNT_JSON` (full JSON, one line)
   - `FIREBASE_DATABASE_URL`
   - `ADMIN_TOKEN` (any long random string; use in the admin page)
3. **ESP32**: flash `esp32-firmware/laundryhub_v7.ino`. No config needed,
   credentials are pre-filled.
4. **Firebase rules**: paste from [`docs/firebase-schema.md`](docs/firebase-schema.md).
5. Verify: open `/admin`, enter your `ADMIN_TOKEN`, press "Load". You should
   see live machine status within 10s. Click "Force Stop Relay" — within 3s
   the ESP32 should report `[relay] OFF` in serial console.

## Caveats

- **ConnectLife API is not officially supported.** Hisense may change it or
  lock accounts. The poller respects the 10s interval (same as the HA
  integration's 60s default, we're 6× faster) — if they start rate-limiting,
  bump `POLL_INTERVAL_MS` in `/etc/laundryhub/env` to 30000.
- **ConnectLife T&C updates** periodically break auth. Fix: open the
  ConnectLife mobile app, accept the new terms, poller recovers.
- **Program names and state codes** in `washer-parser.js` are best-effort
  from the reverse-engineered HA integration. Check `/status/raw` in Firebase
  for your machine's actual values and PR corrections to the parser.
- **WF3S8043BB3 specific dumps not yet in oyvindwe's data dictionary.** The
  `raw` field in `/status` lets you see every property the API returns — once
  you have a full wash cycle's worth of observations, we can tighten the
  parser to match your exact firmware (module `S1882.6.03.03.SE`).
