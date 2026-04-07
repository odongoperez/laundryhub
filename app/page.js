"use client";
import{useState,useEffect,useCallback,useRef}from"react";
import DB from"./firebase";

const DEF={primaryColor:"#6C9BCF",accentColor:"#E8A87C",appName:"LaundryHub",esp32Ip:"",
washCycles:[
{name:"Quick Wash",minutes:30,temp:"30°C"},{name:"Normal",minutes:45,temp:"40°C"},
{name:"Heavy Duty",minutes:60,temp:"60°C"},{name:"Delicates",minutes:25,temp:"30°C"},
{name:"Bedding",minutes:75,temp:"60°C"},{name:"Colors",minutes:40,temp:"30°C"},
{name:"Whites",minutes:55,temp:"90°C"},{name:"Eco",minutes:50,temp:"20°C"},
{name:"Sport",minutes:35,temp:"40°C"},{name:"Baby Care",minutes:65,temp:"60°C"},
],alertMinutesBefore:5,maxWashMinutes:120};
const ADMIN_PW="1234";
const EMO=["😊","😎","🧑‍💻","👩‍🔧","🧑‍🎓","👨‍🍳","🦊","🐱","🐶","🦁","🐸","🦄","🌻","🔥","⚡","🎮","🎵","🏀","🌊","🚀","💎","🍕","🎯","🤖","👑","🎨","🧠","💻"];

/* ═══ NEUMORPHISM STYLES ═══ */
function GS({p}){
const bg="#1e2233";const ls="#282d44";const ds="#141620";
return<style>{`
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap');
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes si{from{transform:translateX(60px);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes fu{from{transform:translateY(14px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes pu{0%,100%{opacity:1}50%{opacity:.5}}
@keyframes rp{0%{box-shadow:0 0 0 0 ${p}44}100%{box-shadow:0 0 0 18px ${p}00}}
@keyframes gl{0%,100%{opacity:.7}50%{opacity:1}}
*{box-sizing:border-box;margin:0;padding:0}
html,body{font-family:'Nunito',sans-serif;background:${bg};color:#c8cdd8;overflow-x:hidden;-webkit-text-size-adjust:100%}
input:focus,button:focus{outline:none}
button,input,select{font-family:'Nunito',sans-serif;-webkit-appearance:none}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#33384d;border-radius:4px}

/* Neumorphic raised card */
.nm{background:${bg};border-radius:16px;padding:18px;
box-shadow:6px 6px 14px ${ds},-6px -6px 14px ${ls};
transition:box-shadow .2s}

/* Neumorphic inset (pressed in) */
.nm-in{background:${bg};border-radius:12px;padding:14px;
box-shadow:inset 4px 4px 8px ${ds},inset -4px -4px 8px ${ls}}

/* Neumorphic button (raised) */
.nb{padding:10px 18px;border-radius:12px;border:none;cursor:pointer;font-weight:700;font-size:13px;
background:${bg};color:#c8cdd8;
box-shadow:4px 4px 10px ${ds},-4px -4px 10px ${ls};
transition:all .15s;-webkit-tap-highlight-color:transparent}
.nb:active{box-shadow:inset 3px 3px 6px ${ds},inset -3px -3px 6px ${ls};transform:scale(.98)}

/* Colored neumorphic button */
.nb-p{background:${p};color:#fff;
box-shadow:4px 4px 10px ${ds},-4px -4px 10px ${ls}}
.nb-p:active{box-shadow:inset 3px 3px 6px #0004;transform:scale(.98)}

/* Neumorphic input (inset) */
.ni{padding:11px 14px;border-radius:12px;border:none;font-size:13px;width:100%;
background:${bg};color:#c8cdd8;
box-shadow:inset 3px 3px 6px ${ds},inset -3px -3px 6px ${ls};
transition:box-shadow .2s}
.ni:focus{box-shadow:inset 3px 3px 6px ${ds},inset -3px -3px 6px ${ls},0 0 0 2px ${p}44}
.ni::placeholder{color:#555b6e}

/* Neumorphic pill/badge */
.np{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:10px;font-weight:700;
box-shadow:2px 2px 5px ${ds},-2px -2px 5px ${ls}}

/* Neumorphic stat card (flat-ish) */
.ns{border-radius:14px;padding:14px;
box-shadow:4px 4px 10px ${ds},-4px -4px 10px ${ls}}

.M{font-family:'JetBrains Mono',monospace}
.A{border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;
box-shadow:3px 3px 6px ${ds},-3px -3px 6px ${ls}}
.G2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.G3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.G4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px}
@media(max-width:440px){.G3,.G4{grid-template-columns:1fr 1fr}}
.row{display:flex;align-items:center;gap:8px}
.sb{display:flex;justify-content:space-between;align-items:center}
.sec{font-size:14px;font-weight:800;color:#e2e6ef;margin-bottom:12px;letter-spacing:-.3px}

/* Toggle switch neumorphic */
.tog{width:42px;height:22px;border-radius:11px;cursor:pointer;position:relative;
box-shadow:inset 3px 3px 5px ${ds},inset -3px -3px 5px ${ls};transition:background .3s}
.tog-k{width:16px;height:16px;border-radius:50%;background:#e2e6ef;position:absolute;top:3px;transition:left .25s;
box-shadow:2px 2px 4px ${ds}}
`}</style>;}

function Toast({message,type,onClose}){useEffect(()=>{const t=setTimeout(onClose,3500);return()=>clearTimeout(t)},[onClose]);
const c={success:"#4ade80",error:"#f87171",warning:"#fbbf24",info:"#60a5fa"}[type]||"#60a5fa";
return<div style={{position:"fixed",top:12,right:12,left:12,zIndex:9999,animation:"si .3s ease",maxWidth:360,margin:"0 auto"}}>
<div className="nm" style={{padding:"12px 16px",borderLeft:`3px solid ${c}`,fontSize:12,fontWeight:600}}>{message}</div>
</div>;}

