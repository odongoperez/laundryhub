// POST /api/session/stop
// Body: { user: string }
// Writes /commands/force_stop; poller picks it up and cuts the relay immediately.

import { getDatabase } from 'firebase-admin/database';
import { initFirebaseAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const { user } = await req.json();
    if (!user || typeof user !== 'string') {
      return Response.json({ error: 'user (string) required' }, { status: 400 });
    }
    initFirebaseAdmin();
    const db = getDatabase();

    await db.ref('/commands/force_stop').set({
      user,
      requested_at: Date.now(),
    });

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
