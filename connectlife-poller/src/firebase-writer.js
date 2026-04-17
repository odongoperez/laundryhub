import admin from 'firebase-admin';

export class FirebaseWriter {
  constructor({ databaseURL, serviceAccount, logger = console }) {
    this.log = logger;
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL,
      });
    }
    this.db = admin.database();
  }

  ref(path) { return this.db.ref(path); }

  async writeStatus(washer) {
    await this.ref('/status').set(washer);
  }

  async writeRelayCommand({ relay_on, reason, updated_at }) {
    await this.ref('/relay_command').set({ on: relay_on, reason, updated_at });
  }

  async writeRelayState(fsm) {
    await this.ref('/relay_state').set(fsm);
  }

  async readRelayState() {
    const snap = await this.ref('/relay_state').once('value');
    return snap.val() || null;
  }

  async readAdminConfig() {
    const snap = await this.ref('/admin/config').once('value');
    return snap.val() || {};
  }

  async readAndClearCommand(name) {
    const ref = this.ref(`/commands/${name}`);
    const snap = await ref.once('value');
    const val = snap.val();
    if (val) {
      await ref.remove();
      return val;
    }
    return null;
  }

  async appendEvent(event) {
    const ref = this.ref('/events').push();
    await ref.set({ ...event, ts: Date.now() });
    // Keep only the most recent 200 events
    const all = await this.ref('/events').orderByChild('ts').once('value');
    const entries = [];
    all.forEach(child => { entries.push({ key: child.key, ts: child.val().ts }); });
    entries.sort((a, b) => a.ts - b.ts);
    const toDelete = entries.slice(0, Math.max(0, entries.length - 200));
    for (const { key } of toDelete) {
      await this.ref(`/events/${key}`).remove();
    }
  }

  async writeHealth(payload) {
    await this.ref('/health').set(payload);
  }
}