function Wash({on,prog,c,sz=130}){const i=sz-22;
return<div style={{width:sz,height:sz,borderRadius:"50%",background:`conic-gradient(${c} ${prog*360}deg,#1e2233 ${prog*360}deg)`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:on?`0 0 30px ${c}33,6px 6px 14px #141620,-6px -6px 14px #282d44`:"6px 6px 14px #141620,-6px -6px 14px #282d44",animation:on?"rp 2s infinite":"none"}}>
<div style={{width:i,height:i,borderRadius:"50%",background:"#1e2233",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",boxShadow:"inset 4px 4px 8px #141620,inset -4px -4px 8px #282d44"}}>
{on?<div style={{animation:"spin 2s linear infinite",fontSize:sz*.18}}>💧</div>:<span style={{fontSize:sz*.16,opacity:.3}}>⏻</span>}
<div className="M" style={{fontSize:10,color:"#8890a4",marginTop:3}}>{on?`${Math.round(prog*100)}%`:"IDLE"}</div>
</div></div>;}

function EspBadge({esp}){if(!esp)return<div className="np" style={{background:"#1e2233",color:"#555b6e"}}>ESP32 —</div>;const age=Date.now()/1000-(esp.lastSeen||0);const ok=age<90;return<div className="np" style={{background:"#1e2233",color:ok?"#4ade80":"#f87171"}}><span style={{width:5,height:5,borderRadius:"50%",background:"currentColor",animation:ok?"gl 2s infinite":"none"}}/>{ok?"Online":"Offline"}</div>;}

function Tog({on,onChange,color}){return<div className="tog" onClick={onChange} style={{background:on?color||"#6C9BCF":"#1e2233"}}><div className="tog-k" style={{left:on?23:3}}/></div>;}

function Modal({children,onClose}){return<div style={{position:"fixed",inset:0,zIndex:9998,background:"#000b",display:"flex",alignItems:"center",justifyContent:"center",padding:12}} onClick={onClose}><div className="nm" style={{width:"100%",maxWidth:380,padding:24,animation:"fu .25s ease",maxHeight:"88vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>{children}</div></div>;}

/* ═══ LOGIN ═══ */
function Login({onLogin,cfg}){
const[m,setM]=useState("user");const[u,setU]=useState("");const[pw,setPw]=useState("");const[err,setErr]=useState("");const[ld,setLd]=useState(false);
const go=async()=>{setErr("");setLd(true);try{if(m==="admin"){if(pw===ADMIN_PW){onLogin({role:"admin",name:"Admin",emoji:"🛡️"});return}else setErr("Wrong password")}else{const all=await DB.getUsers();const f=all.find(x=>x.name.toLowerCase()===u.trim().toLowerCase()&&x.pin===pw);if(!f)setErr("Invalid name or PIN");else if(f.disabled)setErr("Account disabled — contact admin");else{onLogin({role:"user",...f});return}}}catch{setErr("Connection error")}setLd(false)};
return<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#1e2233",padding:16}}>
<div style={{width:"100%",maxWidth:350,animation:"fu .5s ease"}}>
  <div style={{textAlign:"center",marginBottom:28}}>
    <div className="A" style={{width:72,height:72,fontSize:32,margin:"0 auto 12px",background:"#1e2233"}}>{cfg.appName==="LaundryHub"?"🫧":"🧺"}</div>
    <h1 style={{fontSize:26,fontWeight:900,color:"#e2e6ef",letterSpacing:-.5}}>{cfg.appName}</h1>
    <p style={{color:"#555b6e",fontSize:12,marginTop:2}}>Smart laundry control system</p>
  </div>
  <div className="nm" style={{padding:24}}>
    <div className="G2" style={{marginBottom:16}}>{["user","admin"].map(x=><button key={x} onClick={()=>{setM(x);setErr("")}} className={m===x?"nb nb-p":"nb"} style={m===x?{background:cfg.primaryColor}:{}}>{x==="admin"?"Admin":"User"}</button>)}</div>
    {m==="user"&&<input value={u} onChange={e=>setU(e.target.value)} placeholder="Your name" className="ni" style={{marginBottom:8}}/>}
    <input value={pw} onChange={e=>setPw(e.target.value)} type="password" placeholder={m==="admin"?"Admin password":"Your PIN"} onKeyDown={e=>e.key==="Enter"&&go()} className="ni" style={{marginBottom:6}}/>
    {err&&<p style={{color:"#f87171",fontSize:11,fontWeight:600,marginBottom:4}}>{err}</p>}
    <button onClick={go} disabled={ld} className="nb nb-p" style={{width:"100%",marginTop:10,padding:"12px 0",fontSize:15,fontWeight:800,background:ld?"#555b6e":cfg.primaryColor}}>
      {ld?"Signing in...":"Sign In"}</button>
  </div>
</div></div>;}

/* ═══ PROFILE ═══ */
function ProfileMod({user,cfg,onClose,toast}){
const[pin,sP]=useState("");const[pin2,sP2]=useState("");const[emo,sE]=useState(user.emoji||"😊");const[dnd,sD]=useState(user.dnd||false);
const save=async()=>{const u={...user,emoji:emo,dnd};if(pin&&pin.length>=4&&pin===pin2)u.pin=pin;else if(pin&&pin!==pin2)return toast("PINs don't match","error");try{await DB.addUser(u);toast("Saved!","success");onClose(u)}catch{toast("Failed","error")}};
return<Modal onClose={()=>onClose(null)}>
  <div className="sec">Profile</div>
  <div style={{textAlign:"center",marginBottom:16}}><div className="A" style={{width:64,height:64,fontSize:30,margin:"0 auto",background:"#1e2233"}}>{emo}</div><div style={{fontSize:14,fontWeight:700,color:"#e2e6ef",marginTop:8}}>{user.name}</div></div>
  <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:14}}>{EMO.map(e=><button key={e} onClick={()=>sE(e)} style={{width:32,height:32,borderRadius:8,background:emo===e?cfg.primaryColor+"33":"#1e2233",border:emo===e?`2px solid ${cfg.primaryColor}`:"none",fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:emo===e?"none":"inset 2px 2px 4px #141620,inset -2px -2px 4px #282d44"}}>{e}</button>)}</div>
  <input value={pin} onChange={e=>sP(e.target.value)} type="password" placeholder="New PIN (optional)" maxLength={6} className="ni" style={{marginBottom:6,fontSize:12}}/>
  <input value={pin2} onChange={e=>sP2(e.target.value)} type="password" placeholder="Confirm" maxLength={6} className="ni" style={{marginBottom:14,fontSize:12}}/>
  <div className="sb" style={{marginBottom:14}}><div><div style={{fontSize:12,fontWeight:700,color:"#e2e6ef"}}>Do Not Disturb</div><div style={{fontSize:10,color:"#555b6e"}}>Mute alerts</div></div><Tog on={dnd} onChange={()=>sD(!dnd)} color={cfg.primaryColor}/></div>
  <div className="G2"><button onClick={()=>onClose(null)} className="nb">Cancel</button><button onClick={save} className="nb nb-p" style={{background:cfg.primaryColor}}>Save</button></div>
</Modal>;}

/* ═══ CUSTOM TIME ═══ */
function TimeMod({cfg,onStart,onClose}){const[m,sM]=useState(45);
return<Modal onClose={onClose}>
  <div className="sec">Custom wash time</div>
  <div style={{textAlign:"center",marginBottom:16}}><div className="M" style={{fontSize:38,fontWeight:700,color:cfg.primaryColor}}>{m}<span style={{fontSize:14,color:"#555b6e"}}> min</span></div></div>
  <div className="nm-in" style={{padding:"14px 16px",marginBottom:12}}>
    <input type="range" min={5} max={120} step={5} value={m} onChange={e=>sM(+e.target.value)} style={{width:"100%",accentColor:cfg.primaryColor}}/>
    <div className="sb" style={{fontSize:9,color:"#555b6e",marginTop:4}}><span>5m</span><span>120m</span></div>
  </div>
  <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:16}}>{[15,30,45,60,90].map(x=><button key={x} onClick={()=>sM(x)} className="nb" style={{fontSize:11,padding:"6px 12px",background:m===x?cfg.primaryColor+"22":"#1e2233",color:m===x?cfg.primaryColor:"#c8cdd8"}}>{x}m</button>)}</div>
  <div className="G2"><button onClick={onClose} className="nb">Cancel</button><button onClick={()=>onStart(m)} className="nb nb-p" style={{background:cfg.primaryColor}}>Start</button></div>
</Modal>;}

/* ═══ EDIT SCHEDULE ═══ */
function SchedMod({e,cfg,onClose,toast}){const[d,sD]=useState(e.dateTime?.split("T")[0]||"");const[t,sT]=useState(e.dateTime?.split("T")[1]||"");
const save=async()=>{if(!d||!t)return toast("Pick date & time","error");try{await DB.updateScheduleEntry({...e,dateTime:`${d}T${t}`});toast("Rescheduled!","success");onClose()}catch{toast("Failed","error")}};
const del=async()=>{try{await DB.removeScheduleEntry(e.id);toast("Deleted","info");onClose()}catch{toast("Failed","error")}};
return<Modal onClose={onClose}>
  <div className="sec">Edit schedule</div>
  <div style={{fontSize:12,color:"#8890a4",marginBottom:10}}>{e.cycleName} — {e.userName}</div>
  <input type="date" value={d} onChange={x=>sD(x.target.value)} className="ni" style={{marginBottom:6}}/>
  <input type="time" value={t} onChange={x=>sT(x.target.value)} className="ni" style={{marginBottom:14}}/>
  <div style={{display:"flex",gap:8}}><button onClick={del} className="nb" style={{color:"#f87171"}}>Delete</button><div style={{flex:1}}/><button onClick={onClose} className="nb">Cancel</button><button onClick={save} className="nb nb-p" style={{background:cfg.primaryColor}}>Save</button></div>
</Modal>;}

/* ═══ ADMIN EDIT USER ═══ */
function EditUserMod({u,cfg,onClose,toast}){
const[name,sN]=useState(u.name);const[pin,sP]=useState(u.pin);const[emo,sE]=useState(u.emoji||"😊");const[dnd,sD]=useState(u.dnd||false);const[dis,sDis]=useState(u.disabled||false);
const save=async()=>{if(!name.trim()||!pin.trim())return toast("Required","error");await DB.addUser({...u,name:name.trim(),pin:pin.trim(),emoji:emo,dnd,disabled:dis});toast("Updated","success");onClose()};
return<Modal onClose={onClose}>
  <div className="sec">Edit user</div>
  <div style={{textAlign:"center",marginBottom:12}}><div className="A" style={{width:52,height:52,fontSize:26,margin:"0 auto",background:"#1e2233"}}>{emo}</div></div>
  <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:12}}>{EMO.map(e=><button key={e} onClick={()=>sE(e)} style={{width:28,height:28,borderRadius:6,background:emo===e?cfg.primaryColor+"33":"#1e2233",border:emo===e?`2px solid ${cfg.primaryColor}`:"none",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:emo===e?"none":"inset 2px 2px 3px #141620,inset -2px -2px 3px #282d44"}}>{e}</button>)}</div>
  <input value={name} onChange={e=>sN(e.target.value)} placeholder="Name" className="ni" style={{marginBottom:6}}/>
  <input value={pin} onChange={e=>sP(e.target.value)} placeholder="PIN" className="ni" style={{marginBottom:10}}/>
  <div className="sb" style={{marginBottom:8}}><span style={{fontSize:12,fontWeight:600}}>DND</span><Tog on={dnd} onChange={()=>sD(!dnd)} color={cfg.primaryColor}/></div>
  <div className="sb" style={{marginBottom:14}}><span style={{fontSize:12,fontWeight:600,color:dis?"#f87171":"#4ade80"}}>{dis?"Account disabled":"Account active"}</span><Tog on={!dis} onChange={()=>sDis(!dis)} color="#4ade80"/></div>
  <div className="G2"><button onClick={onClose} className="nb">Cancel</button><button onClick={save} className="nb nb-p" style={{background:cfg.primaryColor}}>Save</button></div>
