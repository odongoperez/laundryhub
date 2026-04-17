// GET/PUT /api/admin/config
// GET  -> returns { relay_on_duration, post_wash_delay }
// PUT  -> { relay_on_duration?, post_wash_delay? } (seconds)
//
// Simple admin-token gate. Set ADMIN_TOKEN in Vercel env.

import { getDatabase } from 'firebase-admin/database';
import { initFirebaseAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

const DEFAULTS = { relay_on_duration: 300, post_wash_delay: 300 };
const MIN_SECONDS = 30;
const MAX_SECONDS = 3600;

function authed(req) {
  const header = req.headers.get('x-admin-token');
  return header && header === process.env.ADMIN_TOKEN;
}

export async function GET(req) {
  if (!authed(req)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  initFirebaseAdmin();
  const snap = await getDatabase().ref('/admin/config').once('value');
  return Response.json({ ...DEFAULTS, ...(snap.val() || {}) });
}

export async function PUT(req) {
  if (!authed(req)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const update = {};
    for (const key of ['relay_on_duration', 'post_wash_delay']) {
      if (body[key] != null) {
        const n = Number(body[key]);
        if (!Number.isFinite(n) || n < MIN_SECONDS || n > MAX_SECONDS) {
          return Response.json(
            { error: `${key} must be between ${MIN_SECONDS} and ${MAX_SECONDS} seconds` },
            { status: 400 }
          );
        }
        update[key] = n;
      }
    }
    if (Object.keys(update).length === 0) {
      return Response.json({ error: 'no valid fields' }, { status: 400 });
    }
    initFirebaseAdmin();
    await getDatabase().ref('/admin/config').update(update);
    const snap = await getDatabase().ref('/admin/config').once('value');
    return Response.json({ ok: true, config: { ...DEFAULTS, ...(snap.val() || {}) } });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
