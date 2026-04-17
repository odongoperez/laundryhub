// Client-side Firebase — only used for reading /status and /relay_state in the
// browser via the realtime listener. Writes are all routed through API routes
// so the admin token gate works.

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyANBaOBmrvo3KuXPl9cjYpmRrFwFz78MYc',
  authDomain: 'laundryhub-4e35b.firebaseapp.com',
  databaseURL: 'https://laundryhub-4e35b-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'laundryhub-4e35b',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getDatabase(firebaseApp);