</Modal>;}

/* ═══ START FOR USER ═══ */
function StartForMod({users,cfg,mac,onClose,toast}){const[sel,sS]=useState(null);const[cy,sCy]=useState(0);
const go=async()=>{if(!sel)return toast("Pick user","error");if(mac?.running)return toast("Busy","error");const c=cfg.washCycles[cy];await DB.setMachine({running:true,userId:sel.id,userName:sel.name,cycleName:c.name,startTime:Date.now(),durationMs:c.minutes*60000});toast(`${c.name} for ${sel.name} — ${c.minutes}m`,"success");onClose()};
return<Modal onClose={onClose}>
  <div className="sec">Start wash for user</div>
  <div style={{marginBottom:14}}>{users.filter(x=>!x.disabled).map(u=><button key={u.id} onClick={()=>sS(u)} className="nb" style={{display:"flex",alignItems:"center",gap:8,width:"100%",marginBottom:6,background:sel?.id===u.id?cfg.primaryColor+"22":"#1e2233",boxShadow:sel?.id===u.id?`0 0 0 2px ${cfg.primaryColor}44,4px 4px 10px #141620,-4px -4px 10px #282d44`:"4px 4px 10px #141620,-4px -4px 10px #282d44"}}><span style={{fontSize:16}}>{u.emoji||"😊"}</span><span style={{fontWeight:700}}>{u.name}</span></button>)}</div>
  <div style={{fontSize:12,fontWeight:700,color:"#e2e6ef",marginBottom:8}}>Cycle</div>
  <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:14}}>{cfg.washCycles.map((c,i)=><button key={i} onClick={()=>sCy(i)} className="nb" style={{fontSize:10,padding:"5px 10px",background:cy===i?cfg.primaryColor+"22":"#1e2233",color:cy===i?cfg.primaryColor:"#c8cdd8"}}>{c.name} {c.minutes}m</button>)}</div>
  <div className="G2"><button onClick={onClose} className="nb">Cancel</button><button onClick={go} className="nb nb-p" style={{background:cfg.primaryColor}}>Start</button></div>
