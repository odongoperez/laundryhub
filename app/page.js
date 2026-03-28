"use client";
import{useState,useEffect,useCallback,useRef}from"react";
import DB from"./firebase";

const DEF={primaryColor:"#0D9488",accentColor:"#F59E0B",appName:"LaundryHub",esp32Ip:"",
washCycles:[
{name:"Quick",min:30,temp:"30°C"},{name:"Normal",min:45,temp:"40°C"},
{name:"Heavy",min:60,temp:"60°C"},{name:"Delicates",min:25,temp:"30°C"},
{name:"Bedding",min:75,temp:"60°C"},{name:"Colors",min:40,temp:"30°C"},
{name:"Whites",min:55,temp:"90°C"},{name:"Eco",min:50,temp:"20°C"},
{name:"Sport",min:35,temp:"40°C"},{name:"Baby Care",min:65,temp:"60°C"},
],alertMin:5,maxMin:120};
const ADMIN_PW="1234";
const EMO=["😊","😎","🧑‍💻","👩‍🔧","🧑‍🎓","👨‍🍳","🦊","🐱","🐶","🦁","🐸","🦄","🌻","🔥","⚡","🎮","🎵","🏀","🌊","🚀","💎","🍕","🎯","🤖"];

function GS({p}){return<style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap');
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes si{from{transform:translateX(80px);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes fu{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes pu{0%,100%{opacity:1}50%{opacity:.5}}
@keyframes rp{0%{box-shadow:0 0 0 0 ${p}55}100%{box-shadow:0 0 0 20px ${p}00}}
@keyframes gl{0%,100%{filter:brightness(1)}50%{filter:brightness(1.3)}}
*{box-sizing:border-box;margin:0;padding:0}
html,body{font-family:'Outfit',sans-serif;background:#070b12;color:#e2e8f0;overflow-x:hidden;-webkit-text-size-adjust:100%}
input:focus,button:focus{outline:none}button,input,select{font-family:'Outfit',sans-serif;-webkit-appearance:none}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#334155;border-radius:3px}
.C{background:#10162080;border-radius:14px;padding:16px;border:1px solid #1e293b;backdrop-filter:blur(8px)}
.B{padding:9px 16px;border-radius:9px;border:none;cursor:pointer;font-weight:600;font-size:13px;transition:all .12s;-webkit-tap-highlight-color:transparent}
.B:active{transform:scale(.97)}
.I{padding:10px 12px;border-radius:9px;border:1.5px solid #1e293b;background:#080c14;color:#e2e8f0;font-size:13px;width:100%;transition:border-color .2s}
.I:focus{border-color:${p}}
.P{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:16px;font-size:10px;font-weight:600}
.M{font-family:'JetBrains Mono',monospace}
.S{background:#0c1220;border-radius:10px;padding:12px;border:1px solid #1e293b}
.A{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.G2{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.G3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
.G4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px}
@media(max-width:420px){.G3,.G4{grid-template-columns:1fr 1fr}}
.row{display:flex;align-items:center;gap:8px}
.sb{display:flex;justify-content:space-between;align-items:center}
`}</style>;}

function Toast({message,type,onClose}){
  useEffect(()=>{const t=setTimeout(onClose,3500);return()=>clearTimeout(t)},[onClose]);
  const c={success:"#059669",error:"#dc2626",warning:"#d97706",info:"#0ea5e9"}[type]||"#0ea5e9";
  return<div style={{position:"fixed",top:10,right:10,left:10,zIndex:9999,padding:"11px 14px",background:c,color:"#fff",borderRadius:12,fontSize:12,fontWeight:600,boxShadow:`0 6px 24px ${c}44`,animation:"si .3s ease",display:"flex",alignItems:"center",gap:6,maxWidth:340,margin:"0 auto"}}>{message}</div>;
}

function Wash({on,prog,c,sz=130}){
  const i=sz-20;
  return<div style={{width:sz,height:sz,borderRadius:"50%",background:`conic-gradient(${c} ${prog*360}deg,#1a2236 ${prog*360}deg)`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:on?`0 0 40px ${c}33`:"none",animation:on?"rp 2s infinite":"none"}}>
    <div style={{width:i,height:i,borderRadius:"50%",background:"#070b12",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column"}}>
      {on?<div style={{animation:"spin 2s linear infinite",fontSize:sz*.18}}>💧</div>:<span style={{fontSize:sz*.16,opacity:.35}}>⏻</span>}
      <div className="M" style={{fontSize:10,color:"#94a3b8",marginTop:3}}>{on?`${Math.round(prog*100)}%`:"IDLE"}</div>
    </div>
  </div>;
}

function EspBadge({esp}){
  if(!esp)return<div className="P" style={{background:"#33415533",color:"#64748b"}}>ESP32 —</div>;
  const age=Date.now()/1000-(esp.lastSeen||0);
  const ok=age<90;
  return<div className="P" style={{background:ok?"#05966918":"#dc262618",color:ok?"#34d399":"#f87171"}}>
    <span style={{width:5,height:5,borderRadius:"50%",background:"currentColor",animation:ok?"gl 2s infinite":"none"}}/>
    {ok?"Online":"Offline"}{esp.relay?" · Relay ON":""}
  </div>;
}

// ═══════ MODAL WRAPPER ═══════
function Modal({children,onClose}){
  return<div style={{position:"fixed",inset:0,zIndex:9998,background:"#000b",display:"flex",alignItems:"center",justifyContent:"center",padding:10}} onClick={onClose}>
    <div className="C" style={{width:"100%",maxWidth:370,padding:22,animation:"fu .25s ease",maxHeight:"88vh",overflowY:"auto",border:"1px solid #334155"}} onClick={e=>e.stopPropagation()}>
      {children}
    </div>
  </div>;
}

// ═══════ LOGIN ═══════
function Login({onLogin,cfg}){
  const[m,setM]=useState("user");const[u,setU]=useState("");const[pw,setPw]=useState("");const[err,setErr]=useState("");const[ld,setLd]=useState(false);
  const go=async()=>{setErr("");setLd(true);try{if(m==="admin"){if(pw===ADMIN_PW){onLogin({role:"admin",name:"Admin",emoji:"🛡️"});return}else setErr("Wrong password")}else{const all=await DB.getUsers();const f=all.find(x=>x.name.toLowerCase()===u.trim().toLowerCase()&&x.pin===pw);if(!f)setErr("Invalid name or PIN");else if(f.disabled)setErr("Account disabled. Contact admin.");else{onLogin({role:"user",...f});return}}}catch{setErr("Connection error")}setLd(false)};
  return<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#070b12",padding:14}}>
    <div style={{width:"100%",maxWidth:340,animation:"fu .5s ease"}}>
      <div style={{textAlign:"center",marginBottom:22}}>
        <div style={{fontSize:40,marginBottom:2}}>🫧</div>
        <h1 style={{fontSize:24,fontWeight:800,letterSpacing:-.5,background:`linear-gradient(135deg,${cfg.primaryColor},${cfg.accentColor})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{cfg.appName}</h1>
        <p style={{color:"#475569",fontSize:11,marginTop:1}}>Smart shared laundry control</p>
      </div>
      <div className="C" style={{padding:"22px 18px"}}>
        <div className="G2" style={{marginBottom:14}}>{["user","admin"].map(x=><button key={x} onClick={()=>{setM(x);setErr("")}} className="B" style={{background:m===x?cfg.primaryColor:"#1e293b",color:"#fff",fontSize:12}}>{x==="admin"?"Admin":"User"}</button>)}</div>
        {m==="user"&&<input value={u} onChange={e=>setU(e.target.value)} placeholder="Your name" className="I" style={{marginBottom:7}}/>}
        <input value={pw} onChange={e=>setPw(e.target.value)} type="password" placeholder={m==="admin"?"Admin password":"Your PIN"} onKeyDown={e=>e.key==="Enter"&&go()} className="I" style={{marginBottom:5}}/>
        {err&&<p style={{color:"#ef4444",fontSize:11,fontWeight:500,marginBottom:3}}>{err}</p>}
        <button onClick={go} disabled={ld} className="B" style={{width:"100%",marginTop:8,padding:"11px 0",background:ld?"#475569":cfg.primaryColor,color:"#fff",fontSize:14,fontWeight:700}}>{ld?"...":"Sign In"}</button>
      </div>
    </div>
  </div>;
}

// ═══════ PROFILE MODAL ═══════
function ProfileMod({user,cfg,onClose,toast}){
  const[pin,sP]=useState("");const[pin2,sP2]=useState("");const[emo,sE]=useState(user.emoji||"😊");const[dnd,sD]=useState(user.dnd||false);
  const save=async()=>{const u={...user,emoji:emo,dnd};if(pin&&pin.length>=4&&pin===pin2)u.pin=pin;else if(pin&&pin!==pin2)return toast("PINs don't match","error");try{await DB.addUser(u);toast("Saved!","success");onClose(u)}catch{toast("Failed","error")}};
  return<Modal onClose={()=>onClose(null)}>
    <h3 style={{fontSize:16,fontWeight:700,marginBottom:14}}>Profile</h3>
    <div style={{textAlign:"center",marginBottom:14}}><div style={{width:56,height:56,borderRadius:"50%",background:`${cfg.primaryColor}18`,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:28,border:`2px solid ${cfg.primaryColor}33`}}>{emo}</div><div style={{fontSize:13,fontWeight:600,marginTop:5}}>{user.name}</div></div>
    <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:12}}>{EMO.map(e=><button key={e} onClick={()=>sE(e)} style={{width:30,height:30,borderRadius:6,border:emo===e?`2px solid ${cfg.primaryColor}`:"1px solid #1e293b",background:emo===e?`${cfg.primaryColor}18`:"#0c1220",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{e}</button>)}</div>
    <input value={pin} onChange={e=>sP(e.target.value)} type="password" placeholder="New PIN (optional)" maxLength={6} className="I" style={{marginBottom:5,fontSize:12}}/>
    <input value={pin2} onChange={e=>sP2(e.target.value)} type="password" placeholder="Confirm" maxLength={6} className="I" style={{marginBottom:12,fontSize:12}}/>
    <div className="sb" style={{padding:"9px 10px",borderRadius:8,background:"#0c1220",marginBottom:12}}>
      <div><div style={{fontSize:11,fontWeight:600}}>Do Not Disturb</div><div style={{fontSize:9,color:"#64748b"}}>Mute wash alerts</div></div>
      <div onClick={()=>sD(!dnd)} style={{width:36,height:18,borderRadius:9,background:dnd?cfg.primaryColor:"#334155",cursor:"pointer",position:"relative"}}><div style={{width:14,height:14,borderRadius:7,background:"#fff",position:"absolute",top:2,left:dnd?20:2,transition:"left .2s"}}/></div>
    </div>
    <div className="G2"><button onClick={()=>onClose(null)} className="B" style={{background:"#1e293b",color:"#94a3b8"}}>Cancel</button><button onClick={save} className="B" style={{background:cfg.primaryColor,color:"#fff"}}>Save</button></div>
  </Modal>;
}

// ═══════ CUSTOM TIME MODAL ═══════
function TimeMod({cfg,onStart,onClose}){
  const[m,sM]=useState(45);
  return<Modal onClose={onClose}>
    <h3 style={{fontSize:16,fontWeight:700,marginBottom:14}}>Custom wash time</h3>
    <div style={{textAlign:"center",marginBottom:14}}><div className="M" style={{fontSize:36,fontWeight:700,color:cfg.primaryColor}}>{m}<span style={{fontSize:14,color:"#64748b"}}> min</span></div></div>
    <input type="range" min={5} max={120} step={5} value={m} onChange={e=>sM(+e.target.value)} style={{width:"100%",marginBottom:6,accentColor:cfg.primaryColor}}/>
    <div className="sb" style={{fontSize:9,color:"#64748b",marginBottom:10}}><span>5m</span><span>120m</span></div>
    <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:14}}>{[15,30,45,60,90].map(x=><button key={x} onClick={()=>sM(x)} className="B" style={{background:m===x?`${cfg.primaryColor}22`:"#0c1220",color:"#e2e8f0",border:m===x?`1.5px solid ${cfg.primaryColor}`:"1px solid #1e293b",fontSize:11,padding:"5px 11px"}}>{x}m</button>)}</div>
    <div className="G2"><button onClick={onClose} className="B" style={{background:"#1e293b",color:"#94a3b8"}}>Cancel</button><button onClick={()=>onStart(m)} className="B" style={{background:cfg.primaryColor,color:"#fff"}}>Start</button></div>
  </Modal>;
}

// ═══════ EDIT SCHEDULE MODAL ═══════
function SchedMod({e,cfg,onClose,toast}){
  const[d,sD]=useState(e.dateTime?.split("T")[0]||"");const[t,sT]=useState(e.dateTime?.split("T")[1]||"");
  const save=async()=>{if(!d||!t)return toast("Pick date & time","error");try{await DB.updateScheduleEntry({...e,dateTime:`${d}T${t}`});toast("Rescheduled!","success");onClose()}catch{toast("Failed","error")}};
  const del=async()=>{try{await DB.removeScheduleEntry(e.id);toast("Deleted","info");onClose()}catch{toast("Failed","error")}};
  return<Modal onClose={onClose}>
    <h3 style={{fontSize:16,fontWeight:700,marginBottom:12}}>Edit schedule</h3>
    <div style={{fontSize:12,color:"#94a3b8",marginBottom:10}}>{e.cycleName} — {e.userName}</div>
    <input type="date" value={d} onChange={x=>sD(x.target.value)} className="I" style={{marginBottom:5,fontSize:12}}/>
    <input type="time" value={t} onChange={x=>sT(x.target.value)} className="I" style={{marginBottom:12,fontSize:12}}/>
    <div style={{display:"flex",gap:6}}><button onClick={del} className="B" style={{background:"#dc262622",color:"#ef4444",fontSize:12}}>Delete</button><button onClick={onClose} className="B" style={{flex:1,background:"#1e293b",color:"#94a3b8"}}>Cancel</button><button onClick={save} className="B" style={{flex:1,background:cfg.primaryColor,color:"#fff"}}>Save</button></div>
  </Modal>;
}

// ═══════ ADMIN EDIT USER MODAL ═══════
function EditUserMod({u,cfg,onClose,toast}){
  const[name,sN]=useState(u.name);const[pin,sP]=useState(u.pin);const[emo,sE]=useState(u.emoji||"😊");const[dnd,sD]=useState(u.dnd||false);const[dis,sDis]=useState(u.disabled||false);
  const save=async()=>{if(!name.trim()||!pin.trim())return toast("Required","error");await DB.addUser({...u,name:name.trim(),pin:pin.trim(),emoji:emo,dnd,disabled:dis});toast("Updated","success");onClose()};
  return<Modal onClose={onClose}>
    <h3 style={{fontSize:16,fontWeight:700,marginBottom:12}}>Edit user</h3>
    <div style={{textAlign:"center",marginBottom:10}}><div style={{width:48,height:48,borderRadius:"50%",background:`${cfg.primaryColor}18`,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{emo}</div></div>
    <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:10}}>{EMO.map(e=><button key={e} onClick={()=>sE(e)} style={{width:28,height:28,borderRadius:5,border:emo===e?`2px solid ${cfg.primaryColor}`:"1px solid #1e293b",background:emo===e?`${cfg.primaryColor}18`:"#0c1220",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{e}</button>)}</div>
    <input value={name} onChange={e=>sN(e.target.value)} placeholder="Name" className="I" style={{marginBottom:5,fontSize:12}}/>
    <input value={pin} onChange={e=>sP(e.target.value)} placeholder="PIN" className="I" style={{marginBottom:8,fontSize:12}}/>
    <div className="sb" style={{padding:"8px 10px",borderRadius:8,background:"#0c1220",marginBottom:6}}>
      <span style={{fontSize:11}}>DND</span>
      <div onClick={()=>sD(!dnd)} style={{width:34,height:16,borderRadius:8,background:dnd?cfg.primaryColor:"#334155",cursor:"pointer",position:"relative"}}><div style={{width:12,height:12,borderRadius:6,background:"#fff",position:"absolute",top:2,left:dnd?20:2,transition:"left .2s"}}/></div>
    </div>
    <div className="sb" style={{padding:"8px 10px",borderRadius:8,background:dis?"#dc262612":"#0c1220",marginBottom:10}}>
      <span style={{fontSize:11,color:dis?"#f87171":"#e2e8f0"}}>Account {dis?"disabled":"active"}</span>
      <div onClick={()=>sDis(!dis)} style={{width:34,height:16,borderRadius:8,background:dis?"#dc2626":"#059669",cursor:"pointer",position:"relative"}}><div style={{width:12,height:12,borderRadius:6,background:"#fff",position:"absolute",top:2,left:dis?2:20,transition:"left .2s"}}/></div>
    </div>
    <div className="G2"><button onClick={onClose} className="B" style={{background:"#1e293b",color:"#94a3b8"}}>Cancel</button><button onClick={save} className="B" style={{background:cfg.primaryColor,color:"#fff"}}>Save</button></div>
  </Modal>;
}

// ═══════ HEADER ═══════
function Head({cfg,user,admin,onOut,onProf,esp}){
  return<div className="sb" style={{padding:"9px 12px",borderBottom:"1px solid #1e293b",flexWrap:"wrap",gap:5}}>
    <div className="row"><span style={{fontSize:18}}>🫧</span><span style={{fontWeight:800,fontSize:15,letterSpacing:-.5}}>{admin?"Admin":cfg.appName}</span></div>
    <div className="row" style={{gap:5}}>
      <EspBadge esp={esp}/>
      {!admin&&<button onClick={onProf} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,padding:1}}>{user.emoji||"😊"}</button>}
      <button onClick={onOut} className="B" style={{background:"#1e293b",color:"#64748b",padding:"3px 7px",fontSize:9}}>Out</button>
    </div>
  </div>;
}

// ═══════ USER DASHBOARD ═══════
function UserDash({user:init,cfg,onOut,toast}){
  const[user,sUser]=useState(init);
  const[mac,sMac]=useState({running:false});const[sch,sSch]=useState([]);const[users,sUsers]=useState([]);const[esp,sEsp]=useState(null);
  const[cy,sCy]=useState(0);const[sd,sSd]=useState("");const[st,sSt]=useState("");
  const[now,sNow]=useState(Date.now());
  const[showProf,sProf]=useState(false);const[showTime,sTime]=useState(false);const[editSch,sEditSch]=useState(null);
  const af=useRef(false);const prev=useRef(false);

  useEffect(()=>{const a=DB.onMachineChange(sMac);const b=DB.onScheduleChange(sSch);const c=DB.onUsersChange(sUsers);const d=DB.onEsp32Status(sEsp);const iv=setInterval(()=>sNow(Date.now()),1000);return()=>{a();b();c();d();clearInterval(iv)}},[]);
  useEffect(()=>{if(prev.current&&!mac?.running&&!user.dnd){toast("Machine is free!","info");try{if("Notification"in window&&Notification.permission==="granted")new Notification("LaundryHub",{body:"Machine is free!"})}catch{}}prev.current=mac?.running||false},[mac?.running,user.dnd,toast]);
  useEffect(()=>{if(!mac?.running||mac.userId!==user.id)return;const end=mac.startTime+mac.durationMs;const alt=end-cfg.alertMin*60000;if(now>=alt&&now<end&&!af.current){af.current=true;toast(`${cfg.alertMin}m left!`,"warning");try{if("Notification"in window&&Notification.permission==="granted")new Notification("LaundryHub",{body:`${cfg.alertMin}m left!`})}catch{}}if(now>=end){DB.setMachine({running:false,lastUser:mac.userName,lastCycle:mac.cycleName,finishedAt:Date.now()});try{DB.addWashRecord({id:Date.now().toString(),userId:mac.userId,userName:mac.userName,cycleName:mac.cycleName,startTime:mac.startTime,finishedAt:Date.now(),durationMs:mac.durationMs})}catch{}toast("Wash complete!","success");af.current=false}},[now,mac,user.id,cfg,toast]);
  useEffect(()=>{try{if("Notification"in window&&Notification.permission==="default")Notification.requestPermission()}catch{}},[]);

  const my=mac?.running&&mac.userId===user.id;const busy=mac?.running&&mac.userId!==user.id;
  const prog=mac?.running?Math.min(1,(now-mac.startTime)/mac.durationMs):0;
  const rm=mac?.running?Math.max(0,(mac.startTime+mac.durationMs)-now):0;
  const rmM=Math.floor(rm/60000);const rmS=Math.floor((rm%60000)/1000);
  const bu=users.find(x=>x.id===mac?.userId);

  const go=async(min,label)=>{if(mac?.running)return;await DB.setMachine({running:true,userId:user.id,userName:user.name,cycleName:label,startTime:Date.now(),durationMs:min*60000});af.current=false;toast(`${label} — ${min}m`,"success")};
  const start=()=>{const c=cfg.washCycles[cy];go(c.min,c.name)};
  const startC=m=>{sTime(false);go(m,"Custom")};
  const stop=async()=>{if(!my)return;await DB.setMachine({running:false,lastUser:user.name,lastCycle:mac.cycleName,finishedAt:Date.now()});toast("Stopped","info")};
  const ext=async m=>{if(!my||!mac?.running)return;await DB.setMachine({...mac,durationMs:mac.durationMs+m*60000});toast(`+${m}m`,"success")};
  const addS=async()=>{if(!sd||!st)return toast("Pick date & time","error");const c=cfg.washCycles[cy];await DB.addScheduleEntry({id:Date.now().toString(),userId:user.id,userName:user.name,userEmoji:user.emoji||"😊",cycleName:c.name,minutes:c.min,dateTime:`${sd}T${st}`});sSd("");sSt("");toast("Scheduled!","success")};
  const fmt=d=>{const x=new Date(d);return x.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})+" "+x.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})};

  return<div style={{minHeight:"100vh",background:"#070b12"}}>
    <Head cfg={cfg} user={user} onOut={onOut} onProf={()=>sProf(true)} esp={esp}/>
    {showProf&&<ProfileMod user={user} cfg={cfg} onClose={u=>{if(u?.id)sUser(u);sProf(false)}} toast={toast}/>}
    {showTime&&<TimeMod cfg={cfg} onStart={startC} onClose={()=>sTime(false)}/>}
    {editSch&&<SchedMod e={editSch} cfg={cfg} onClose={()=>sEditSch(null)} toast={toast}/>}
    <div style={{maxWidth:600,margin:"0 auto",padding:"12px 10px"}}>

      {/* Status */}
      <div className="C" style={{display:"flex",flexDirection:"column",alignItems:"center",padding:22,marginBottom:12,borderColor:busy?"#dc262630":my?`${cfg.primaryColor}40`:"#1e293b"}}>
        <Wash on={mac?.running} prog={prog} c={cfg.primaryColor}/>
        {mac?.running?<div style={{textAlign:"center",marginTop:12,width:"100%"}}>
          <div className="P" style={{background:busy?"#dc262618":`${cfg.primaryColor}18`,color:busy?"#f87171":cfg.primaryColor,marginBottom:5}}>{busy?"IN USE":"YOUR WASH"}</div>
          <div className="row" style={{justifyContent:"center",marginBottom:2}}>{bu&&<span style={{fontSize:14}}>{bu.emoji||"😊"}</span>}<span style={{fontSize:14,fontWeight:700}}>{mac.userName}</span></div>
          <div style={{fontSize:15,fontWeight:600}}>{mac.cycleName}</div>
          <div className="M" style={{color:"#94a3b8",fontSize:26,marginTop:3}}>{rmM}:{String(rmS).padStart(2,"0")}</div>
          {my&&<div style={{marginTop:10}}>
            <div style={{display:"flex",gap:5,justifyContent:"center",marginBottom:8,flexWrap:"wrap"}}>{[5,10,15,30].map(m=><button key={m} onClick={()=>ext(m)} className="B" style={{background:`${cfg.primaryColor}18`,color:cfg.primaryColor,border:`1px solid ${cfg.primaryColor}33`,fontSize:11,padding:"5px 10px"}}>+{m}m</button>)}</div>
            <button onClick={stop} className="B" style={{background:"#dc2626",color:"#fff",width:"100%",padding:"9px 0"}}>Stop</button>
          </div>}
        </div>:<div style={{textAlign:"center",marginTop:12}}>
          <div className="P" style={{background:"#05966918",color:"#34d399"}}>AVAILABLE</div>
          {mac?.lastUser&&<div style={{fontSize:9,color:"#475569",marginTop:3}}>Last: {mac.lastUser}</div>}
        </div>}
      </div>

      {/* Start */}
      {!mac?.running&&<div className="C" style={{marginBottom:12}}>
        <div className="sb" style={{marginBottom:8}}><span style={{fontSize:13,fontWeight:700}}>Start wash</span><button onClick={()=>sTime(true)} className="B" style={{background:`${cfg.accentColor}18`,color:cfg.accentColor,fontSize:10,padding:"4px 9px",border:`1px solid ${cfg.accentColor}33`}}>Custom time</button></div>
        <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:8}}>{cfg.washCycles.map((c,i)=><button key={i} onClick={()=>sCy(i)} className="B" style={{background:cy===i?`${cfg.primaryColor}18`:"#0c1220",color:"#e2e8f0",border:cy===i?`1.5px solid ${cfg.primaryColor}`:"1px solid #1e293b",fontSize:10,padding:"6px 9px"}}>{c.name} <span style={{color:"#64748b"}}>{c.min}m</span></button>)}</div>
        <div className="row" style={{padding:"7px 9px",borderRadius:7,background:"#0c1220",marginBottom:8,fontSize:11,color:"#94a3b8"}}><span style={{fontWeight:600,color:"#e2e8f0"}}>{cfg.washCycles[cy].name}</span><span>·</span><span>{cfg.washCycles[cy].min}m</span><span>·</span><span>{cfg.washCycles[cy].temp}</span></div>
        <button onClick={start} className="B" style={{width:"100%",padding:"11px 0",background:cfg.primaryColor,color:"#fff",fontSize:14,fontWeight:700}}>Start</button>
      </div>}

      {/* Schedule */}
      <div className="C" style={{marginBottom:12}}>
        <span style={{fontSize:13,fontWeight:700}}>Schedule</span>
        <div style={{display:"flex",gap:5,marginTop:8,marginBottom:7}}><input type="date" value={sd} onChange={e=>sSd(e.target.value)} className="I" style={{flex:1,fontSize:12}}/><input type="time" value={st} onChange={e=>sSt(e.target.value)} className="I" style={{flex:1,fontSize:12}}/></div>
        <button onClick={addS} className="B" style={{width:"100%",background:cfg.accentColor,color:"#0f172a",fontWeight:700}}>Schedule</button>
      </div>

      {/* Upcoming */}
      {sch.length>0&&<div className="C" style={{marginBottom:12}}>
        <span style={{fontSize:13,fontWeight:700}}>Upcoming ({sch.length})</span>
        <div style={{marginTop:8}}>{sch.map(s=><div key={s.id} className="sb" style={{padding:"7px 8px",borderRadius:7,background:"#0c1220",marginBottom:3}}>
          <div className="row"><span style={{fontSize:12}}>{s.userEmoji||"😊"}</span><div><div style={{fontSize:11,fontWeight:600}}>{s.userName}{s.userId===user.id&&<span style={{color:cfg.primaryColor,fontSize:8}}> you</span>}</div><div style={{fontSize:9,color:"#64748b"}}>{s.cycleName} · {fmt(s.dateTime)}</div></div></div>
          {s.userId===user.id&&<button onClick={()=>sEditSch(s)} className="B" style={{background:`${cfg.primaryColor}18`,color:cfg.primaryColor,fontSize:9,padding:"3px 7px"}}>Edit</button>}
        </div>)}</div>
      </div>}

      {/* Housemates */}
      <div className="C">
        <span style={{fontSize:13,fontWeight:700}}>Housemates</span>
        <div className="G2" style={{marginTop:8}}>{users.filter(x=>!x.disabled).map(u=><div key={u.id} className="row" style={{padding:"7px 8px",borderRadius:7,background:"#0c1220"}}>
          <div className="A" style={{width:26,height:26,fontSize:13,background:u.id===mac?.userId?`${cfg.primaryColor}30`:"#1a2236"}}>{u.emoji||"😊"}</div>
          <div><div style={{fontSize:10,fontWeight:600}}>{u.name}</div><div style={{fontSize:8,color:u.id===mac?.userId?"#34d399":u.dnd?"#f59e0b":"#475569"}}>{u.id===mac?.userId?"Washing":u.dnd?"DND":"Free"}</div></div>
        </div>)}</div>
      </div>
    </div>
  </div>;
}

// ═══════ ADMIN DASHBOARD ═══════
function AdminDash({cfg,setCfg,onOut,toast}){
  const[users,sU]=useState([]);const[mac,sM]=useState({running:false});const[sch,sSch]=useState([]);const[esp,sE]=useState(null);const[hist,sH]=useState([]);
  const[nn,sNN]=useState("");const[np,sNP]=useState("");
  const[tab,sT]=useState("dash");
  const[ip,sIp]=useState(cfg.esp32Ip||"");const[cP,sCP]=useState(cfg.primaryColor);const[cA,sCA]=useState(cfg.accentColor);const[aN,sAN]=useState(cfg.appName);const[aM,sAM]=useState(cfg.alertMin);const[mW,sMW]=useState(cfg.maxMin||120);
  const[eu,sEU]=useState(null);const[now,sNow]=useState(Date.now());

  useEffect(()=>{const a=DB.onUsersChange(sU);const b=DB.onMachineChange(sM);const c=DB.onScheduleChange(sSch);const d=DB.onEsp32Status(sE);const e=DB.onHistoryChange(sH);const iv=setInterval(()=>sNow(Date.now()),1000);return()=>{a();b();c();d();e();clearInterval(iv)}},[]);

  const addU=async()=>{if(!nn.trim()||!np.trim())return toast("Required","error");if(np.length<4)return toast("PIN 4+","error");if(users.find(u=>u.name.toLowerCase()===nn.trim().toLowerCase()))return toast("Exists","error");await DB.addUser({id:Date.now().toString(),name:nn.trim(),pin:np.trim(),emoji:"😊",dnd:false,disabled:false,created:new Date().toISOString()});sNN("");sNP("");toast(`${nn.trim()} added`,"success")};
  const saveCfg=async()=>{const u={...cfg,primaryColor:cP,accentColor:cA,appName:aN,esp32Ip:ip,alertMin:+aM||5,maxMin:+mW||120};await DB.setConfig(u);setCfg(u);toast("Saved","success")};
  const prog=mac?.running?Math.min(1,(now-mac.startTime)/mac.durationMs):0;
  const rmM=mac?.running?Math.ceil(Math.max(0,(mac.startTime+mac.durationMs)-now)/60000):0;

  // Wash count per user
  const washCount={};hist.forEach(h=>{washCount[h.userName]=(washCount[h.userName]||0)+1});

  const tabs=[{id:"dash",l:"Dashboard"},{id:"users",l:"Users"},{id:"ctrl",l:"Control"},{id:"log",l:"History"},{id:"cfg",l:"Settings"}];

  return<div style={{minHeight:"100vh",background:"#070b12"}}>
    <Head cfg={cfg} user={{name:"Admin",emoji:"🛡️"}} admin onOut={onOut} esp={esp}/>
    {eu&&<EditUserMod u={eu} cfg={cfg} onClose={()=>sEU(null)} toast={toast}/>}
    <div style={{maxWidth:660,margin:"0 auto",padding:"12px 10px"}}>
      {/* Tabs */}
      <div style={{display:"flex",gap:3,marginBottom:12,overflowX:"auto",paddingBottom:2}}>{tabs.map(t=><button key={t.id} onClick={()=>sT(t.id)} className="B" style={{background:tab===t.id?`${cfg.primaryColor}18`:"transparent",color:tab===t.id?"#e2e8f0":"#64748b",border:tab===t.id?`1.5px solid ${cfg.primaryColor}`:"1.5px solid transparent",fontSize:11,padding:"6px 12px",whiteSpace:"nowrap"}}>{t.l}</button>)}</div>

      {/* ═══ DASHBOARD ═══ */}
      {tab==="dash"&&<>
        <div className="G4" style={{marginBottom:12}}>
          <div className="S"><div style={{fontSize:9,color:"#64748b"}}>Users</div><div style={{fontSize:20,fontWeight:700}}>{users.filter(x=>!x.disabled).length}</div></div>
          <div className="S"><div style={{fontSize:9,color:"#64748b"}}>Scheduled</div><div style={{fontSize:20,fontWeight:700}}>{sch.length}</div></div>
          <div className="S"><div style={{fontSize:9,color:"#64748b"}}>Total washes</div><div style={{fontSize:20,fontWeight:700}}>{hist.length}</div></div>
          <div className="S"><div style={{fontSize:9,color:"#64748b"}}>Machine</div><div style={{fontSize:20,fontWeight:700,color:mac?.running?"#34d399":"#64748b"}}>{mac?.running?"ON":"OFF"}</div></div>
        </div>

        {/* Live machine */}
        <div className="C" style={{marginBottom:12,display:"flex",alignItems:"center",gap:12}}>
          <Wash on={mac?.running} prog={prog} c={cfg.primaryColor} sz={90}/>
          <div style={{flex:1}}>{mac?.running?<>
            <div className="P" style={{background:`${cfg.primaryColor}18`,color:cfg.primaryColor,marginBottom:3}}>RUNNING</div>
            <div style={{fontSize:13,fontWeight:700}}>{mac.userName} — {mac.cycleName}</div>
            <div style={{fontSize:11,color:"#94a3b8"}}>{rmM}m left</div>
            <button onClick={()=>{DB.setMachine({running:false});toast("Stopped","warning")}} className="B" style={{marginTop:6,background:"#dc2626",color:"#fff",fontSize:10,padding:"5px 12px"}}>Force Stop</button>
          </>:<>
            <div className="P" style={{background:"#05966918",color:"#34d399"}}>IDLE</div>
            {mac?.lastUser&&<div style={{fontSize:10,color:"#475569",marginTop:2}}>Last: {mac.lastUser}</div>}
          </>}</div>
        </div>

        {/* ESP32 detail */}
        <div className="C" style={{marginBottom:12}}>
          <span style={{fontSize:12,fontWeight:700}}>ESP32 Hardware</span>
          {esp?<div className="G2" style={{marginTop:8}}>
            <div style={{fontSize:11,color:"#94a3b8"}}>IP: <span className="M" style={{color:"#e2e8f0"}}>{esp.ip||"—"}</span></div>
            <div style={{fontSize:11,color:"#94a3b8"}}>Signal: <span className="M" style={{color:"#e2e8f0"}}>{esp.rssi} dBm</span></div>
            <div style={{fontSize:11,color:"#94a3b8"}}>Relay: <span style={{color:esp.relay?"#34d399":"#64748b"}}>{esp.relay?"ON":"OFF"}</span></div>
            <div style={{fontSize:11,color:"#94a3b8"}}>Up: <span className="M" style={{color:"#e2e8f0"}}>{esp.uptime?`${Math.floor(esp.uptime/3600)}h${Math.floor(esp.uptime%3600/60)}m`:"—"}</span></div>
          </div>:<div style={{fontSize:11,color:"#475569",marginTop:6}}>No data — flash Firebase firmware to ESP32</div>}
        </div>

        {/* User wash stats */}
        <div className="C" style={{marginBottom:12}}>
          <span style={{fontSize:12,fontWeight:700}}>User wash count</span>
          <div style={{marginTop:8}}>{users.map(u=>{const cnt=washCount[u.name]||0;return<div key={u.id} className="sb" style={{padding:"5px 0",borderBottom:"1px solid #1e293b08"}}>
            <div className="row"><span style={{fontSize:12}}>{u.emoji||"😊"}</span><span style={{fontSize:11}}>{u.name}</span>{u.disabled&&<span className="P" style={{background:"#dc262618",color:"#f87171"}}>disabled</span>}</div>
            <div className="row" style={{gap:4}}><div style={{width:Math.min(cnt*12,100),height:6,borderRadius:3,background:cfg.primaryColor,transition:"width .3s"}}/><span className="M" style={{fontSize:10,color:"#94a3b8"}}>{cnt}</span></div>
          </div>})}</div>
        </div>

        {/* Upcoming mini */}
        {sch.length>0&&<div className="C">
          <span style={{fontSize:12,fontWeight:700}}>Upcoming ({sch.length})</span>
          <div style={{marginTop:6}}>{sch.slice(0,4).map(s=><div key={s.id} style={{padding:"4px 0",fontSize:10,color:"#94a3b8"}}><strong style={{color:"#e2e8f0"}}>{s.userName}</strong> — {s.cycleName} · {new Date(s.dateTime).toLocaleString()}</div>)}</div>
        </div>}
      </>}

      {/* ═══ USERS ═══ */}
      {tab==="users"&&<div className="C">
        <span style={{fontSize:15,fontWeight:700}}>Manage Users</span>
        <div style={{display:"flex",gap:5,marginTop:12,marginBottom:12,flexWrap:"wrap"}}>
          <input value={nn} onChange={e=>sNN(e.target.value)} placeholder="Name" className="I" style={{flex:2,minWidth:90,fontSize:12}}/>
          <input value={np} onChange={e=>sNP(e.target.value)} placeholder="PIN" maxLength={6} className="I" style={{flex:1,minWidth:60,fontSize:12}}/>
          <button onClick={addU} className="B" style={{background:cfg.primaryColor,color:"#fff"}}>Add</button>
        </div>
        {users.map(u=><div key={u.id} className="sb" style={{padding:"9px 10px",borderRadius:9,background:u.disabled?"#dc262608":"#0c1220",marginBottom:4,border:u.disabled?"1px solid #dc262620":"1px solid transparent"}}>
          <div className="row">
            <div className="A" style={{width:30,height:30,fontSize:14,background:`${cfg.primaryColor}18`}}>{u.emoji||"😊"}</div>
            <div><div style={{fontWeight:600,fontSize:12}}>{u.name}{u.disabled&&<span style={{color:"#f87171",fontSize:9,marginLeft:4}}>disabled</span>}</div><div className="M" style={{fontSize:9,color:"#64748b"}}>PIN:{u.pin} · {u.dnd?"DND":"Notifs"}</div></div>
          </div>
          <div className="row" style={{gap:3}}>
            <button onClick={()=>sEU(u)} className="B" style={{background:`${cfg.primaryColor}18`,color:cfg.primaryColor,fontSize:9,padding:"3px 7px"}}>Edit</button>
            <button onClick={()=>{DB.removeUser(u.id);toast("Removed","info")}} className="B" style={{background:"#dc262618",color:"#ef4444",fontSize:9,padding:"3px 7px"}}>Del</button>
          </div>
        </div>)}
      </div>}

      {/* ═══ CONTROL ═══ */}
      {tab==="ctrl"&&<div className="C">
        <span style={{fontSize:15,fontWeight:700}}>Machine Control</span>
        <div style={{padding:12,borderRadius:9,background:"#0c1220",margin:"12px 0",border:`1px solid ${mac?.running?"#dc262630":"#22c55e30"}`}}>
          <div style={{fontSize:12,fontWeight:700}}>{mac?.running?`Running — ${mac.userName} (${mac.cycleName})`:"Idle"}</div>
          {mac?.running&&<button onClick={()=>{DB.setMachine({running:false});toast("Stopped","warning")}} className="B" style={{marginTop:8,background:"#dc2626",color:"#fff",fontSize:11}}>Force Stop</button>}
        </div>

        <span style={{fontSize:12,fontWeight:600}}>Quick start for user</span>
        <div style={{marginTop:8,marginBottom:14}}>{users.filter(x=>!x.disabled).map(u=><div key={u.id} className="sb" style={{padding:"7px 8px",borderRadius:7,background:"#0c1220",marginBottom:3}}>
          <div className="row"><span style={{fontSize:12}}>{u.emoji||"😊"}</span><span style={{fontSize:11,fontWeight:600}}>{u.name}</span></div>
          <div className="row" style={{gap:3}}>
            <button onClick={()=>{if(mac?.running)return toast("Machine busy","error");DB.setMachine({running:true,userId:u.id,userName:u.name,cycleName:"Admin Start",startTime:Date.now(),durationMs:45*60000});toast(`Started for ${u.name}`,"success")}} className="B" style={{background:"#05966918",color:"#34d399",fontSize:9,padding:"3px 8px"}}>Start 45m</button>
            {mac?.running&&mac.userId===u.id&&<button onClick={()=>{DB.setMachine({running:false});toast("Stopped","info")}} className="B" style={{background:"#dc262618",color:"#f87171",fontSize:9,padding:"3px 8px"}}>Stop</button>}
          </div>
        </div>)}</div>

        <span style={{fontSize:12,fontWeight:600}}>Manual relay</span>
        <div className="G2" style={{marginTop:6}}>
          <button onClick={()=>{DB.setMachine({running:true,userId:"admin",userName:"Admin",cycleName:"Manual",startTime:Date.now(),durationMs:300000});toast("ON (5m)","success")}} className="B" style={{background:"#059669",color:"#fff"}}>ON (5m test)</button>
          <button onClick={()=>{DB.setMachine({running:false});toast("OFF","info")}} className="B" style={{background:"#dc2626",color:"#fff"}}>OFF</button>
        </div>

        {sch.length>0&&<div style={{marginTop:14}}>
          <span style={{fontSize:12,fontWeight:600}}>Scheduled ({sch.length})</span>
          <div style={{marginTop:6}}>{sch.map(s=><div key={s.id} style={{padding:"4px 7px",borderRadius:5,background:"#0c1220",marginBottom:2,fontSize:10}}><strong>{s.userName}</strong> — {s.cycleName} · {new Date(s.dateTime).toLocaleString()}</div>)}</div>
          <button onClick={()=>{DB.clearSchedule();toast("Cleared","info")}} className="B" style={{marginTop:6,background:"#dc262618",color:"#ef4444",fontSize:10}}>Clear all</button>
        </div>}
      </div>}

      {/* ═══ HISTORY ═══ */}
      {tab==="log"&&<div className="C">
        <span style={{fontSize:15,fontWeight:700}}>Wash History ({hist.length})</span>
        <div style={{marginTop:10}}>{hist.length===0?<div style={{color:"#475569",fontSize:12}}>No washes yet</div>:hist.slice(0,30).map(h=><div key={h.id} className="sb" style={{padding:"6px 0",borderBottom:"1px solid #1e293b10"}}>
          <div><div style={{fontSize:11,fontWeight:600}}>{h.userName} — {h.cycleName}</div><div style={{fontSize:9,color:"#64748b"}}>{new Date(h.finishedAt).toLocaleString()}</div></div>
          <span className="M" style={{fontSize:10,color:"#94a3b8"}}>{Math.round(h.durationMs/60000)}m</span>
        </div>)}</div>
      </div>}

      {/* ═══ SETTINGS ═══ */}
      {tab==="cfg"&&<div className="C">
        <span style={{fontSize:15,fontWeight:700}}>Settings</span>
        <div style={{display:"grid",gap:8,marginTop:12}}>
          <div><label style={{fontSize:10,color:"#94a3b8",marginBottom:3,display:"block"}}>App name</label><input value={aN} onChange={e=>sAN(e.target.value)} className="I" style={{fontSize:12}}/></div>
          <div className="G2">
            <div><label style={{fontSize:10,color:"#94a3b8",marginBottom:3,display:"block"}}>Primary</label><div className="row"><input type="color" value={cP} onChange={e=>sCP(e.target.value)} style={{width:32,height:28,border:"none",borderRadius:5,cursor:"pointer"}}/><input value={cP} onChange={e=>sCP(e.target.value)} className="I" style={{fontSize:11}}/></div></div>
            <div><label style={{fontSize:10,color:"#94a3b8",marginBottom:3,display:"block"}}>Accent</label><div className="row"><input type="color" value={cA} onChange={e=>sCA(e.target.value)} style={{width:32,height:28,border:"none",borderRadius:5,cursor:"pointer"}}/><input value={cA} onChange={e=>sCA(e.target.value)} className="I" style={{fontSize:11}}/></div></div>
          </div>
          <div className="G2">
            <div><label style={{fontSize:10,color:"#94a3b8",marginBottom:3,display:"block"}}>Alert before (min)</label><input type="number" value={aM} onChange={e=>sAM(e.target.value)} className="I" style={{fontSize:12}} min="1" max="15"/></div>
            <div><label style={{fontSize:10,color:"#94a3b8",marginBottom:3,display:"block"}}>Max wash (min)</label><input type="number" value={mW} onChange={e=>sMW(e.target.value)} className="I" style={{fontSize:12}} min="30" max="180"/></div>
          </div>
          <div><label style={{fontSize:10,color:"#94a3b8",marginBottom:3,display:"block"}}>ESP32 IP (local fallback)</label><input value={ip} onChange={e=>sIp(e.target.value)} className="I" style={{fontSize:12}} placeholder="Optional"/></div>
          <button onClick={saveCfg} className="B" style={{width:"100%",padding:"11px 0",background:cfg.primaryColor,color:"#fff",fontSize:13,fontWeight:700}}>Save</button>
        </div>
      </div>}
    </div>
  </div>;
}

// ═══════ MAIN ═══════
export default function Home(){
  const[s,sS]=useState(null);const[cfg,sCfg]=useState(DEF);const[td,sTD]=useState(null);const[rdy,sRdy]=useState(false);
  const toast=useCallback((m,t)=>sTD({message:m,type:t,key:Date.now()}),[]);
  
  // Load session from localStorage on mount
  useEffect(()=>{try{const saved=localStorage.getItem("lh_session");if(saved)sS(JSON.parse(saved))}catch{}},[]);
  
  // Save session to localStorage whenever it changes
  const login=(u)=>{sS(u);try{localStorage.setItem("lh_session",JSON.stringify(u))}catch{}};
  const logout=()=>{sS(null);try{localStorage.removeItem("lh_session")}catch{}};
  
  useEffect(()=>{const u=DB.onConfigChange(c=>{if(c)sCfg(p=>({...DEF,...c}));sRdy(true)});return()=>u()},[]);
  if(!rdy)return<div style={{minHeight:"100vh",background:"#070b12",display:"flex",alignItems:"center",justifyContent:"center"}}><GS p={DEF.primaryColor}/><div style={{textAlign:"center",animation:"pu 1.5s infinite"}}><div style={{fontSize:32}}>🫧</div><div style={{color:"#64748b",marginTop:4,fontSize:12}}>Connecting...</div></div></div>;
  return<><GS p={cfg.primaryColor}/>{td&&<Toast{...td}onClose={()=>sTD(null)}/>}{!s?<Login cfg={cfg} onLogin={login}/>:s.role==="admin"?<AdminDash cfg={cfg} setCfg={sCfg} onOut={logout} toast={toast}/>:<UserDash user={s} cfg={cfg} onOut={logout} toast={toast}/>}</>;
}
