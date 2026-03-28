import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue, remove } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FB_API_KEY || "YOUR_API_KEY",
  authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN || "YOUR_PROJECT.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FB_DB_URL || "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID || "YOUR_PROJECT",
  storageBucket: process.env.NEXT_PUBLIC_FB_STORAGE || "YOUR_PROJECT.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FB_SENDER_ID || "000000000000",
  appId: process.env.NEXT_PUBLIC_FB_APP_ID || "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export const DB = {
  async getUsers() { const s = await get(ref(db,"users")); return s.exists()?Object.values(s.val()):[]; },
  async addUser(user) { await set(ref(db,`users/${user.id}`),user); },
  async removeUser(id) { await remove(ref(db,`users/${id}`)); },
  onUsersChange(cb) { return onValue(ref(db,"users"),s=>cb(s.exists()?Object.values(s.val()):[])); },

  async getMachine() { const s=await get(ref(db,"machine")); return s.exists()?s.val():{running:false}; },
  async setMachine(state) { await set(ref(db,"machine"),state); },
  onMachineChange(cb) { return onValue(ref(db,"machine"),s=>cb(s.exists()?s.val():{running:false})); },

  async getSchedule() { const s=await get(ref(db,"schedule")); if(!s.exists())return[]; return Object.values(s.val()).sort((a,b)=>a.dateTime.localeCompare(b.dateTime)); },
  async addScheduleEntry(entry) { await set(ref(db,`schedule/${entry.id}`),entry); },
  async updateScheduleEntry(entry) { await set(ref(db,`schedule/${entry.id}`),entry); },
  async removeScheduleEntry(id) { await remove(ref(db,`schedule/${id}`)); },
  async clearSchedule() { await remove(ref(db,"schedule")); },
  onScheduleChange(cb) { return onValue(ref(db,"schedule"),s=>{ if(!s.exists())return cb([]); cb(Object.values(s.val()).sort((a,b)=>a.dateTime.localeCompare(b.dateTime))); }); },

  async getConfig() { const s=await get(ref(db,"config")); return s.exists()?s.val():null; },
  async setConfig(config) { await set(ref(db,"config"),config); },
  onConfigChange(cb) { return onValue(ref(db,"config"),s=>cb(s.exists()?s.val():null)); },

  // ESP32 status — written by ESP32, read by web app
  onEsp32Status(cb) { return onValue(ref(db,"esp32_status"),s=>cb(s.exists()?s.val():null)); },

  // Wash history
  async addWashRecord(record) { await set(ref(db,`history/${record.id}`),record); },
  onHistoryChange(cb) { return onValue(ref(db,"history"),s=>{ if(!s.exists())return cb([]); cb(Object.values(s.val()).sort((a,b)=>(b.finishedAt||0)-(a.finishedAt||0))); }); },
};

export default DB;