</Modal>;}

/* ═══ HEADER ═══ */
function Head({cfg,user,admin,onOut,onProf,esp}){
return<div className="sb" style={{padding:"10px 14px",flexWrap:"wrap",gap:6}}>
  <div className="row"><div className="A" style={{width:32,height:32,fontSize:16,background:"#1e2233"}}>{admin?"🛡️":"🫧"}</div><span style={{fontWeight:900,fontSize:16,color:"#e2e6ef",letterSpacing:-.5}}>{admin?"Admin":cfg.appName}</span></div>
  <div className="row" style={{gap:6}}><EspBadge esp={esp}/>{!admin&&<button onClick={onProf} className="A" style={{width:30,height:30,fontSize:14,background:"#1e2233",cursor:"pointer",border:"none"}}>{user.emoji||"😊"}</button>}<button onClick={onOut} className="nb" style={{padding:"4px 10px",fontSize:10}}>Out</button></div>
</div>;}

/* ═══ USER DASHBOARD ═══ */
function UserDash({user:init,cfg,onOut,toast}){
const[user,sUser]=useState(init);const[mac,sMac]=useState({running:false});const[sch,sSch]=useState([]);const[users,sUsers]=useState([]);const[esp,sEsp]=useState(null);
const[cy,sCy]=useState(0);const[sd,sSd]=useState("");const[st,sSt]=useState("");const[now,sNow]=useState(Date.now());
const[showProf,sProf]=useState(false);const[showTime,sTime]=useState(false);const[editSch,sEditSch]=useState(null);
const af=useRef(false);const prev=useRef(false);

useEffect(()=>{const a=DB.onMachineChange(sMac);const b=DB.onScheduleChange(sSch);const c=DB.onUsersChange(sUsers);const d=DB.onEsp32Status(sEsp);const iv=setInterval(()=>sNow(Date.now()),1000);return()=>{a();b();c();d();clearInterval(iv)}},[]);
useEffect(()=>{if(prev.current&&!mac?.running&&!user.dnd){toast("Machine is free!","info");try{if("Notification"in window&&Notification.permission==="granted")new Notification("LaundryHub",{body:"Machine is free!"})}catch{}}prev.current=mac?.running||false},[mac?.running,user.dnd,toast]);
useEffect(()=>{if(!mac?.running||mac.userId!==user.id)return;const end=mac.startTime+mac.durationMs;const alt=end-(cfg.alertMinutesBefore||5)*60000;if(now>=alt&&now<end&&!af.current){af.current=true;toast(`${cfg.alertMinutesBefore||5}m left!`,"warning");try{if("Notification"in window&&Notification.permission==="granted")new Notification("LaundryHub",{body:`${cfg.alertMinutesBefore||5}m left!`})}catch{}}if(now>=end){DB.setMachine({running:false,lastUser:mac.userName,lastCycle:mac.cycleName,finishedAt:Date.now()});try{DB.addWashRecord({id:Date.now().toString(),userId:mac.userId,userName:mac.userName,cycleName:mac.cycleName,startTime:mac.startTime,finishedAt:Date.now(),durationMs:mac.durationMs})}catch{}toast("Wash complete!","success");af.current=false}},[now,mac,user.id,cfg,toast]);
useEffect(()=>{try{if("Notification"in window&&Notification.permission==="default")Notification.requestPermission()}catch{}},[]);

const my=mac?.running&&mac.userId===user.id;const busy=mac?.running&&mac.userId!==user.id;
const prog=mac?.running?Math.min(1,(now-mac.startTime)/mac.durationMs):0;
const rm=mac?.running?Math.max(0,(mac.startTime+mac.durationMs)-now):0;
const rmM=Math.floor(rm/60000);const rmS=Math.floor((rm%60000)/1000);
const bu=users.find(x=>x.id===mac?.userId);
const go=async(minutes,label)=>{if(mac?.running)return;await DB.setMachine({running:true,userId:user.id,userName:user.name,cycleName:label,startTime:Date.now(),durationMs:minutes*60000});af.current=false;toast(`${label} — ${minutes}m`,"success")};
const start=()=>{const c=cfg.washCycles[cy];go(c.minutes,c.name)};
const startC=m=>{sTime(false);go(m,"Custom")};
const stop=async()=>{if(!my)return;await DB.setMachine({running:false,lastUser:user.name,lastCycle:mac.cycleName,finishedAt:Date.now()});toast("Stopped","info")};
const ext=async m=>{if(!my||!mac?.running)return;await DB.setMachine({...mac,durationMs:mac.durationMs+m*60000});toast(`+${m}m`,"success")};
const addS=async()=>{if(!sd||!st)return toast("Pick date & time","error");const c=cfg.washCycles[cy];await DB.addScheduleEntry({id:Date.now().toString(),userId:user.id,userName:user.name,userEmoji:user.emoji||"😊",cycleName:c.name,minutes:c.minutes,dateTime:`${sd}T${st}`});sSd("");sSt("");toast("Scheduled!","success")};
const fmt=d=>{const x=new Date(d);return x.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})+" "+x.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})};

