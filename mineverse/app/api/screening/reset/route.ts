import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { resetAttempt } from '@/lib/screening/service';

/**
/ * Resets the team's screening attempt so they can re-sit the Gauntlet.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  const result = await resetAttempt(session.team_id);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: { code: result.code } },
      { status: result.status },
    );
  }

  return NextResponse.json({ success: true, data: result.data });
}
