"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import DB from "./firebase";

const DEFAULT_CONFIG = {
  primaryColor: "#0D9488",
  accentColor: "#F59E0B",
  appName: "LaundryHub",
  esp32Ip: "192.168.1.100",
  washCycles: [
    { name: "Quick Wash", minutes: 30, icon: "⚡" },
    { name: "Normal", minutes: 45, icon: "👕" },
    { name: "Heavy Duty", minutes: 60, icon: "💪" },
    { name: "Delicates", minutes: 25, icon: "🧶" },
    { name: "Bedding", minutes: 75, icon: "🛏️" },
  ],
  alertMinutesBefore: 5,
};
const ADMIN_PASSWORD = "1234";
const EMOJI_OPTIONS = ["😊","😎","🧑‍💻","👩‍🔧","🧑‍🎓","👨‍🍳","🦊","🐱","🐶","🦁","🐸","🦄","🌻","🔥","⚡","🎮","🎵","🏀","🌊","🚀","💎","🍕","🎯","🤖"];

async function sendToEsp32(ip, command) {
  if (!ip || ip === "192.168.1.100") return;
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 5000);
    await fetch(`http://${ip}/${command}`, { signal: c.signal, mode: "no-cors" });
    clearTimeout(t);
  } catch (e) { console.warn(`[ESP32] ${e.message}`); }
}

async function checkEsp32(ip) {
  if (!ip || ip === "192.168.1.100") return false;
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 3000);
    await fetch(`http://${ip}/status`, { signal: c.signal, mode: "no-cors" });
    clearTimeout(t);
    return true;
  } catch { return false; }
}