return<div style={{minHeight:"100vh",background:"#1e2233"}}>
<Head cfg={cfg} user={user} onOut={onOut} onProf={()=>sProf(true)} esp={esp}/>
{showProf&&<ProfileMod user={user} cfg={cfg} onClose={u=>{if(u?.id)sUser(u);sProf(false)}} toast={toast}/>}
{showTime&&<TimeMod cfg={cfg} onStart={startC} onClose={()=>sTime(false)}/>}
{editSch&&<SchedMod e={editSch} cfg={cfg} onClose={()=>sEditSch(null)} toast={toast}/>}
<div style={{maxWidth:580,margin:"0 auto",padding:"14px 12px"}}>

  {/* Machine Status */}
  <div className="nm" style={{display:"flex",flexDirection:"column",alignItems:"center",padding:26,marginBottom:16}}>
    <Wash on={mac?.running} prog={prog} c={cfg.primaryColor}/>
    {mac?.running?<div style={{textAlign:"center",marginTop:14,width:"100%"}}>
      <div className="np" style={{background:busy?"#f8717122":"",color:busy?"#f87171":cfg.primaryColor,marginBottom:6}}>{busy?"IN USE":"YOUR WASH"}</div>
      <div className="row" style={{justifyContent:"center",marginBottom:2}}>{bu&&<span style={{fontSize:15}}>{bu.emoji||"😊"}</span>}<span style={{fontSize:15,fontWeight:800,color:"#e2e6ef"}}>{mac.userName}</span></div>
      <div style={{fontSize:16,fontWeight:700,color:"#c8cdd8"}}>{mac.cycleName}</div>
      <div className="M" style={{color:"#8890a4",fontSize:28,marginTop:4}}>{rmM}:{String(rmS).padStart(2,"0")}</div>
      {my&&<div style={{marginTop:12}}>
        <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:10,flexWrap:"wrap"}}>{[5,10,15,30].map(m=><button key={m} onClick={()=>ext(m)} className="nb" style={{fontSize:11,padding:"6px 12px",color:cfg.primaryColor}}>+{m}m</button>)}</div>
        <button onClick={stop} className="nb" style={{width:"100%",padding:"10px 0",color:"#f87171",fontWeight:800}}>Stop Machine</button>
      </div>}
    </div>:<div style={{textAlign:"center",marginTop:14}}>
      <div className="np" style={{color:"#4ade80"}}>AVAILABLE</div>
      {mac?.lastUser&&<div style={{fontSize:10,color:"#555b6e",marginTop:4}}>Last: {mac.lastUser}</div>}
    </div>}
  </div>

  {/* Start Wash */}
  {!mac?.running&&<div className="nm" style={{marginBottom:16}}>
    <div className="sb" style={{marginBottom:10}}><span className="sec" style={{marginBottom:0}}>Start wash</span><button onClick={()=>sTime(true)} className="nb" style={{fontSize:10,padding:"5px 10px",color:cfg.accentColor}}>Custom time</button></div>
    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>{cfg.washCycles.map((c,i)=><button key={i} onClick={()=>sCy(i)} className="nb" style={{fontSize:11,padding:"7px 11px",color:cy===i?cfg.primaryColor:"#8890a4",background:cy===i?"#1e2233":"#1e2233",boxShadow:cy===i?`inset 3px 3px 6px #141620,inset -3px -3px 6px #282d44`:"4px 4px 10px #141620,-4px -4px 10px #282d44"}}>{c.name} <span style={{opacity:.5}}>{c.minutes}m</span></button>)}</div>
    <div className="nm-in" style={{marginBottom:10,display:"flex",alignItems:"center",gap:8,fontSize:12}}>
      <span style={{fontWeight:700,color:"#e2e6ef"}}>{cfg.washCycles[cy].name}</span>
      <span style={{color:"#555b6e"}}>·</span><span style={{color:"#8890a4"}}>{cfg.washCycles[cy].minutes} min</span>
      <span style={{color:"#555b6e"}}>·</span><span style={{color:"#8890a4"}}>{cfg.washCycles[cy].temp}</span>
    </div>
    <button onClick={start} className="nb nb-p" style={{width:"100%",padding:"12px 0",fontSize:15,fontWeight:800,background:cfg.primaryColor}}>Start — {cfg.washCycles[cy].minutes} min</button>
  </div>}

  {/* Schedule */}
  <div className="nm" style={{marginBottom:16}}>
    <div className="sec">Schedule</div>
    <div style={{display:"flex",gap:6,marginBottom:8}}><input type="date" value={sd} onChange={e=>sSd(e.target.value)} className="ni" style={{flex:1}}/><input type="time" value={st} onChange={e=>sSt(e.target.value)} className="ni" style={{flex:1}}/></div>
    <button onClick={addS} className="nb nb-p" style={{width:"100%",background:cfg.accentColor,color:"#1e2233",fontWeight:800}}>Schedule</button>
  </div>

  {sch.length>0&&<div className="nm" style={{marginBottom:16}}>
    <div className="sec">Upcoming ({sch.length})</div>
    {sch.map(s=><div key={s.id} className="sb" style={{padding:"8px 0",borderBottom:"1px solid #282d44"}}>
      <div className="row"><span style={{fontSize:13}}>{s.userEmoji||"😊"}</span><div><div style={{fontSize:12,fontWeight:700,color:"#e2e6ef"}}>{s.userName}{s.userId===user.id&&<span style={{color:cfg.primaryColor,fontSize:9}}> you</span>}</div><div style={{fontSize:10,color:"#555b6e"}}>{s.cycleName} · {fmt(s.dateTime)}</div></div></div>
      {s.userId===user.id&&<button onClick={()=>sEditSch(s)} className="nb" style={{fontSize:9,padding:"3px 8px",color:cfg.primaryColor}}>Edit</button>}
    </div>)}
  </div>}

  <div className="nm">
    <div className="sec">Housemates</div>
    <div className="G2">{users.filter(x=>!x.disabled).map(u=><div key={u.id} className="nm-in" style={{display:"flex",alignItems:"center",gap:6,padding:10}}>
      <div className="A" style={{width:28,height:28,fontSize:13,background:u.id===mac?.userId?cfg.primaryColor+"33":"#1e2233"}}>{u.emoji||"😊"}</div>
      <div><div style={{fontSize:11,fontWeight:700,color:"#e2e6ef"}}>{u.name}</div><div style={{fontSize:9,color:u.id===mac?.userId?"#4ade80":u.dnd?"#fbbf24":"#555b6e"}}>{u.id===mac?.userId?"Washing":u.dnd?"DND":"Free"}</div></div>
    </div>)}</div>
  </div>
