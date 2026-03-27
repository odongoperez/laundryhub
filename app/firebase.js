import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue, remove, update } from "firebase/database";

// ═══════════════════════════════════════════════════════════════
//  PASTE YOUR FIREBASE CONFIG HERE (from Firebase Console)
//  Steps: Firebase Console → Project Settings → Your apps → Config
// ═══════════════════════════════════════════════════════════════
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

// ─── Database API ───

export const DB = {
  // ── Users ──
  async getUsers() {
    const snap = await get(ref(db, "users"));
    return snap.exists() ? Object.values(snap.val()) : [];
  },

  async addUser(user) {
    await set(ref(db, `users/${user.id}`), user);
  },

  async removeUser(id) {
    await remove(ref(db, `users/${id}`));
  },

  onUsersChange(callback) {
    return onValue(ref(db, "users"), (snap) => {
      callback(snap.exists() ? Object.values(snap.val()) : []);
    });
  },

  // ── Machine State ──
  async getMachine() {
    const snap = await get(ref(db, "machine"));
    return snap.exists() ? snap.val() : { running: false };
  },

  async setMachine(state) {
    await set(ref(db, "machine"), state);
  },

  onMachineChange(callback) {
    return onValue(ref(db, "machine"), (snap) => {
      callback(snap.exists() ? snap.val() : { running: false });
    });
  },

  // ── Schedule ──
  async getSchedule() {
    const snap = await get(ref(db, "schedule"));
    if (!snap.exists()) return [];
    return Object.values(snap.val()).sort((a, b) => a.dateTime.localeCompare(b.dateTime));
  },

  async addScheduleEntry(entry) {
    await set(ref(db, `schedule/${entry.id}`), entry);
  },

  async removeScheduleEntry(id) {
    await remove(ref(db, `schedule/${id}`));
  },

  async clearSchedule() {
    await remove(ref(db, "schedule"));
  },

  onScheduleChange(callback) {
    return onValue(ref(db, "schedule"), (snap) => {
      if (!snap.exists()) return callback([]);
      callback(Object.values(snap.val()).sort((a, b) => a.dateTime.localeCompare(b.dateTime)));
    });
  },

  // ── Config ──
  async getConfig() {
    const snap = await get(ref(db, "config"));
    return snap.exists() ? snap.val() : null;
  },

  async setConfig(config) {
    await set(ref(db, "config"), config);
  },

  onConfigChange(callback) {
    return onValue(ref(db, "config"), (snap) => {
      callback(snap.exists() ? snap.val() : null);
    });
  },
};

export default DB;
