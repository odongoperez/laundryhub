// Shared Firebase Admin initialisation for Vercel API routes.
// Set FIREBASE_SERVICE_ACCOUNT_JSON and FIREBASE_DATABASE_URL in Vercel env.

import { initializeApp, getApps, cert } from 'firebase-admin/app';

export function initFirebaseAdmin() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON env var not set');
  const serviceAccount = JSON.parse(raw);
  initializeApp({
    credential: cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
      || 'https://laundryhub-4e35b-default-rtdb.europe-west1.firebasedatabase.app',
  });
}