</div></div>;}

/* ═══ ADMIN DASHBOARD ═══ */
function AdminDash({cfg,setCfg,onOut,toast}){
const[users,sU]=useState([]);const[mac,sM]=useState({running:false});const[sch,sSch]=useState([]);const[esp,sE]=useState(null);const[hist,sH]=useState([]);
const[nn,sNN]=useState("");const[np,sNP]=useState("");const[tab,sT]=useState("dash");
const[ip,sIp]=useState(cfg.esp32Ip||"");const[cP,sCP]=useState(cfg.primaryColor);const[cA,sCA]=useState(cfg.accentColor);const[aN,sAN]=useState(cfg.appName);const[aM,sAM]=useState(cfg.alertMinutesBefore||5);const[mW,sMW]=useState(cfg.maxWashMinutes||120);
const[eu,sEU]=useState(null);const[sfu,sSFU]=useState(false);const[now,sNow]=useState(Date.now());

useEffect(()=>{const a=DB.onUsersChange(sU);const b=DB.onMachineChange(sM);const c=DB.onScheduleChange(sSch);const d=DB.onEsp32Status(sE);const e=DB.onHistoryChange(sH);const iv=setInterval(()=>sNow(Date.now()),1000);return()=>{a();b();c();d();e();clearInterval(iv)}},[]);

const addU=async()=>{if(!nn.trim()||!np.trim())return toast("Required","error");if(np.length<4)return toast("PIN 4+","error");if(users.find(u=>u.name.toLowerCase()===nn.trim().toLowerCase()))return toast("Exists","error");await DB.addUser({id:Date.now().toString(),name:nn.trim(),pin:np.trim(),emoji:"😊",dnd:false,disabled:false,created:new Date().toISOString()});sNN("");sNP("");toast(`${nn.trim()} added`,"success")};
const saveCfg=async()=>{const u={...cfg,primaryColor:cP,accentColor:cA,appName:aN,esp32Ip:ip,alertMinutesBefore:+aM||5,maxWashMinutes:+mW||120,washCycles:cfg.washCycles};await DB.setConfig(u);setCfg(u);toast("Saved","success")};
const prog=mac?.running?Math.min(1,(now-mac.startTime)/mac.durationMs):0;
const rmM=mac?.running?Math.ceil(Math.max(0,(mac.startTime+mac.durationMs)-now)/60000):0;
const washCount={};hist.forEach(h=>{washCount[h.userName]=(washCount[h.userName]||0)+1});
const activeUsers=users.filter(x=>!x.disabled).length;

const tabs=[{id:"dash",l:"Dashboard"},{id:"users",l:"Users"},{id:"ctrl",l:"Control"},{id:"log",l:"History"},{id:"cfg",l:"Settings"}];

return<div style={{minHeight:"100vh",background:"#1e2233"}}>
<Head cfg={cfg} user={{name:"Admin",emoji:"🛡️"}} admin onOut={onOut} esp={esp}/>
{eu&&<EditUserMod u={eu} cfg={cfg} onClose={()=>sEU(null)} toast={toast}/>}
{sfu&&<StartForMod users={users} cfg={cfg} mac={mac} onClose={()=>sSFU(false)} toast={toast}/>}
<div style={{maxWidth:680,margin:"0 auto",padding:"14px 12px"}}>
  <div style={{display:"flex",gap:4,marginBottom:14,overflowX:"auto",paddingBottom:3}}>{tabs.map(t=><button key={t.id} onClick={()=>sT(t.id)} className="nb" style={{fontSize:11,padding:"7px 14px",whiteSpace:"nowrap",color:tab===t.id?cfg.primaryColor:"#8890a4",boxShadow:tab===t.id?"inset 3px 3px 6px #141620,inset -3px -3px 6px #282d44":"4px 4px 10px #141620,-4px -4px 10px #282d44"}}>{t.l}</button>)}</div>

  {/* DASHBOARD */}
  {tab==="dash"&&<>
    <div className="G4" style={{marginBottom:14}}>{[
      {l:"Active",v:activeUsers,s:`/${users.length}`},
      {l:"Scheduled",v:sch.length},
      {l:"Total washes",v:hist.length},
      {l:"Machine",v:mac?.running?"ON":"OFF",c:mac?.running?"#4ade80":"#555b6e"},
    ].map((s,i)=><div key={i} className="ns"><div style={{fontSize:9,color:"#555b6e",fontWeight:600}}>{s.l}</div><div style={{fontSize:20,fontWeight:800,color:s.c||"#e2e6ef"}}>{s.v}<span style={{fontSize:11,color:"#555b6e"}}>{s.s||""}</span></div></div>)}</div>

    <div className="nm" style={{marginBottom:14,display:"flex",alignItems:"center",gap:14}}>
      <Wash on={mac?.running} prog={prog} c={cfg.primaryColor} sz={95}/>
      <div style={{flex:1}}>{mac?.running?<>
        <div className="np" style={{color:cfg.primaryColor,marginBottom:4}}>RUNNING</div>
        <div style={{fontSize:14,fontWeight:800,color:"#e2e6ef"}}>{mac.userName}</div>
        <div style={{fontSize:12,color:"#8890a4"}}>{mac.cycleName} · {rmM}m left</div>
        <button onClick={()=>{DB.setMachine({running:false});toast("Stopped","warning")}} className="nb" style={{marginTop:8,fontSize:10,padding:"5px 14px",color:"#f87171"}}>Force Stop</button>
      </>:<>
        <div className="np" style={{color:"#4ade80"}}>IDLE</div>
        {mac?.lastUser&&<div style={{fontSize:11,color:"#555b6e",marginTop:3}}>Last: {mac.lastUser}</div>}
        <button onClick={()=>sSFU(true)} className="nb" style={{marginTop:8,fontSize:10,padding:"5px 14px",color:cfg.primaryColor}}>Start for user...</button>
      </>}</div>
    </div>

    <div className="nm" style={{marginBottom:14}}>
      <div className="sec">ESP32 Hardware</div>
      {esp?<div className="G2">{[
        {l:"IP",v:esp.ip||"—"},{l:"Signal",v:`${esp.rssi} dBm`},
        {l:"Relay",v:esp.relay?"ON":"OFF",c:esp.relay?"#4ade80":"#555b6e"},
        {l:"Uptime",v:esp.uptime?`${Math.floor(esp.uptime/3600)}h${Math.floor(esp.uptime%3600/60)}m`:"—"},
      ].map((s,i)=><div key={i} className="nm-in" style={{padding:10}}><div style={{fontSize:9,color:"#555b6e"}}>{s.l}</div><div className="M" style={{fontSize:12,color:s.c||"#e2e6ef",fontWeight:500}}>{s.v}</div></div>)}</div>:<div style={{fontSize:11,color:"#555b6e"}}>No data — flash firmware</div>}
    </div>

    <div className="nm" style={{marginBottom:14}}>
      <div className="sec">Wash stats</div>
      {users.map(u=>{const cnt=washCount[u.name]||0;return<div key={u.id} className="sb" style={{padding:"6px 0"}}><div className="row"><span style={{fontSize:13}}>{u.emoji||"😊"}</span><span style={{fontSize:12,fontWeight:600,color:"#e2e6ef"}}>{u.name}</span>{u.disabled&&<span className="np" style={{fontSize:8,color:"#f87171",padding:"1px 5px"}}>off</span>}</div><div className="row" style={{gap:6}}><div style={{width:Math.min(cnt*16,120),height:6,borderRadius:3,background:cfg.primaryColor,boxShadow:`0 0 6px ${cfg.primaryColor}44`}}/><span className="M" style={{fontSize:10,color:"#8890a4"}}>{cnt}</span></div></div>})}
    </div>
  </>}

  {/* USERS */}
  {tab==="users"&&<div className="nm">
    <div className="sec">Manage Users ({users.length})</div>
    <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}><input value={nn} onChange={e=>sNN(e.target.value)} placeholder="Name" className="ni" style={{flex:2,minWidth:90}}/><input value={np} onChange={e=>sNP(e.target.value)} placeholder="PIN" maxLength={6} className="ni" style={{flex:1,minWidth:60}}/><button onClick={addU} className="nb nb-p" style={{background:cfg.primaryColor}}>Add</button></div>
    {users.map(u=><div key={u.id} className="sb" style={{padding:"10px 0",borderBottom:"1px solid #282d44"}}>
      <div className="row"><div className="A" style={{width:32,height:32,fontSize:15,background:"#1e2233"}}>{u.emoji||"😊"}</div><div><div style={{fontWeight:700,fontSize:13,color:u.disabled?"#555b6e":"#e2e6ef"}}>{u.name}{u.disabled&&<span style={{color:"#f87171",fontSize:9,marginLeft:4}}>disabled</span>}</div><div className="M" style={{fontSize:10,color:"#555b6e"}}>{u.pin} · {u.dnd?"DND":"ON"} · {washCount[u.name]||0} washes</div></div></div>
      <div className="row" style={{gap:4}}><button onClick={()=>sEU(u)} className="nb" style={{fontSize:9,padding:"4px 8px",color:cfg.primaryColor}}>Edit</button><button onClick={()=>{DB.removeUser(u.id);toast("Removed","info")}} className="nb" style={{fontSize:9,padding:"4px 8px",color:"#f87171"}}>Del</button></div>
    </div>)}
  </div>}

  {/* CONTROL */}
  {tab==="ctrl"&&<div className="nm">
    <div className="sec">Machine Control</div>
    <div className="nm-in" style={{marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:700,color:mac?.running?"#f87171":"#4ade80"}}>{mac?.running?`Running — ${mac.userName} (${mac.cycleName}) — ${rmM}m`:"Idle"}</div>
      {mac?.running&&<button onClick={()=>{DB.setMachine({running:false});toast("Stopped","warning")}} className="nb" style={{marginTop:8,color:"#f87171",fontSize:11}}>Force Stop</button>}
    </div>
    <button onClick={()=>sSFU(true)} className="nb nb-p" style={{width:"100%",background:cfg.primaryColor,marginBottom:14}}>Start wash for a user...</button>
    <div style={{fontSize:13,fontWeight:700,color:"#e2e6ef",marginBottom:8}}>Manual relay</div>
    <div className="G2" style={{marginBottom:14}}>
      <button onClick={()=>{DB.setMachine({running:true,userId:"admin",userName:"Admin",cycleName:"Manual",startTime:Date.now(),durationMs:300000});toast("ON 5m","success")}} className="nb" style={{color:"#4ade80"}}>ON (5m)</button>
      <button onClick={()=>{DB.setMachine({running:false});toast("OFF","info")}} className="nb" style={{color:"#f87171"}}>OFF</button>
    </div>
    <div style={{fontSize:13,fontWeight:700,color:"#e2e6ef",marginBottom:8}}>Per-user control</div>
    {users.filter(x=>!x.disabled).map(u=><div key={u.id} className="sb" style={{padding:"8px 0",borderBottom:"1px solid #282d44"}}>
      <div className="row"><span style={{fontSize:13}}>{u.emoji||"😊"}</span><span style={{fontSize:12,fontWeight:600,color:"#e2e6ef"}}>{u.name}</span></div>
      {(!mac?.running||mac.userId!==u.id)?<button onClick={()=>{if(mac?.running)return toast("Busy","error");DB.setMachine({running:true,userId:u.id,userName:u.name,cycleName:"Admin",startTime:Date.now(),durationMs:45*60000});toast(`ON for ${u.name}`,"success")}} className="nb" style={{fontSize:9,padding:"3px 10px",color:"#4ade80"}}>Start</button>:
      <button onClick={()=>{DB.setMachine({running:false});toast("Stopped","info")}} className="nb" style={{fontSize:9,padding:"3px 10px",color:"#f87171"}}>Stop</button>}
    </div>)}
  </div>}

  {/* HISTORY */}
  {tab==="log"&&<div className="nm">
    <div className="sec">History ({hist.length})</div>
    {hist.length===0?<div style={{color:"#555b6e",fontSize:12}}>No washes yet</div>:hist.slice(0,30).map(h=><div key={h.id} className="sb" style={{padding:"7px 0",borderBottom:"1px solid #282d44"}}>
      <div><div style={{fontSize:12,fontWeight:700,color:"#e2e6ef"}}>{h.userName} — {h.cycleName}</div><div style={{fontSize:10,color:"#555b6e"}}>{new Date(h.finishedAt).toLocaleString()}</div></div>
      <span className="M" style={{fontSize:11,color:"#8890a4"}}>{Math.round(h.durationMs/60000)}m</span>
    </div>)}
  </div>}

  {/* SETTINGS */}
  {tab==="cfg"&&<div className="nm">
    <div className="sec">Settings</div>
    <div style={{display:"grid",gap:10}}>
      <div><label style={{fontSize:11,color:"#555b6e",marginBottom:4,display:"block"}}>App name</label><input value={aN} onChange={e=>sAN(e.target.value)} className="ni"/></div>
      <div className="G2">
        <div><label style={{fontSize:11,color:"#555b6e",marginBottom:4,display:"block"}}>Primary</label><div className="row"><input type="color" value={cP} onChange={e=>sCP(e.target.value)} style={{width:34,height:30,border:"none",borderRadius:8,cursor:"pointer"}}/><input value={cP} onChange={e=>sCP(e.target.value)} className="ni" style={{fontSize:11}}/></div></div>
        <div><label style={{fontSize:11,color:"#555b6e",marginBottom:4,display:"block"}}>Accent</label><div className="row"><input type="color" value={cA} onChange={e=>sCA(e.target.value)} style={{width:34,height:30,border:"none",borderRadius:8,cursor:"pointer"}}/><input value={cA} onChange={e=>sCA(e.target.value)} className="ni" style={{fontSize:11}}/></div></div>
      </div>
      <div className="G2">
        <div><label style={{fontSize:11,color:"#555b6e",marginBottom:4,display:"block"}}>Alert before (min)</label><input type="number" value={aM} onChange={e=>sAM(e.target.value)} className="ni" min="1" max="15"/></div>
        <div><label style={{fontSize:11,color:"#555b6e",marginBottom:4,display:"block"}}>Max wash (min)</label><input type="number" value={mW} onChange={e=>sMW(e.target.value)} className="ni" min="30" max="180"/></div>
      </div>
      <div><label style={{fontSize:11,color:"#555b6e",marginBottom:4,display:"block"}}>ESP32 IP</label><input value={ip} onChange={e=>sIp(e.target.value)} className="ni" placeholder="Optional"/></div>
      <button onClick={saveCfg} className="nb nb-p" style={{width:"100%",padding:"12px 0",fontSize:14,fontWeight:800,background:cfg.primaryColor}}>Save</button>
    </div>
  </div>}
