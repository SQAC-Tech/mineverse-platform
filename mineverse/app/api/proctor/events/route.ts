import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { rateLimit } from '@/lib/rate-limit';
import { PROCTOR_ENABLED } from '@/lib/proctor/config';
import { eventBatchSchema, recordProctorEvents } from '@/lib/proctor/service';

/**
 * Ingests a batch of proctor events.
 *
 * Two things the client never gets to decide: whose events these are (the team
 * comes from the cookie) and when they happened (`occurred_at` defaults to the
 * database clock). The body carries only what happened.
 *
 * Also reachable via `navigator.sendBeacon` on pagehide, which is how a closed
 * laptop still delivers its last few events — the gap the reference
 * implementation had, where abandoning the tab erased the record entirely.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  if (!PROCTOR_ENABLED) {
    return NextResponse.json({ success: false, error: { code: 'PROCTOR_DISABLED' } }, { status: 503 });
  }

  // A team may legitimately have three devices flushing every three seconds,
  // plus a beacon on every page transition.
  if (!rateLimit(`proctor-events:${session.team_id}`, 180, 60_000)) {
    return NextResponse.json({ success: false, error: { code: 'RATE_LIMITED' } }, { status: 429 });
  }

  try {
    // `Request.json()` ignores the content type, so a sendBeacon Blob parses the
    // same as a normal fetch body.
    const parsed = eventBatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_PAYLOAD' } }, { status: 400 });
    }

    const result = await recordProctorEvents(session.team_id, parsed.data);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: { code: result.code } }, { status: result.status });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Proctor events error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
