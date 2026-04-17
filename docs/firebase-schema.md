# Firebase Realtime Database schema

Project: `laundryhub-4e35b`
URL: `https://laundryhub-4e35b-default-rtdb.europe-west1.firebasedatabase.app`

All paths are at the root. Units: seconds unless otherwise noted. Timestamps
are `Date.now()` milliseconds (UTC).

```
/
├── status                      # written by poller every POLL_INTERVAL_MS
│   ├── puid                    # "1wfj0800029vw53t3pf0186"
│   ├── device_nickname         # from ConnectLife app
│   ├── online                  # bool
│   ├── state                   # "off" | "standby" | "running" | "paused"
│   │                           # | "delayed" | "rinse_hold" | "spinning"
│   │                           # | "finished" | "error" | "unknown_<n>"
│   ├── state_code              # raw ConnectLife f_status integer
│   ├── is_finished             # bool derived flag
│   ├── is_running              # bool derived flag
│   ├── power_on                # bool
│   ├── program                 # "Cotton Eco" | "Quick 15" | ...
│   ├── program_code            # raw index
│   ├── remain_minutes          # minutes remaining, or null
│   ├── temp_c                  # target water temp, or null
│   ├── spin_rpm                # spin speed, or null
│   ├── door                    # "locked" | "unlocked" | null
│   ├── raw                     # full ConnectLife statusList object (for debugging / new mappings)
│   └── fetched_at              # ms timestamp
│
├── relay_command               # written by poller; read by ESP32 every 3s
│   ├── on                      # bool — drives GPIO 26 (on=LOW=relay closed)
│   ├── reason                  # short human-readable string
│   └── updated_at              # ms timestamp
│
├── relay_state                 # FSM state, survives poller restart
│   ├── phase                   # "idle" | "armed" | "washing" | "finished_cooldown"
│   ├── session_started_at      # ms; 0 when idle
│   ├── finished_at             # ms; set when state becomes "finished"
│   └── updated_at              # ms
│
├── admin/config                # editable via /admin page
│   ├── relay_on_duration       # seconds; default 300 (5 min armed timeout)
│   └── post_wash_delay         # seconds; default 300 (5 min after finished)
│
├── commands                    # one-shot command queue, cleared by poller
│   ├── start_session           # { user, requested_at }
│   └── force_stop              # { user, requested_at }
│
├── events                      # rolling log, capped at last 200 entries
│   └── <push_id>
│       ├── type                # "fsm_transition" | "session_start" | "force_stop" | ...
│       ├── ts                  # ms
│       └── (type-specific fields)
│
└── health                      # poller heartbeat
    ├── ok                      # bool
    ├── last_poll_at            # ms
    ├── poll_duration_ms
    ├── consecutive_failures
    ├── last_error              # string, only on failure
    └── last_error_at
```

## Recommended security rules

```json
{
  "rules": {
    "status":        { ".read": true,  ".write": false },
    "relay_command": { ".read": true,  ".write": false },
    "relay_state":   { ".read": true,  ".write": false },
    "health":        { ".read": true,  ".write": false },
    "events":        { ".read": true,  ".write": false },
    "admin":         { ".read": false, ".write": false },
    "commands":      { ".read": false, ".write": false }
  }
}
```

The poller writes using a service account (bypasses rules). The Vercel API
routes also use the service account. The ESP32 reads via the legacy auth key
which is limited by these rules (read-only on public paths).
```
