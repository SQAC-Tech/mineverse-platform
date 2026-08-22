import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { rateLimit } from '@/lib/rate-limit';
import { startAttempt } from '@/lib/screening/service';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  if (!rateLimit(`screening-start:${session.team_id}`, 10, 60_000)) {
    return NextResponse.json({ success: false, error: { code: 'RATE_LIMITED' } }, { status: 429 });
  }

  let forceReset = req.nextUrl.searchParams.get('reset') === '1';
  try {
    const body = await req.json().catch(() => null);
    if (body?.reset) forceReset = true;
  } catch {
    // optional body
  }

  // `year` used to be read from this body and passed straight through, which let
  // a team choose which paper it sat. It is now derived from the roster's
  // registration numbers inside `startAttempt`; a `year` sent here is ignored.
  const result = await startAttempt(session.team_id, { forceReset });
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: { code: result.code, message: result.message } },
      { status: result.status },
    );
  }

  return NextResponse.json({ success: true, data: result.data });
}

