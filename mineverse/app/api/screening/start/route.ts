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
  let year: number | undefined;
  try {
    const body = await req.json().catch(() => null);
    if (body?.reset) forceReset = true;
    if (body?.year) year = body.year;
  } catch {
    // optional body
  }

  const result = await startAttempt(session.team_id, { forceReset, year });
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: { code: result.code, message: result.message } },
      { status: result.status },
    );
  }

  return NextResponse.json({ success: true, data: result.data });
}

