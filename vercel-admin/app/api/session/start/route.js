// POST /api/session/start
// Body: { user: string }
// Writes /commands/start_session in Firebase; the Oracle poller picks it up on
// its next tick (within POLL_INTERVAL_MS) and arms the relay.

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

    // Check FSM — only allow start if IDLE
    const stateSnap = await db.ref('/relay_state').once('value');
    const phase = stateSnap.val()?.phase || 'idle';
    if (phase !== 'idle') {
      return Response.json({ error: `machine busy (${phase})` }, { status: 409 });
    }

    await db.ref('/commands/start_session').set({
      user,
      requested_at: Date.now(),
    });

    return Response.json({ ok: true, message: 'Session queued. Relay will arm within ~10s.' });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
