import { NextRequest, NextResponse } from 'next/server';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { clearProctorFlag, getProctorFeed, getSessionEvents } from '@/lib/proctor/service';

/**
 * The live proctor feed.
 *
 * `proxy.ts` already gates `/api/admin/*` on the panel cookie, but every admin
 * route verifies the scope itself as well — a page-level proxy is never
 * sufficient on its own (PHASE2_API.md §3).
 */
export async function GET(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const roundParam = req.nextUrl.searchParams.get('round_id');
  const sessionId = req.nextUrl.searchParams.get('session_id');

  // Drilling into one session for adjudication: the full trail, not the last five.
  if (sessionId) {
    const events = await getSessionEvents(sessionId);
    return NextResponse.json({ success: true, data: { events } });
  }

  const roundId = roundParam ? Number(roundParam) : undefined;
  const sessions = await getProctorFeed({
    roundId: Number.isFinite(roundId) ? roundId : undefined,
  });

  return NextResponse.json({ success: true, data: { sessions, server_time: new Date().toISOString() } });
}

/** Clears a flag after an organizer has reviewed it. */
export async function POST(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    if (typeof body?.session_id !== 'string') {
      return NextResponse.json({ success: false, error: { code: 'INVALID_PAYLOAD' } }, { status: 400 });
    }

    const cleared = await clearProctorFlag(body.session_id);
    if (!cleared) {
      return NextResponse.json(
        { success: false, error: { code: 'CLEAR_FAILED', message: 'That session is not flagged.' } },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, data: { session_id: body.session_id } });
  } catch (error) {
    console.error('Proctor flag clear error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