function GS({ primary }) {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap');
    @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
    @keyframes slideIn{from{transform:translateX(100px);opacity:0}to{transform:translateX(0);opacity:1}}
    @keyframes fadeUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
    @keyframes ripple{0%{box-shadow:0 0 0 0 ${primary}55}100%{box-shadow:0 0 0 24px ${primary}00}}
    @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
    @keyframes glow{0%,100%{filter:brightness(1)}50%{filter:brightness(1.3)}}
    @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Outfit',sans-serif;background:#080c14;color:#e2e8f0}
    input:focus,button:focus{outline:none}
    button,input,select{font-family:'Outfit',sans-serif}
    ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#0f1729}::-webkit-scrollbar-thumb{background:#334155;border-radius:3px}
    .card{background:linear-gradient(135deg,#111827 0%,#0f1729 100%);border-radius:16px;padding:20px;border:1px solid #1e293b;transition:border-color .3s}
    .card:hover{border-color:#334155}
    .btn{padding:10px 20px;border-radius:10px;border:none;cursor:pointer;font-weight:600;font-size:14px;transition:all .15s}
    .btn:active{transform:scale(.97)}
    .inp{padding:11px 14px;border-radius:10px;border:1.5px solid #1e293b;background:#080c14;color:#e2e8f0;font-size:14px;width:100%;transition:border-color .2s}
    .inp:focus{border-color:${primary}}
    .pill{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600}
    .mono{font-family:'JetBrains Mono',monospace}
    .stat-card{background:#0f1729;border-radius:12px;padding:14px;border:1px solid #1e293b}
    .avatar{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
  `}</style>;
}

function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  const bg = { success:"#059669", error:"#dc2626", warning:"#d97706", info:"#0ea5e9" }[type] || "#0ea5e9";
  return <div style={{ position:"fixed",top:16,right:16,left:16,zIndex:9999,padding:"12px 18px",background:bg,color:"#fff",borderRadius:14,fontSize:13,fontWeight:600,boxShadow:`0 8px 32px ${bg}44`,animation:"slideIn .3s ease",display:"flex",alignItems:"center",gap:8,maxWidth:380,margin:"0 auto" }}>
    🔔 {message}
  </div>;
}

function WashAnim({ running, progress, color }) {
  return <div style={{ width:150,height:150,borderRadius:"50%",position:"relative",background:`conic-gradient(${color} ${progress*360}deg,#1e293b ${progress*360}deg)`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:running?`0 0 50px ${color}33`:"none",transition:"box-shadow .5s",animation:running?"ripple 2s infinite":"none" }}>
    <div style={{ width:126,height:126,borderRadius:"50%",background:"#080c14",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column" }}>
      {running ? <div style={{ animation:"spin 2s linear infinite",fontSize:32 }}>💧</div> : <span style={{ fontSize:32,opacity:.4 }}>⏻</span>}
      <div className="mono" style={{ fontSize:12,color:"#94a3b8",marginTop:6,letterSpacing:1 }}>{running?`${Math.round(progress*100)}%`:"IDLE"}</div>
    </div>
  </div>;
}

function EspStatus({ ip }) {
  const [online, setOnline] = useState(null);
  useEffect(() => {
    const check = () => checkEsp32(ip).then(setOnline);
    check();
    const iv = setInterval(check, 10000);
    return () => clearInterval(iv);
  }, [ip]);
  return <div className="pill" style={{ background: online === null ? "#334155" : online ? "#05966922" : "#dc262622", color: online === null ? "#94a3b8" : online ? "#34d399" : "#f87171" }}>
    <span style={{ width:6,height:6,borderRadius:"50%",background:"currentColor",animation:online?"glow 2s infinite":"none" }}/> {online === null ? "Checking..." : online ? "ESP32 online" : "ESP32 offline"}
  </div>;
}

// ═══════════════════════ LOGIN ═══════════════════════
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
        if (password === ADMIN_PASSWORD) { onLogin({ role:"admin", name:"Admin", emoji:"🛡️" }); return; }
        else setError("Wrong admin password");
      } else {
        const users = await DB.getUsers();
        const user = users.find(u => u.name.toLowerCase() === username.trim().toLowerCase() && u.pin === password);
        if (user) { onLogin({ role:"user", ...user }); return; }
        else setError("Invalid name or PIN");
      }
    } catch (e) { setError("Connection error"); }
    setLoading(false);
  };

  return <div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#080c14",padding:20 }}>
    <div style={{ width:"100%",maxWidth:380,animation:"fadeUp .5s ease" }}>
      <div style={{ textAlign:"center",marginBottom:28 }}>
        <div style={{ fontSize:48,marginBottom:8 }}>🫧</div>
        <h1 style={{ fontSize:28,fontWeight:800,letterSpacing:-1,background:`linear-gradient(135deg,${config.primaryColor},${config.accentColor})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>{config.appName}</h1>
        <p style={{ color:"#64748b",fontSize:13,marginTop:2 }}>Smart shared laundry</p>
      </div>
      <div className="card" style={{ padding:"28px 24px" }}>
        <div style={{ display:"flex",gap:6,marginBottom:20 }}>
          {["user","admin"].map(m => <button key={m} onClick={()=>{setMode(m);setError("")}} className="btn" style={{ flex:1,background:mode===m?config.primaryColor:"#1e293b",color:"#fff",fontSize:13 }}>{m==="admin"?"🛡️ Admin":"👤 User"}</button>)}
        </div>
        {mode==="user" && <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Your name" className="inp" style={{ marginBottom:8 }}/>}
        <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder={mode==="admin"?"Admin password":"Your PIN"} onKeyDown={e=>e.key==="Enter"&&handleLogin()} className="inp" style={{ marginBottom:6 }}/>
        {error && <p style={{ color:"#ef4444",fontSize:12,fontWeight:500,marginBottom:4 }}>{error}</p>}
        <button onClick={handleLogin} disabled={loading} className="btn" style={{ width:"100%",marginTop:10,padding:"13px 0",background:loading?"#475569":config.primaryColor,color:"#fff",fontSize:15,fontWeight:700 }}>{loading?"Signing in...":"Sign In"}</button>
      </div>
    </div>
  </div>;
}

// ═══════════════════════ USER PROFILE MODAL ═══════════════════════
function ProfileModal({ user, config, onClose, toast }) {
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [emoji, setEmoji] = useState(user.emoji || "😊");
  const [dnd, setDnd] = useState(user.dnd || false);

  const save = async () => {
    const updates = { ...user, emoji, dnd };
    if (pin && pin.length >= 4 && pin === pin2) updates.pin = pin;
    else if (pin && pin !== pin2) return toast("PINs don't match", "error");
    await DB.addUser(updates);
    toast("Profile updated!", "success");
    onClose(updates);
  };

  return <div style={{ position:"fixed",inset:0,zIndex:9998,background:"#000a",display:"flex",alignItems:"center",justifyContent:"center",padding:16 }} onClick={onClose}>
    <div className="card" style={{ width:"100%",maxWidth:400,padding:28,animation:"fadeUp .3s ease" }} onClick={e=>e.stopPropagation()}>
      <h3 style={{ fontSize:18,fontWeight:700,marginBottom:20 }}>Your profile</h3>
      <div style={{ textAlign:"center",marginBottom:20 }}>
        <div style={{ width:72,height:72,borderRadius:"50%",background:`${config.primaryColor}22`,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:36,border:`2px solid ${config.primaryColor}44` }}>{emoji}</div>
        <div style={{ fontSize:14,fontWeight:600,marginTop:8 }}>{user.name}</div>
      </div>
      <label style={{ fontSize:12,color:"#94a3b8",display:"block",marginBottom:6 }}>Choose your avatar</label>
      <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:16 }}>
        {EMOJI_OPTIONS.map(e => <button key={e} onClick={()=>setEmoji(e)} style={{ width:36,height:36,borderRadius:8,border:emoji===e?`2px solid ${config.primaryColor}`:"2px solid #1e293b",background:emoji===e?`${config.primaryColor}22`:"#0f1729",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>{e}</button>)}
      </div>
      <label style={{ fontSize:12,color:"#94a3b8",display:"block",marginBottom:6 }}>Change PIN (leave empty to keep current)</label>
      <input value={pin} onChange={e=>setPin(e.target.value)} type="password" placeholder="New PIN" maxLength={6} className="inp" style={{ marginBottom:6 }}/>
      <input value={pin2} onChange={e=>setPin2(e.target.value)} type="password" placeholder="Confirm new PIN" maxLength={6} className="inp" style={{ marginBottom:16 }}/>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",borderRadius:10,background:"#0f1729",marginBottom:16 }}>
        <div><div style={{ fontSize:13,fontWeight:600 }}>🔕 Do Not Disturb</div><div style={{ fontSize:11,color:"#64748b" }}>Mute wash notifications</div></div>
        <div onClick={()=>setDnd(!dnd)} style={{ width:40,height:22,borderRadius:11,background:dnd?config.primaryColor:"#334155",cursor:"pointer",position:"relative",transition:"background .2s" }}>
          <div style={{ width:18,height:18,borderRadius:9,background:"#fff",position:"absolute",top:2,left:dnd?20:2,transition:"left .2s" }}/>
        </div>
      </div>
      <div style={{ display:"flex",gap:8 }}>
        <button onClick={onClose} className="btn" style={{ flex:1,background:"#1e293b",color:"#94a3b8" }}>Cancel</button>
        <button onClick={save} className="btn" style={{ flex:1,background:config.primaryColor,color:"#fff" }}>Save</button>
      </div>
    </div>
  </div>;
}

// ═══════════════════════ HEADER ═══════════════════════
function Header({ config, user, isAdmin, onLogout, onProfile }) {
  return <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:"1px solid #1e293b",flexWrap:"wrap",gap:8 }}>
    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
      <span style={{ fontSize:22 }}>🫧</span>
      <span style={{ fontWeight:800,fontSize:17,letterSpacing:-.5 }}>{isAdmin?"Admin Panel":config.appName}</span>
    </div>
    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
      <EspStatus ip={config.esp32Ip}/>
      {!isAdmin && <button onClick={onProfile} style={{ background:"none",border:"none",cursor:"pointer",fontSize:20 }}>{user.emoji||"😊"}</button>}
      <span style={{ color:"#94a3b8",fontSize:12 }}>{user.name}</span>
      <button onClick={onLogout} className="btn" style={{ background:"#1e293b",color:"#94a3b8",padding:"5px 10px",fontSize:11 }}>Sign Out</button>
    </div>
  </div>;
}

// ═══════════════════════ USER DASHBOARD ═══════════════════════
function UserDash({ user: initUser, config, onLogout, toast }) {
  const [user, setUser] = useState(initUser);
  const [machine, setMachine] = useState({ running: false });
  const [schedule, setSchedule] = useState([]);
  const [users, setUsers] = useState([]);
  const [cycle, setCycle] = useState(0);
  const [sDate, setSDate] = useState("");
  const [sTime, setSTime] = useState("");
  const [now, setNow] = useState(Date.now());
  const [showProfile, setShowProfile] = useState(false);
  const [history, setHistory] = useState([]);
  const alertFired = useRef(false);
  const prevRunning = useRef(false);

  useEffect(() => {
    const u1 = DB.onMachineChange(setMachine);
    const u2 = DB.onScheduleChange(setSchedule);
    const u3 = DB.onUsersChange(setUsers);
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => { u1(); u2(); u3(); clearInterval(iv); };
  }, []);

  // Notify all users when a wash finishes
  useEffect(() => {
    if (prevRunning.current && !machine?.running) {
      if (!user.dnd && "Notification" in window && Notification.permission === "granted") {
        new Notification("LaundryHub", { body: "A wash just finished — machine is free! 🧺" });
      }
      if (!user.dnd) toast("🧺 Machine is now free!", "info");
    }
    prevRunning.current = machine?.running || false;
  }, [machine?.running, user.dnd, toast]);

  // Alert + auto-stop for own wash
  useEffect(() => {
    if (!machine?.running || machine.userId !== user.id) return;
    const endTime = machine.startTime + machine.durationMs;
    const alertTime = endTime - config.alertMinutesBefore * 60000;
    if (now >= alertTime && now < endTime && !alertFired.current) {
      alertFired.current = true;
      toast(`⏰ Wash finishes in ~${config.alertMinutesBefore} min!`, "warning");
      if ("Notification" in window && Notification.permission === "granted") new Notification("LaundryHub", { body: `Your wash finishes in ~${config.alertMinutesBefore} minutes!` });
    }
    if (now >= endTime) {
      sendToEsp32(config.esp32Ip, "off");
      DB.setMachine({ running: false, lastUser: machine.userName, lastCycle: machine.cycleName, finishedAt: Date.now() });
      toast("✅ Wash cycle complete!", "success");
      alertFired.current = false;
    }
  }, [now, machine, user.id, config, toast]);

  useEffect(() => { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); }, []);

  const isMyWash = machine?.running && machine.userId === user.id;
  const isBusy = machine?.running && machine.userId !== user.id;
  const progress = machine?.running ? Math.min(1, (now - machine.startTime) / machine.durationMs) : 0;
  const remainMs = machine?.running ? Math.max(0, (machine.startTime + machine.durationMs) - now) : 0;
  const remainMin = Math.ceil(remainMs / 60000);
  const remainSec = Math.floor((remainMs % 60000) / 1000);

  const startWash = async () => {
    if (machine?.running) return;
    const c = config.washCycles[cycle];
    await sendToEsp32(config.esp32Ip, "on");
    await DB.setMachine({ running: true, userId: user.id, userName: user.name, cycleName: c.name, startTime: Date.now(), durationMs: c.minutes * 60000 });
    alertFired.current = false;
    toast(`${c.icon} ${c.name} started — ${c.minutes} min`, "success");
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
    await DB.addScheduleEntry({ id: Date.now().toString(), userId: user.id, userName: user.name, userEmoji: user.emoji || "😊", cycleName: c.name, minutes: c.minutes, dateTime: `${sDate}T${sTime}` });
    setSDate(""); setSTime("");
    toast("📅 Scheduled!", "success");
  };

  const fmt = dt => { const d = new Date(dt); return d.toLocaleDateString("en-GB", { weekday:"short",day:"numeric",month:"short" }) + " " + d.toLocaleTimeString("en-GB", { hour:"2-digit",minute:"2-digit" }); };
  const busyUser = users.find(u => u.id === machine?.userId);

  return <div style={{ minHeight:"100vh",background:"#080c14" }}>
    <Header config={config} user={user} onLogout={onLogout} onProfile={()=>setShowProfile(true)}/>
    {showProfile && <ProfileModal user={user} config={config} onClose={u=>{if(u?.id)setUser(u);setShowProfile(false)}} toast={toast}/>}
    <div style={{ maxWidth:680,margin:"0 auto",padding:"16px 14px" }}>
      {/* Machine Status */}
      <div className="card" style={{ display:"flex",flexDirection:"column",alignItems:"center",padding:28,marginBottom:16,borderColor:isBusy?"#dc262633":isMyWash?`${config.primaryColor}44`:"#1e293b" }}>
        <WashAnim running={machine?.running} progress={progress} color={config.primaryColor}/>
        {machine?.running ? <div style={{ textAlign:"center",marginTop:16 }}>
          <div className="pill" style={{ background:isBusy?"#dc262622":`${config.primaryColor}22`,color:isBusy?"#f87171":config.primaryColor,marginBottom:8 }}>
            {isBusy ? "🔒 IN USE" : "YOUR WASH"}
          </div>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:4 }}>
            {busyUser && <div className="avatar" style={{ width:28,height:28,fontSize:14,background:`${config.primaryColor}22` }}>{busyUser.emoji||"😊"}</div>}
            <span style={{ fontSize:16,fontWeight:700 }}>{machine.userName}</span>
          </div>
          <div style={{ fontSize:18,fontWeight:700 }}>{machine.cycleName}</div>
          <div className="mono" style={{ color:"#94a3b8",fontSize:22,marginTop:4,fontWeight:500 }}>{remainMin}:{String(remainSec).padStart(2,"0")}</div>
          {isMyWash && <button onClick={stopWash} className="btn" style={{ marginTop:12,background:"#dc2626",color:"#fff" }}>⏹ Stop</button>}
        </div> : <div style={{ textAlign:"center",marginTop:16 }}>
          <div className="pill" style={{ background:"#05966922",color:"#34d399" }}>● AVAILABLE</div>
          {machine?.lastUser && <div style={{ fontSize:11,color:"#64748b",marginTop:6 }}>Last wash: {machine.lastUser} ({machine.lastCycle})</div>}
        </div>}
      </div>

      {/* Start Wash */}
      {!machine?.running && <div className="card" style={{ marginBottom:16 }}>
        <h3 style={{ fontSize:15,fontWeight:700,marginBottom:12 }}>⚡ Start a wash</h3>
        <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:12 }}>
          {config.washCycles.map((c,i) => <button key={i} onClick={()=>setCycle(i)} className="btn" style={{ background:cycle===i?`${config.primaryColor}22`:"#0f1729",color:"#e2e8f0",border:cycle===i?`2px solid ${config.primaryColor}`:"2px solid #1e293b",fontSize:12,padding:"8px 12px" }}>
            {c.icon} {c.name} <span style={{ color:"#64748b" }}>({c.minutes}m)</span>
          </button>)}
        </div>
        <button onClick={startWash} className="btn" style={{ width:"100%",padding:"13px 0",background:config.primaryColor,color:"#fff",fontSize:15,fontWeight:700 }}>▶ Start {config.washCycles[cycle].name}</button>
      </div>}

      {/* Schedule */}
      <div className="card" style={{ marginBottom:16 }}>
        <h3 style={{ fontSize:15,fontWeight:700,marginBottom:12 }}>📅 Schedule a wash</h3>
        <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:8 }}>
          <input type="date" value={sDate} onChange={e=>setSDate(e.target.value)} className="inp" style={{ flex:1,minWidth:130 }}/>
          <input type="time" value={sTime} onChange={e=>setSTime(e.target.value)} className="inp" style={{ flex:1,minWidth:110 }}/>
        </div>
        <div style={{ display:"flex",flexWrap:"wrap",gap:4,marginBottom:10 }}>
          {config.washCycles.map((c,i) => <button key={i} onClick={()=>setCycle(i)} style={{ padding:"4px 10px",borderRadius:8,fontSize:11,cursor:"pointer",fontWeight:500,border:cycle===i?`1.5px solid ${config.accentColor}`:"1px solid #334155",background:cycle===i?`${config.accentColor}22`:"transparent",color:"#cbd5e1",fontFamily:"'Outfit',sans-serif" }}>{c.icon} {c.name}</button>)}
        </div>
        <button onClick={addSched} className="btn" style={{ width:"100%",background:config.accentColor,color:"#0f172a",fontWeight:700 }}>📅 Schedule</button>
      </div>

      {/* Upcoming */}
      <div className="card" style={{ marginBottom:16 }}>
        <h3 style={{ fontSize:15,fontWeight:700,marginBottom:12 }}>🕐 Upcoming washes</h3>
        {schedule.length === 0 ? <p style={{ color:"#475569",fontSize:13,textAlign:"center",padding:12 }}>No washes scheduled</p> : schedule.map(s => <div key={s.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",borderRadius:10,background:"#0f1729",marginBottom:4,border:s.userId===user.id?`1px solid ${config.primaryColor}33`:"1px solid transparent" }}>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <span style={{ fontSize:16 }}>{s.userEmoji || "😊"}</span>
            <div>
              <div style={{ fontSize:13,fontWeight:600 }}>{s.userName} {s.userId===user.id && <span style={{ color:config.primaryColor,fontSize:10 }}>(you)</span>}</div>
              <div style={{ fontSize:11,color:"#64748b" }}>{s.cycleName} · {s.minutes}m · {fmt(s.dateTime)}</div>
            </div>
          </div>
          {s.userId===user.id && <button onClick={()=>DB.removeScheduleEntry(s.id)} style={{ background:"none",border:"none",cursor:"pointer",color:"#ef4444",fontSize:14 }}>✕</button>}
        </div>)}
      </div>

      {/* Housemates */}
      <div className="card">
        <h3 style={{ fontSize:15,fontWeight:700,marginBottom:12 }}>🏠 Housemates</h3>
        <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
          {users.map(u => <div key={u.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:10,background:"#0f1729",flex:"1 1 140px",minWidth:140 }}>
            <div className="avatar" style={{ width:32,height:32,fontSize:16,background:u.id===machine?.userId?`${config.primaryColor}33`:"#1e293b" }}>{u.emoji||"😊"}</div>
            <div>
              <div style={{ fontSize:12,fontWeight:600 }}>{u.name}</div>
              <div style={{ fontSize:10,color:u.id===machine?.userId?"#34d399":u.dnd?"#f59e0b":"#475569" }}>{u.id===machine?.userId?"Washing now":u.dnd?"🔕 DND":"Available"}</div>
            </div>
          </div>)}
        </div>
      </div>
    </div>
  </div>;
}

// ═══════════════════════ ADMIN DASHBOARD ═══════════════════════
function AdminDash({ config, setConfig, onLogout, toast }) {
  const [users, setUsers] = useState([]);
  const [machine, setMachine] = useState({ running: false });
  const [schedule, setSchedule] = useState([]);
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [tab, setTab] = useState("dashboard");
  const [espIp, setEspIp] = useState(config.esp32Ip);
  const [colP, setColP] = useState(config.primaryColor);
  const [colA, setColA] = useState(config.accentColor);
  const [appN, setAppN] = useState(config.appName);
  const [alertM, setAlertM] = useState(config.alertMinutesBefore);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const u1 = DB.onUsersChange(setUsers);
    const u2 = DB.onMachineChange(setMachine);
    const u3 = DB.onScheduleChange(setSchedule);
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => { u1(); u2(); u3(); clearInterval(iv); };
  }, []);

  const addUser = async () => {
    if (!newName.trim() || !newPin.trim()) return toast("Name and PIN required", "error");
    if (newPin.length < 4) return toast("PIN must be 4+ digits", "error");
    if (users.find(u => u.name.toLowerCase() === newName.trim().toLowerCase())) return toast("User exists", "error");
    await DB.addUser({ id: Date.now().toString(), name: newName.trim(), pin: newPin.trim(), emoji: "😊", dnd: false, created: new Date().toISOString() });
    setNewName(""); setNewPin("");
    toast(`✅ ${newName.trim()} added!`, "success");
  };

  const saveConfig = async () => {
    const u = { ...config, primaryColor:colP, accentColor:colA, appName:appN, esp32Ip:espIp, alertMinutesBefore:Number(alertM)||5 };
    await DB.setConfig(u); setConfig(u);
    toast("⚙️ Config saved!", "success");
  };

  const progress = machine?.running ? Math.min(1, (now - machine.startTime) / machine.durationMs) : 0;
  const remainMs = machine?.running ? Math.max(0, (machine.startTime + machine.durationMs) - now) : 0;
  const remainMin = Math.ceil(remainMs / 60000);

  const tabs = [
    { id:"dashboard",label:"Dashboard",icon:"📊" },
    { id:"users",label:"Users",icon:"👥" },
    { id:"machine",label:"Machine",icon:"⚡" },
    { id:"esp32",label:"ESP32",icon:"📡" },
    { id:"settings",label:"Settings",icon:"⚙️" },
  ];

  return <div style={{ minHeight:"100vh",background:"#080c14" }}>
    <Header config={config} user={{ name:"Admin",emoji:"🛡️" }} isAdmin onLogout={onLogout}/>
    <div style={{ maxWidth:720,margin:"0 auto",padding:"16px 14px" }}>
      {/* Tabs */}
      <div style={{ display:"flex",gap:4,marginBottom:16,flexWrap:"wrap" }}>
        {tabs.map(t => <button key={t.id} onClick={()=>setTab(t.id)} className="btn" style={{ background:tab===t.id?`${config.primaryColor}22`:"transparent",color:tab===t.id?"#e2e8f0":"#64748b",border:tab===t.id?`1.5px solid ${config.primaryColor}`:"1.5px solid transparent",fontSize:12,padding:"8px 14px" }}>{t.icon} {t.label}</button>)}
      </div>

      {/* DASHBOARD */}
      {tab === "dashboard" && <>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16 }}>
          <div className="stat-card"><div style={{ fontSize:11,color:"#64748b" }}>Users</div><div style={{ fontSize:24,fontWeight:700 }}>{users.length}</div></div>
          <div className="stat-card"><div style={{ fontSize:11,color:"#64748b" }}>Scheduled</div><div style={{ fontSize:24,fontWeight:700 }}>{schedule.length}</div></div>
          <div className="stat-card"><div style={{ fontSize:11,color:"#64748b" }}>Machine</div><div style={{ fontSize:24,fontWeight:700,color:machine?.running?"#34d399":"#94a3b8" }}>{machine?.running?"ON":"OFF"}</div></div>
        </div>

        {/* Live machine status */}
        <div className="card" style={{ marginBottom:16,display:"flex",alignItems:"center",gap:16,borderColor:machine?.running?`${config.primaryColor}44`:"#1e293b" }}>
          <WashAnim running={machine?.running} progress={progress} color={config.primaryColor}/>
          <div style={{ flex:1 }}>
            {machine?.running ? <>
              <div className="pill" style={{ background:`${config.primaryColor}22`,color:config.primaryColor,marginBottom:6 }}>🔴 RUNNING</div>
              <div style={{ fontSize:16,fontWeight:700 }}>{machine.userName} — {machine.cycleName}</div>
              <div className="mono" style={{ color:"#94a3b8",fontSize:14,marginTop:2 }}>{remainMin} min remaining</div>
              <button onClick={()=>{sendToEsp32(config.esp32Ip,"off");DB.setMachine({running:false});toast("Force stopped","warning")}} className="btn" style={{ marginTop:10,background:"#dc2626",color:"#fff",fontSize:12,padding:"8px 16px" }}>⚠ Force Stop</button>
            </> : <>
              <div className="pill" style={{ background:"#05966922",color:"#34d399" }}>● IDLE</div>
              <div style={{ fontSize:13,color:"#64748b",marginTop:4 }}>Machine is available</div>
              {machine?.lastUser && <div style={{ fontSize:11,color:"#475569",marginTop:2 }}>Last: {machine.lastUser} ({machine.lastCycle})</div>}
            </>}
          </div>
        </div>

        {/* User list mini */}
        <div className="card" style={{ marginBottom:16 }}>
          <h3 style={{ fontSize:14,fontWeight:700,marginBottom:10 }}>👥 Users</h3>
          {users.map(u => <div key={u.id} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 10px",borderRadius:8,background:"#0f1729",marginBottom:4 }}>
            <div style={{ display:"flex",alignItems:"center",gap:8 }}>
              <div className="avatar" style={{ width:30,height:30,fontSize:14,background:`${config.primaryColor}22` }}>{u.emoji||"😊"}</div>
              <span style={{ fontSize:13,fontWeight:600 }}>{u.name}</span>
            </div>
            <div style={{ display:"flex",alignItems:"center",gap:6 }}>
              {u.dnd && <span className="pill" style={{ background:"#d9770622",color:"#f59e0b" }}>🔕 DND</span>}
              {u.id===machine?.userId && <span className="pill" style={{ background:`${config.primaryColor}22`,color:config.primaryColor }}>Washing</span>}
            </div>
          </div>)}
        </div>

        {/* Schedule mini */}
        <div className="card">
          <h3 style={{ fontSize:14,fontWeight:700,marginBottom:10 }}>📅 Upcoming ({schedule.length})</h3>
          {schedule.length===0 ? <p style={{ color:"#475569",fontSize:13,textAlign:"center" }}>None</p> : schedule.slice(0,5).map(s => <div key={s.id} style={{ padding:"7px 10px",borderRadius:8,background:"#0f1729",marginBottom:3,fontSize:12 }}><strong>{s.userName}</strong> — {s.cycleName} · {new Date(s.dateTime).toLocaleString()}</div>)}
        </div>
      </>}

      {/* USERS */}
      {tab === "users" && <div className="card">
        <h3 style={{ fontSize:17,fontWeight:700,marginBottom:16 }}>👥 Manage users ({users.length})</h3>
        <div style={{ display:"flex",gap:6,marginBottom:16,flexWrap:"wrap" }}>
          <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Name" className="inp" style={{ flex:2,minWidth:120 }}/>
          <input value={newPin} onChange={e=>setNewPin(e.target.value)} placeholder="PIN" maxLength={6} className="inp" style={{ flex:1,minWidth:80 }}/>
          <button onClick={addUser} className="btn" style={{ background:config.primaryColor,color:"#fff",whiteSpace:"nowrap" }}>+ Add</button>
        </div>
        {users.map(u => <div key={u.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",borderRadius:10,background:"#0f1729",marginBottom:6 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div className="avatar" style={{ background:`${config.primaryColor}22` }}>{u.emoji||"😊"}</div>
            <div>
              <div style={{ fontWeight:600,fontSize:14 }}>{u.name}</div>
              <div className="mono" style={{ fontSize:11,color:"#64748b" }}>PIN: {u.pin} · {u.dnd?"🔕 DND":"🔔 Notifs on"} · {new Date(u.created).toLocaleDateString()}</div>
            </div>
          </div>
          <button onClick={()=>{DB.removeUser(u.id);toast("Removed","info")}} className="btn" style={{ background:"#dc262622",color:"#ef4444",fontSize:11,padding:"5px 10px" }}>Remove</button>
        </div>)}
      </div>}

      {/* MACHINE */}
      {tab === "machine" && <div className="card">
        <h3 style={{ fontSize:17,fontWeight:700,marginBottom:16 }}>⚡ Machine control</h3>
        <div style={{ padding:16,borderRadius:12,background:"#0f1729",marginBottom:16,border:`1px solid ${machine?.running?"#dc262644":"#22c55e44"}` }}>
          <div style={{ fontSize:14,fontWeight:700 }}>{machine?.running?`🔴 Running — ${machine.userName} (${machine.cycleName})`:"🟢 Idle"}</div>
          {machine?.running && <button onClick={()=>{sendToEsp32(config.esp32Ip,"off");DB.setMachine({running:false});toast("Force stopped","warning")}} className="btn" style={{ marginTop:10,background:"#dc2626",color:"#fff",fontSize:12 }}>⚠ Force Stop</button>}
        </div>
        <h4 style={{ fontSize:14,fontWeight:600,marginBottom:8 }}>📅 Scheduled washes</h4>
        {schedule.length>0 ? <>
          {schedule.map(s=><div key={s.id} style={{ padding:"8px 10px",borderRadius:8,background:"#0f1729",marginBottom:3,fontSize:12 }}><strong>{s.userName}</strong> — {s.cycleName} · {new Date(s.dateTime).toLocaleString()}</div>)}
          <button onClick={()=>{DB.clearSchedule();toast("Cleared","info")}} className="btn" style={{ marginTop:8,background:"transparent",border:"1px solid #dc262644",color:"#ef4444",fontSize:11 }}>Clear All</button>
        </> : <p style={{ color:"#475569",fontSize:13 }}>No upcoming washes</p>}
        <div style={{ marginTop:16 }}>
          <h4 style={{ fontSize:14,fontWeight:600,marginBottom:8 }}>Manual relay control</h4>
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={()=>{sendToEsp32(config.esp32Ip,"on");toast("Relay ON","success")}} className="btn" style={{ background:"#059669",color:"#fff",flex:1 }}>⚡ Relay ON</button>
            <button onClick={()=>{sendToEsp32(config.esp32Ip,"off");toast("Relay OFF","info")}} className="btn" style={{ background:"#dc2626",color:"#fff",flex:1 }}>⏹ Relay OFF</button>
          </div>
        </div>
      </div>}

      {/* ESP32 */}
      {tab === "esp32" && <div className="card">
        <h3 style={{ fontSize:17,fontWeight:700,marginBottom:16 }}>📡 ESP32 connection</h3>
        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:16 }}><EspStatus ip={config.esp32Ip}/></div>
        <label style={{ fontSize:12,color:"#94a3b8",marginBottom:4,display:"block" }}>ESP32 IP address</label>
        <input value={espIp} onChange={e=>setEspIp(e.target.value)} className="inp" style={{ marginBottom:10 }} placeholder="192.168.1.100"/>
        <button onClick={saveConfig} className="btn" style={{ background:config.primaryColor,color:"#fff",width:"100%",marginBottom:16 }}>💾 Save IP</button>
        <div style={{ padding:16,borderRadius:12,background:"#0f1729",border:"1px solid #1e293b" }}>
          <h4 style={{ fontSize:14,fontWeight:700,marginBottom:10 }}>🔧 Wiring guide</h4>
          <div style={{ fontSize:12,color:"#94a3b8",lineHeight:1.9 }}>
            {[["ESP32 GPIO 26","Relay IN"],["ESP32 GND","Relay GND"],["ESP32 VIN (5V)","Relay VCC"],["Relay COM","Mains Live (from breaker)"],["Relay NO","Washing Machine Live"]].map(([a,b])=><div key={a}><strong style={{ color:"#e2e8f0" }}>{a}</strong> → {b}</div>)}
            <div style={{ marginTop:8,color:"#f59e0b",fontWeight:600 }}>⚠ Disconnect mains before wiring!</div>
          </div>
        </div>
      </div>}

      {/* SETTINGS */}
      {tab === "settings" && <div className="card">
        <h3 style={{ fontSize:17,fontWeight:700,marginBottom:16 }}>⚙️ UI configuration</h3>
        <div style={{ display:"grid",gap:12 }}>
          <div><label style={{ fontSize:12,color:"#94a3b8",marginBottom:4,display:"block" }}>App name</label><input value={appN} onChange={e=>setAppN(e.target.value)} className="inp"/></div>
          <div style={{ display:"flex",gap:12 }}>
            <div style={{ flex:1 }}><label style={{ fontSize:12,color:"#94a3b8",marginBottom:4,display:"block" }}>Primary color</label><div style={{ display:"flex",gap:6 }}><input type="color" value={colP} onChange={e=>setColP(e.target.value)} style={{ width:40,height:36,border:"none",borderRadius:6,cursor:"pointer" }}/><input value={colP} onChange={e=>setColP(e.target.value)} className="inp"/></div></div>
            <div style={{ flex:1 }}><label style={{ fontSize:12,color:"#94a3b8",marginBottom:4,display:"block" }}>Accent color</label><div style={{ display:"flex",gap:6 }}><input type="color" value={colA} onChange={e=>setColA(e.target.value)} style={{ width:40,height:36,border:"none",borderRadius:6,cursor:"pointer" }}/><input value={colA} onChange={e=>setColA(e.target.value)} className="inp"/></div></div>
          </div>
          <div><label style={{ fontSize:12,color:"#94a3b8",marginBottom:4,display:"block" }}>Alert before wash ends (min)</label><input type="number" value={alertM} onChange={e=>setAlertM(e.target.value)} className="inp" min="1" max="15"/></div>
          <div style={{ padding:12,borderRadius:10,background:"#0f1729" }}>
            <div style={{ fontSize:11,color:"#475569",marginBottom:6 }}>Preview</div>
            <div style={{ display:"flex",gap:8,alignItems:"center" }}>
              <div style={{ width:40,height:24,borderRadius:6,background:colP }}/>
              <div style={{ width:40,height:24,borderRadius:6,background:colA }}/>
              <span style={{ fontSize:13,fontWeight:700,color:colP }}>{appN}</span>
            </div>
          </div>
          <button onClick={saveConfig} className="btn" style={{ width:"100%",padding:"13px 0",background:config.primaryColor,color:"#fff",fontSize:15,fontWeight:700 }}>💾 Save Configuration</button>
        </div>
      </div>}
    </div>
  </div>;
}

// ═══════════════════════ MAIN APP ═══════════════════════
export default function Home() {
  const [session, setSession] = useState(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [toastData, setToastData] = useState(null);
  const [ready, setReady] = useState(false);
  const toast = useCallback((m, t) => setToastData({ message:m, type:t, key:Date.now() }), []);

  useEffect(() => {
    const unsub = DB.onConfigChange(c => { if (c) setConfig(p => ({ ...DEFAULT_CONFIG, ...c })); setReady(true); });
    return () => unsub();
  }, []);

  if (!ready) return <div style={{ minHeight:"100vh",background:"#080c14",display:"flex",alignItems:"center",justifyContent:"center" }}>
    <GS primary={DEFAULT_CONFIG.primaryColor}/>
    <div style={{ textAlign:"center",animation:"pulse 1.5s infinite" }}><div style={{ fontSize:40 }}>🫧</div><div style={{ color:"#64748b",marginTop:8,fontSize:14 }}>Connecting...</div></div>
  </div>;

  return <>
    <GS primary={config.primaryColor}/>
    {toastData && <Toast {...toastData} onClose={() => setToastData(null)}/>}
    {!session ? <LoginScreen config={config} onLogin={setSession}/> : session.role === "admin" ? <AdminDash config={config} setConfig={setConfig} onLogout={()=>setSession(null)} toast={toast}/> : <UserDash user={session} config={config} onLogout={()=>setSession(null)} toast={toast}/>}
  </>;
}
