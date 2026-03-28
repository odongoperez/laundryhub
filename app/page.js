"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import DB from "./firebase";

// ─── Defaults ───
const DEFAULT_CONFIG = {
  primaryColor: "#0F766E",
  accentColor: "#F59E0B",
  appName: "LaundryHub",
  esp32Ip: "192.168.1.100",
  washCycles: [
    { name: "Quick Wash", minutes: 30 },
    { name: "Normal", minutes: 45 },
    { name: "Heavy Duty", minutes: 60 },
    { name: "Delicates", minutes: 25 },
    { name: "Bedding", minutes: 75 },
  ],
  alertMinutesBefore: 5,
};

const ADMIN_PASSWORD = "1234";

// ─── ESP32 Relay Control ───
async function sendToEsp32(ip, command) {
  if (!ip || ip === "192.168.1.100") return; // skip if default/unconfigured
  try {
    const url = `http://${ip}/${command}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch(url, { signal: controller.signal, mode: "no-cors" });
    clearTimeout(timeout);
    console.log(`[ESP32] Sent /${command} to ${ip}`);
  } catch (e) {
    console.warn(`[ESP32] Failed to reach ${ip}: ${e.message}`);
  }
}

/* ════════════════════════════════════════════════════════════════
   GLOBAL STYLES
   ════════════════════════════════════════════════════════════════ */
function GlobalStyles({ primary }) {
  return (
    <style>{`
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes fadeUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
      @keyframes ripple { 0% { box-shadow: 0 0 0 0 ${primary}66; } 100% { box-shadow: 0 0 0 20px ${primary}00; } }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'DM Sans', 'Segoe UI', sans-serif; background: #0f172a; color: #f1f5f9; }
      input:focus, button:focus { outline: none; }
      button { font-family: 'DM Sans', sans-serif; }
      input { font-family: 'DM Sans', sans-serif; }
      ::-webkit-scrollbar { width: 6px; }
      ::-webkit-scrollbar-track { background: #1e293b; }
      ::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
    `}</style>
  );
}

/* ════════════════════════════════════════════════════════════════
   ICONS
   ════════════════════════════════════════════════════════════════ */
const I = {
  Power: (p) => <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none" stroke={p.c||"currentColor"} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="2" x2="12" y2="12"/><path d="M16.24 7.76a6 6 0 1 1-8.49 0"/></svg>,
  Clock: (p) => <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Users: (p) => <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Gear: (p) => <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  Cal: (p) => <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Bell: (p) => <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Wifi: (p) => <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>,
  Out: (p) => <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Drop: (p) => <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill={p.c||"currentColor"}><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>,
  Trash: (p) => <svg width={p.s||18} height={p.s||18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>,
  Shield: (p) => <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Zap: (p) => <svg width={p.s||20} height={p.s||20} viewBox="0 0 24 24" fill="none" stroke={p.c||"currentColor"} strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
};

/* ════════════════════════════════════════════════════════════════
   TOAST
   ════════════════════════════════════════════════════════════════ */
function Toast({ message, type = "info", onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  const bg = { success: "#059669", error: "#dc2626", warning: "#d97706", info: "#0ea5e9" }[type] || "#0ea5e9";
  return (
    <div style={{
      position: "fixed", top: 20, right: 20, left: 20, zIndex: 9999, padding: "14px 20px",
      background: bg, color: "#fff", borderRadius: 14, fontSize: 14, fontWeight: 600,
      boxShadow: `0 8px 30px ${bg}44`, animation: "slideIn 0.3s ease",
      display: "flex", alignItems: "center", gap: 10, maxWidth: 400, margin: "0 auto",
    }}>
      <I.Bell s={16} /> {message}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   WASHING ANIMATION
   ════════════════════════════════════════════════════════════════ */
function WashAnim({ running, progress, color }) {
  return (
    <div style={{
      width: 160, height: 160, borderRadius: "50%", position: "relative",
      background: `conic-gradient(${color} ${progress * 360}deg, #1e293b ${progress * 360}deg)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: running ? `0 0 40px ${color}44` : "0 0 20px #0002",
      transition: "box-shadow 0.5s",
      animation: running ? "ripple 2s infinite" : "none",
    }}>
      <div style={{
        width: 136, height: 136, borderRadius: "50%", background: "#0f172a",
        display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
      }}>
        {running ? (
          <div style={{ animation: "spin 2s linear infinite" }}>
            <I.Drop s={36} c={color} />
          </div>
        ) : (
          <I.Power s={36} c="#64748b" />
        )}
        <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 8, fontWeight: 700, letterSpacing: 1 }}>
          {running ? `${Math.round(progress * 100)}%` : "IDLE"}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   LOGIN SCREEN
   ════════════════════════════════════════════════════════════════ */
