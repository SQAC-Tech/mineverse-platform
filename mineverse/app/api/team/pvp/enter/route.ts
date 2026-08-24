import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { enterPvpQueue } from '@/lib/gameplay/pvp/matchmaking';

export const dynamic = 'force-dynamic';

/**
 * POST /api/team/pvp/enter
 *
 * A team asking to be put in the duel queue. Safe to call repeatedly: a team
 * already in an unresolved match gets that match back, and a team already
 * queued keeps its place rather than jumping it.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  try {
    const result = await enterPvpQueue(session.team_id);

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: { code: result.code, message: result.message } },
        { status: result.status },
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('PvP Enter Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
