'use client';

import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase-client';

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [config, setConfig] = useState(null);
  const [relayOn, setOnDuration] = useState(300);
  const [postWash, setPostWash] = useState(300);
  const [status, setStatus] = useState(null);
  const [fsm, setFsm] = useState(null);
  const [health, setHealth] = useState(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Live listeners
  useEffect(() => {
    const unsubs = [
      onValue(ref(db, '/status'),       s => setStatus(s.val())),
      onValue(ref(db, '/relay_state'),  s => setFsm(s.val())),
      onValue(ref(db, '/health'),       s => setHealth(s.val())),
    ];
    return () => unsubs.forEach(fn => fn());
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/config', { headers: { 'x-admin-token': token } });
      if (!res.ok) throw new Error((await res.json()).error || 'failed');
      const cfg = await res.json();
      setConfig(cfg);
      setOnDuration(cfg.relay_on_duration);
      setPostWash(cfg.post_wash_delay);
      setMsg('Loaded');
    } catch (e) { setMsg(`Error: ${e.message}`); }
    finally { setLoading(false); }
  }

  async function saveConfig() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'x-admin-token': token, 'content-type': 'application/json' },
        body: JSON.stringify({ relay_on_duration: relayOn, post_wash_delay: postWash }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'failed');
      const { config: cfg } = await res.json();
      setConfig(cfg);
      setMsg('Saved');
    } catch (e) { setMsg(`Error: ${e.message}`); }
    finally { setLoading(false); }
  }

  async function forceStop() {
    if (!confirm('Cut power to the washer now?')) return;
    try {
      const res = await fetch('/api/session/stop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user: 'admin' }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'failed');
      setMsg('Force stop requested');
    } catch (e) { setMsg(`Error: ${e.message}`); }
  }

  const healthAge = health?.last_poll_at ? Math.round((Date.now() - health.last_poll_at) / 1000) : null;
  const healthBad = !health?.ok || (healthAge != null && healthAge > 60);

  return (
    <div style={styles.wrap}>
      <h1 style={styles.h1}>LaundryHub Admin</h1>

      <section style={styles.card}>
        <h2 style={styles.h2}>Live Status</h2>
        <div style={styles.grid2}>
          <Row label="Machine state" value={status?.state ?? '—'} />
          <Row label="Program" value={status?.program ?? '—'} />
          <Row label="Remaining" value={status?.remain_minutes != null ? `${status.remain_minutes} min` : '—'} />
          <Row label="Temperature" value={status?.temp_c != null ? `${status.temp_c}°C` : '—'} />
          <Row label="Spin" value={status?.spin_rpm != null ? `${status.spin_rpm} rpm` : '—'} />
          <Row label="Door" value={status?.door ?? '—'} />
          <Row label="FSM phase" value={fsm?.phase ?? 'idle'} highlight />
          <Row label="Poller health"
               value={healthBad ? `⚠️ stale ${healthAge ?? '?'}s` : `✓ ok (${healthAge}s ago)`}
               error={healthBad} />
        </div>
        <button onClick={forceStop} style={{ ...styles.btn, ...styles.btnDanger }}>Force Stop Relay</button>
      </section>

      <section style={styles.card}>
        <h2 style={styles.h2}>Settings</h2>
        <p style={styles.muted}>Admin token required. Stored in Vercel env as ADMIN_TOKEN.</p>
        <input
          type="password"
          placeholder="admin token"
          value={token}
          onChange={e => setToken(e.target.value)}
          style={styles.input}
        />
        <button onClick={loadConfig} disabled={!token || loading} style={styles.btn}>Load</button>

        {config && (
          <>
            <div style={{ marginTop: 16 }}>
              <label style={styles.label}>
                Relay-on duration (seconds) — max wait for user to press Start on the machine
                <input type="number" min={30} max={3600} value={relayOn}
                       onChange={e => setOnDuration(Number(e.target.value))} style={styles.input} />
              </label>
              <label style={styles.label}>
                Post-wash delay (seconds) — wait after wash finishes before cutting power
                <input type="number" min={30} max={3600} value={postWash}
                       onChange={e => setPostWash(Number(e.target.value))} style={styles.input} />
              </label>
            </div>
            <button onClick={saveConfig} disabled={loading} style={{ ...styles.btn, ...styles.btnPrimary }}>
              Save
            </button>
          </>
        )}
      </section>

      {msg && <div style={styles.msg}>{msg}</div>}
    </div>
  );
}

function Row({ label, value, highlight, error }) {
  return (
    <div style={{ ...styles.row, ...(highlight ? styles.rowHighlight : {}), ...(error ? styles.rowError : {}) }}>
      <span style={styles.rowLabel}>{label}</span>
      <span style={styles.rowValue}>{value}</span>
    </div>
  );
}

const styles = {
  wrap: { maxWidth: 720, margin: '40px auto', padding: 24, fontFamily: 'system-ui, -apple-system, sans-serif', color: '#e8e6e3', background: '#1a1a1a', borderRadius: 16 },
  h1: { fontSize: 28, margin: '0 0 24px', color: '#f5a623' },
  h2: { fontSize: 18, margin: '0 0 16px', color: '#f5a623' },
  card: { background: '#232323', padding: 20, borderRadius: 12, marginBottom: 20, boxShadow: 'inset 2px 2px 6px #0f0f0f, inset -2px -2px 6px #2f2f2f' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  row: { display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#1a1a1a', borderRadius: 6 },
  rowHighlight: { background: '#2b2614', borderLeft: '3px solid #f5a623' },
  rowError: { background: '#2b1414', borderLeft: '3px solid #d64545' },
  rowLabel: { color: '#888' },
  rowValue: { color: '#e8e6e3', fontWeight: 600 },
  label: { display: 'block', marginBottom: 12, color: '#bbb', fontSize: 14 },
  input: { display: 'block', width: '100%', padding: 10, marginTop: 6, background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#e8e6e3', fontSize: 14, boxSizing: 'border-box' },
  btn: { padding: '10px 18px', background: '#2d2d2d', color: '#e8e6e3', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, marginTop: 12, marginRight: 8 },
  btnPrimary: { background: '#f5a623', color: '#1a1a1a', fontWeight: 600 },
  btnDanger: { background: '#d64545', color: '#fff', fontWeight: 600 },
  muted: { color: '#888', fontSize: 13, margin: '0 0 12px' },
  msg: { padding: 12, background: '#232323', borderRadius: 6, color: '#f5a623', fontSize: 14 },
};
