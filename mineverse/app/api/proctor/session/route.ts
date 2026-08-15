import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { rateLimit } from '@/lib/rate-limit';
import { PROCTOR_ENABLED, proctorRules } from '@/lib/proctor/config';
import { endProctorSession, openProctorSession, openSessionSchema } from '@/lib/proctor/service';

/**
 * Opens (or re-attaches to) the proctor session for this browser.
 *
 * The team comes from the session cookie. Nothing in the body identifies who is
 * being watched, so a participant cannot file their events under another team —
 * or, more to the point, under nobody.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  if (!PROCTOR_ENABLED) {
    return NextResponse.json({ success: false, error: { code: 'PROCTOR_DISABLED' } }, { status: 503 });
  }

  // A reload re-opens the session, so this has to tolerate honest repeats while
  // still refusing a script that spams new device ids.
  if (!rateLimit(`proctor-session:${session.team_id}`, 60, 60_000)) {
    return NextResponse.json({ success: false, error: { code: 'RATE_LIMITED' } }, { status: 429 });
  }

  try {
    const parsed = openSessionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_PAYLOAD' } }, { status: 400 });
    }

    const result = await openProctorSession(
      session.team_id,
      parsed.data,
      req.headers.get('user-agent'),
    );

    if (!result.ok) {
      return NextResponse.json({ success: false, error: { code: result.code } }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      data: {
        session_id: result.data.id,
        warning_count: result.data.warning_count,
        key_violation_count: result.data.key_violation_count,
        status: result.data.status,
        // Sent back so the browser and the server agree on the budgets even if a
        // tab has been open since before a rules change.
        rules: proctorRules(parsed.data.round_id),
      },
    });
  } catch (error) {
    console.error('Proctor session error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}

/** Marks the session closed when a team finishes a round cleanly. */
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  const sessionId = req.nextUrl.searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_PAYLOAD' } }, { status: 400 });
  }

  await endProctorSession(session.team_id, sessionId);
  return NextResponse.json({ success: true });
}
