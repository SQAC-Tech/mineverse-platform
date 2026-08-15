import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { rateLimit } from '@/lib/rate-limit';
import { startAttempt } from '@/lib/screening/service';

/**
 * Seals the team's paper and starts their 30 minutes.
 *
 * The only route in the screening that looks at the window at all. Everything
 * downstream reads the attempt's own deadline, which is what lets a 23:58
 * starter finish at 00:28.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  if (!rateLimit(`screening-start:${session.team_id}`, 10, 60_000)) {
    return NextResponse.json({ success: false, error: { code: 'RATE_LIMITED' } }, { status: 429 });
  }

  const result = await startAttempt(session.team_id);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: { code: result.code, message: result.message } },
      { status: result.status },
    );
  }

  return NextResponse.json({ success: true, data: result.data });
}