</div></div>;}

/* ═══ MAIN ═══ */
export default function Home(){
const[s,sS]=useState(null);const[cfg,sCfg]=useState(DEF);const[td,sTD]=useState(null);const[rdy,sRdy]=useState(false);
const toast=useCallback((m,t)=>sTD({message:m,type:t,key:Date.now()}),[]);
useEffect(()=>{try{const v=localStorage.getItem("lh_session");if(v)sS(JSON.parse(v))}catch{}},[]);
const login=u=>{sS(u);try{localStorage.setItem("lh_session",JSON.stringify(u))}catch{}};
const logout=()=>{sS(null);try{localStorage.removeItem("lh_session")}catch{}};
useEffect(()=>{const u=DB.onConfigChange(c=>{if(c)sCfg(p=>({...DEF,...c}));sRdy(true)});return()=>u()},[]);
if(!rdy)return<div style={{minHeight:"100vh",background:"#1e2233",display:"flex",alignItems:"center",justifyContent:"center"}}><GS p={DEF.primaryColor}/><div style={{textAlign:"center",animation:"pu 1.5s infinite"}}><div className="A" style={{width:60,height:60,fontSize:28,margin:"0 auto",background:"#1e2233"}}>🫧</div><div style={{color:"#555b6e",marginTop:8,fontSize:12}}>Connecting...</div></div></div>;
return<><GS p={cfg.primaryColor}/>{td&&<Toast{...td}onClose={()=>sTD(null)}/>}{!s?<Login cfg={cfg} onLogin={login}/>:s.role==="admin"?<AdminDash cfg={cfg} setCfg={sCfg} onOut={logout} toast={toast}/>:<UserDash user={s} cfg={cfg} onOut={logout} toast={toast}/>}</>;
}