function LoginScreen({ onLogin, config }) {
  const [mode, setMode] = useState("user");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(""); setLoading(true);
    try {
      if (mode === "admin") {
        if (password === ADMIN_PASSWORD) { onLogin({ role: "admin", name: "Admin" }); return; }
        else setError("Wrong admin password");
      } else {
        const users = await DB.getUsers();
        const user = users.find(u => u.name.toLowerCase() === username.trim().toLowerCase() && u.pin === password);
        if (user) { onLogin({ role: "user", name: user.name, id: user.id }); return; }
        else setError("Invalid name or PIN. Ask admin to create your account.");
      }
    } catch (e) {
      setError("Connection error — check internet");
      console.error(e);
    }
    setLoading(false);
  };

  const inp = {
    width: "100%", padding: "14px 16px", borderRadius: 12, border: "2px solid #334155",
    background: "#0f172a", color: "#f1f5f9", fontSize: 15,
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0f172a", padding: 20,
    }}>
      <div style={{
        width: "100%", maxWidth: 400, background: "#1e293b", borderRadius: 24, padding: "36px 32px",
        boxShadow: "0 25px 60px #0006", animation: "fadeUp 0.5s ease",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, background: `${config.primaryColor}22`,
            display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12,
          }}>
            <I.Drop s={32} c={config.primaryColor} />
          </div>
          <h1 style={{ fontSize: 26, fontFamily: "'Space Mono', monospace", letterSpacing: -1 }}>
            {config.appName}
          </h1>
          <p style={{ color: "#64748b", fontSize: 13, marginTop: 2 }}>Smart Shared Laundry</p>
        </div>

        {/* Mode Toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {["user", "admin"].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); }} style={{
              flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer",
              background: mode === m ? config.primaryColor : "#334155", color: "#f1f5f9",
              fontWeight: 600, fontSize: 14, transition: "all 0.2s",
            }}>{m === "admin" ? "🛡️ Admin" : "👤 User"}</button>
          ))}
        </div>

        {mode === "user" && (
          <input value={username} onChange={e => setUsername(e.target.value)}
            placeholder="Your name" style={{ ...inp, marginBottom: 10 }} />
        )}
        <input value={password} onChange={e => setPassword(e.target.value)}
          type="password" placeholder={mode === "admin" ? "Admin password" : "Your 4-digit PIN"}
          onKeyDown={e => e.key === "Enter" && handleLogin()}
          style={{ ...inp, marginBottom: 8 }} />

        {error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 6, fontWeight: 500 }}>{error}</p>}

        <button onClick={handleLogin} disabled={loading} style={{
          width: "100%", padding: "14px 0", borderRadius: 12, border: "none", cursor: "pointer",
          background: loading ? "#475569" : config.primaryColor, color: "#fff",
          fontWeight: 700, fontSize: 16, marginTop: 10, letterSpacing: 0.5,
          opacity: loading ? 0.7 : 1,
        }}>{loading ? "Signing in..." : "Sign In"}</button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   HEADER
   ════════════════════════════════════════════════════════════════ */
function Header({ config, name, isAdmin, onLogout }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "14px 20px", borderBottom: "1px solid #1e293b", flexWrap: "wrap", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {isAdmin ? <I.Shield s={22} /> : <I.Drop s={22} c={config.primaryColor} />}
        <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 16 }}>
          {isAdmin ? "Admin Panel" : config.appName}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ color: "#94a3b8", fontSize: 13 }}>
          {isAdmin ? "🛡️" : "👋"} {name}
        </span>
        <button onClick={onLogout} style={{
          background: "none", border: "1px solid #334155", borderRadius: 8, padding: "5px 10px",
          color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12,
        }}><I.Out s={13} /> Out</button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   USER DASHBOARD
   ════════════════════════════════════════════════════════════════ */
function UserDash({ user, config, onLogout, toast }) {
  const [machine, setMachine] = useState({ running: false });
  const [schedule, setSchedule] = useState([]);
  const [cycle, setCycle] = useState(0);
  const [sDate, setSDate] = useState("");
  const [sTime, setSTime] = useState("");
  const [now, setNow] = useState(Date.now());
  const alertFired = useRef(false);

  // Realtime listeners
  useEffect(() => {
    const unsub1 = DB.onMachineChange(setMachine);
    const unsub2 = DB.onScheduleChange(setSchedule);
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => { unsub1(); unsub2(); clearInterval(iv); };
  }, []);

  // Alert + auto-stop
  useEffect(() => {
    if (!machine?.running || machine.userId !== user.id) return;
    const endTime = machine.startTime + machine.durationMs;
    const alertTime = endTime - config.alertMinutesBefore * 60000;
    if (now >= alertTime && now < endTime && !alertFired.current) {
      alertFired.current = true;
      toast(`⏰ Wash finishes in ~${config.alertMinutesBefore} min!`, "warning");
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("LaundryHub", { body: `Your wash finishes in ~${config.alertMinutesBefore} minutes!` });
      }
    }
    if (now >= endTime) {
      sendToEsp32(config.esp32Ip, "off");
      DB.setMachine({ running: false });
      toast("✅ Wash cycle complete!", "success");
      alertFired.current = false;
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("LaundryHub", { body: "Your wash is done! 🧺" });
      }
    }
  }, [now, machine, user.id, config.alertMinutesBefore, toast]);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const isMyWash = machine?.running && machine.userId === user.id;
  const isBusy = machine?.running && machine.userId !== user.id;
  const progress = machine?.running ? Math.min(1, (now - machine.startTime) / machine.durationMs) : 0;
  const remainMs = machine?.running ? Math.max(0, (machine.startTime + machine.durationMs) - now) : 0;
  const remainMin = Math.ceil(remainMs / 60000);

  const startWash = async () => {
    if (machine?.running) return;
    const c = config.washCycles[cycle];
    await sendToEsp32(config.esp32Ip, "on");
    await DB.setMachine({
      running: true, userId: user.id, userName: user.name,
      cycleName: c.name, startTime: Date.now(), durationMs: c.minutes * 60000,
    });
    alertFired.current = false;
    toast(`🚿 ${c.name} started — ${c.minutes} min`, "success");
  };

  const stopWash = async () => {
    if (!isMyWash) return;
    await sendToEsp32(config.esp32Ip, "off");
    await DB.setMachine({ running: false });
    toast("Machine stopped", "info");
  };

  const addSched = async () => {
    if (!sDate || !sTime) return toast("Pick date & time", "error");
    const c = config.washCycles[cycle];
    await DB.addScheduleEntry({
      id: Date.now().toString(), userId: user.id, userName: user.name,
      cycleName: c.name, minutes: c.minutes, dateTime: `${sDate}T${sTime}`,
    });
    setSDate(""); setSTime("");
    toast("📅 Wash scheduled!", "success");
  };

  const fmt = (dt) => {
    const d = new Date(dt);
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) + " " +
           d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  const card = { background: "#1e293b", borderRadius: 16, padding: 24, marginBottom: 20, border: "1px solid #334155" };
  const inp = {
    flex: 1, minWidth: 130, padding: "10px 12px", borderRadius: 10, border: "2px solid #334155",
    background: "#0f172a", color: "#f1f5f9", fontSize: 14,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a" }}>
      <Header config={config} name={user.name} onLogout={onLogout} />
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px" }}>

        {/* Machine Status */}
        <div style={{
          ...card, display: "flex", flexDirection: "column", alignItems: "center",
          border: `1px solid ${isBusy ? "#dc262644" : isMyWash ? config.primaryColor + "44" : "#334155"}`,
        }}>
          <WashAnim running={machine?.running} progress={progress} color={config.primaryColor} />
          {machine?.running ? (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase",
                color: isBusy ? "#f87171" : config.primaryColor,
              }}>{isBusy ? `🔒 ${machine.userName} is washing` : "Your wash is running"}</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{machine.cycleName}</div>
              <div style={{ color: "#94a3b8", fontSize: 14, marginTop: 2 }}>⏱ {remainMin} min left</div>
              {isMyWash && (
                <button onClick={stopWash} style={{
                  marginTop: 14, padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: "#dc2626", color: "#fff", fontWeight: 600, fontSize: 14,
                }}>⏹ Stop</button>
              )}
            </div>
          ) : (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 700, letterSpacing: 2 }}>● AVAILABLE</div>
              <div style={{ color: "#94a3b8", marginTop: 2, fontSize: 13 }}>Machine is free</div>
            </div>
          )}
        </div>

        {/* Start Wash */}
        {!machine?.running && (
          <div style={card}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <I.Zap s={16} c={config.primaryColor} /> Start a Wash
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {config.washCycles.map((c, i) => (
                <button key={i} onClick={() => setCycle(i)} style={{
                  padding: "9px 14px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600,
                  border: cycle === i ? `2px solid ${config.primaryColor}` : "2px solid #334155",
                  background: cycle === i ? `${config.primaryColor}22` : "#0f172a", color: "#f1f5f9",
                }}>{c.name} <span style={{ color: "#64748b" }}>({c.minutes}m)</span></button>
              ))}
            </div>
            <button onClick={startWash} style={{
              width: "100%", padding: "13px 0", borderRadius: 12, border: "none", cursor: "pointer",
              background: config.primaryColor, color: "#fff", fontWeight: 700, fontSize: 15,
            }}>▶ Start {config.washCycles[cycle].name}</button>
          </div>
        )}

        {/* Schedule */}
        <div style={card}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <I.Cal s={16} /> Schedule a Wash
          </h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <input type="date" value={sDate} onChange={e => setSDate(e.target.value)} style={inp} />
            <input type="time" value={sTime} onChange={e => setSTime(e.target.value)} style={inp} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {config.washCycles.map((c, i) => (
              <button key={i} onClick={() => setCycle(i)} style={{
                padding: "5px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500,
                border: cycle === i ? `2px solid ${config.accentColor}` : "1px solid #475569",
                background: cycle === i ? `${config.accentColor}22` : "transparent", color: "#cbd5e1",
              }}>{c.name}</button>
            ))}
          </div>
          <button onClick={addSched} style={{
            width: "100%", padding: "12px 0", borderRadius: 10, border: "none", cursor: "pointer",
            background: config.accentColor, color: "#0f172a", fontWeight: 700, fontSize: 14,
          }}>📅 Schedule</button>
        </div>

        {/* Upcoming */}
        <div style={card}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <I.Clock s={16} /> Upcoming Washes
          </h3>
          {schedule.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: 13, textAlign: "center", padding: 12 }}>No washes scheduled yet</p>
          ) : schedule.map(s => (
            <div key={s.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "11px 14px", borderRadius: 10, background: "#0f172a", marginBottom: 6,
              border: s.userId === user.id ? `1px solid ${config.primaryColor}33` : "1px solid transparent",
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {s.userName} {s.userId === user.id && <span style={{ color: config.primaryColor, fontSize: 11 }}>(you)</span>}
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  {s.cycleName} · {s.minutes}m · {fmt(s.dateTime)}
                </div>
              </div>
              {s.userId === user.id && (
                <button onClick={() => DB.removeScheduleEntry(s.id)} style={{
                  background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 4,
                }}><I.Trash s={15} /></button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   ADMIN DASHBOARD
   ════════════════════════════════════════════════════════════════ */
function AdminDash({ config, setConfig, onLogout, toast }) {
  const [users, setUsers] = useState([]);
  const [machine, setMachine] = useState({ running: false });
  const [schedule, setSchedule] = useState([]);
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [tab, setTab] = useState("users");
  const [espIp, setEspIp] = useState(config.esp32Ip);
  const [colP, setColP] = useState(config.primaryColor);
  const [colA, setColA] = useState(config.accentColor);
  const [appN, setAppN] = useState(config.appName);
  const [alertM, setAlertM] = useState(config.alertMinutesBefore);
  const [testMsg, setTestMsg] = useState("");

  useEffect(() => {
    const u1 = DB.onUsersChange(setUsers);
    const u2 = DB.onMachineChange(setMachine);
    const u3 = DB.onScheduleChange(setSchedule);
    return () => { u1(); u2(); u3(); };
  }, []);

  const addUser = async () => {
    if (!newName.trim() || !newPin.trim()) return toast("Name and PIN required", "error");
    if (newPin.trim().length < 4) return toast("PIN must be 4 digits", "error");
    if (users.length >= 10) return toast("Max 10 users", "error");
    if (users.find(u => u.name.toLowerCase() === newName.trim().toLowerCase()))
      return toast("User already exists", "error");
    try {
      await DB.addUser({ id: Date.now().toString(), name: newName.trim(), pin: newPin.trim(), created: new Date().toISOString() });
      setNewName(""); setNewPin("");
      toast(`✅ ${newName.trim()} added!`, "success");
    } catch (e) { toast("Failed to add user", "error"); }
  };

  const saveUiConfig = async () => {
    const updated = { ...config, primaryColor: colP, accentColor: colA, appName: appN, esp32Ip: espIp, alertMinutesBefore: Number(alertM) || 5 };
    try {
      await DB.setConfig(updated);
      setConfig(updated);
      toast("⚙️ Config saved!", "success");
    } catch (e) { toast("Failed to save config", "error"); }
  };

  const testEsp = () => {
    setTestMsg("Pinging...");
    setTimeout(() => setTestMsg(`ESP32 at ${espIp} — in production this sends GET /status. See setup guide.`), 1500);
  };

  const card = { background: "#1e293b", borderRadius: 16, padding: 24, border: "1px solid #334155" };
  const inp = {
    padding: "10px 14px", borderRadius: 10, border: "2px solid #334155",
    background: "#0f172a", color: "#f1f5f9", fontSize: 14, width: "100%",
  };
  const tabs = [
    { id: "users", label: "Users", icon: <I.Users s={14} /> },
    { id: "machine", label: "Machine", icon: <I.Power s={14} /> },
    { id: "esp32", label: "ESP32", icon: <I.Wifi s={14} /> },
    { id: "ui", label: "UI Config", icon: <I.Gear s={14} /> },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a" }}>
      <Header config={config} name="Admin" isAdmin onLogout={onLogout} />
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px" }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "9px 16px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600,
              border: tab === t.id ? `2px solid ${config.primaryColor}` : "1px solid #334155",
              background: tab === t.id ? `${config.primaryColor}22` : "transparent",
              color: tab === t.id ? "#f1f5f9" : "#94a3b8",
              display: "flex", alignItems: "center", gap: 6,
            }}>{t.icon}{t.label}</button>
          ))}
        </div>

        {/* USERS */}
        {tab === "users" && (
          <div style={card}>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>Users ({users.length})</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name" style={{ ...inp, flex: 2, minWidth: 120 }} />
              <input value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="4-digit PIN" maxLength={4} style={{ ...inp, flex: 1, minWidth: 90 }} />
              <button onClick={addUser} style={{
                padding: "10px 18px", borderRadius: 10, border: "none", cursor: "pointer",
                background: config.primaryColor, color: "#fff", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap",
              }}>+ Add</button>
            </div>
            {users.map(u => (
              <div key={u.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 14px", borderRadius: 10, background: "#0f172a", marginBottom: 6,
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>PIN: {u.pin} · {new Date(u.created).toLocaleDateString()}</div>
                </div>
                <button onClick={() => { DB.removeUser(u.id); toast("Removed", "info"); }} style={{
                  background: "#dc262622", border: "none", borderRadius: 8, padding: "5px 10px",
                  color: "#ef4444", cursor: "pointer", fontSize: 12, fontWeight: 600,
                }}>Remove</button>
              </div>
            ))}
            {users.length === 0 && <p style={{ color: "#64748b", textAlign: "center", padding: 16, fontSize: 13 }}>No users yet</p>}
          </div>
        )}

        {/* MACHINE */}
        {tab === "machine" && (
          <div style={card}>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>Machine Control</h3>
            <div style={{
              padding: 16, borderRadius: 12, background: "#0f172a", marginBottom: 16,
              border: `1px solid ${machine?.running ? "#dc262644" : "#22c55e44"}`,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                {machine?.running ? `🔴 Running — ${machine.userName} (${machine.cycleName})` : "🟢 Idle"}
              </div>
              {machine?.running && (
                <button onClick={() => { sendToEsp32(config.esp32Ip, "off"); DB.setMachine({ running: false }); toast("Force stopped", "warning"); }} style={{
                  marginTop: 10, padding: "9px 20px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: "#dc2626", color: "#fff", fontWeight: 600, fontSize: 13,
                }}>⚠ Force Stop</button>
              )}
            </div>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Scheduled Washes</h4>
            {schedule.length > 0 ? (
              <>
                {schedule.map(s => (
                  <div key={s.id} style={{ padding: "9px 12px", borderRadius: 8, background: "#0f172a", marginBottom: 4, fontSize: 13 }}>
                    <strong>{s.userName}</strong> — {s.cycleName} · {new Date(s.dateTime).toLocaleString()}
                  </div>
                ))}
                <button onClick={() => { DB.clearSchedule(); toast("Cleared", "info"); }} style={{
                  marginTop: 10, padding: "8px 14px", borderRadius: 8, border: "1px solid #dc262644",
                  background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 12, fontWeight: 600,
                }}>Clear All</button>
              </>
            ) : <p style={{ color: "#64748b", fontSize: 13 }}>No upcoming washes</p>}
          </div>
        )}

        {/* ESP32 */}
        {tab === "esp32" && (
          <div style={card}>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>ESP32 Connection</h3>
            <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>ESP32 IP Address</label>
            <input value={espIp} onChange={e => setEspIp(e.target.value)} style={{ ...inp, marginBottom: 12 }} placeholder="192.168.1.100" />
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button onClick={testEsp} style={{
                padding: "10px 18px", borderRadius: 10, border: "none", cursor: "pointer",
                background: config.primaryColor, color: "#fff", fontWeight: 600, fontSize: 13,
              }}>Test</button>
              <button onClick={saveUiConfig} style={{
                padding: "10px 18px", borderRadius: 10, border: "1px solid #334155", cursor: "pointer",
                background: "transparent", color: "#f1f5f9", fontWeight: 600, fontSize: 13,
              }}>Save IP</button>
            </div>
            {testMsg && <div style={{ padding: 12, borderRadius: 10, background: "#0f172a", fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>{testMsg}</div>}

            <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: "#0f172a", border: "1px solid #334155" }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>🔧 Wiring Guide</h4>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.9 }}>
                <div><strong style={{ color: "#f1f5f9" }}>ESP32 GPIO 26</strong> → Relay IN</div>
                <div><strong style={{ color: "#f1f5f9" }}>ESP32 GND</strong> → Relay GND</div>
                <div><strong style={{ color: "#f1f5f9" }}>ESP32 VIN (5V)</strong> → Relay VCC</div>
                <div><strong style={{ color: "#f1f5f9" }}>Relay COM</strong> → Mains Live (from breaker)</div>
                <div><strong style={{ color: "#f1f5f9" }}>Relay NO</strong> → Washing Machine Live</div>
                <div style={{ marginTop: 6, color: "#f59e0b", fontWeight: 600 }}>⚠ Disconnect mains before wiring. Use 230V/10A rated relay.</div>
              </div>
            </div>
          </div>
        )}

        {/* UI CONFIG */}
        {tab === "ui" && (
          <div style={card}>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>UI Configuration</h3>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>App Name</label>
                <input value={appN} onChange={e => setAppN(e.target.value)} style={inp} />
              </div>
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>Primary Color</label>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="color" value={colP} onChange={e => setColP(e.target.value)} style={{ width: 44, height: 36, border: "none", borderRadius: 8, cursor: "pointer" }} />
                    <input value={colP} onChange={e => setColP(e.target.value)} style={inp} />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>Accent Color</label>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="color" value={colA} onChange={e => setColA(e.target.value)} style={{ width: 44, height: 36, border: "none", borderRadius: 8, cursor: "pointer" }} />
                    <input value={colA} onChange={e => setColA(e.target.value)} style={inp} />
                  </div>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>Alert before wash ends (minutes)</label>
                <input type="number" value={alertM} onChange={e => setAlertM(e.target.value)} style={inp} min="1" max="15" />
              </div>
              <div style={{ padding: 12, borderRadius: 10, background: "#0f172a" }}>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Preview</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 48, height: 28, borderRadius: 6, background: colP }}></div>
                  <div style={{ width: 48, height: 28, borderRadius: 6, background: colA }}></div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: colP }}>{appN}</span>
                </div>
              </div>
              <button onClick={saveUiConfig} style={{
                width: "100%", padding: "13px 0", borderRadius: 12, border: "none", cursor: "pointer",
                background: config.primaryColor, color: "#fff", fontWeight: 700, fontSize: 15,
              }}>💾 Save Config</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN APP
   ════════════════════════════════════════════════════════════════ */
export default function Home() {
  const [session, setSession] = useState(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [toastData, setToastData] = useState(null);
  const [ready, setReady] = useState(false);

  const toast = useCallback((message, type) => setToastData({ message, type, key: Date.now() }), []);

  // Load config from Firebase on mount + listen for changes
  useEffect(() => {
    const unsub = DB.onConfigChange((c) => {
      if (c) setConfig(prev => ({ ...DEFAULT_CONFIG, ...c }));
      setReady(true);
    });
    return () => unsub();
  }, []);

  if (!ready) return (
    <div style={{
      minHeight: "100vh", background: "#0f172a", display: "flex",
      alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif",
    }}>
      <GlobalStyles primary={config.primaryColor} />
      <div style={{ color: "#64748b", animation: "pulse 1.5s infinite", textAlign: "center" }}>
        <I.Drop s={40} c={config.primaryColor} />
        <div style={{ marginTop: 12 }}>Connecting...</div>
      </div>
    </div>
  );

  return (
    <>
      <GlobalStyles primary={config.primaryColor} />
      {toastData && <Toast {...toastData} onClose={() => setToastData(null)} />}
      {!session ? (
        <LoginScreen config={config} onLogin={setSession} />
      ) : session.role === "admin" ? (
        <AdminDash config={config} setConfig={setConfig} onLogout={() => setSession(null)} toast={toast} />
      ) : (
        <UserDash user={session} config={config} onLogout={() => setSession(null)} toast={toast} />
      )}
    </>
  );
}
