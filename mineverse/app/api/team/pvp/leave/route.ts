import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { leavePvpQueue } from '@/lib/gameplay/pvp/matchmaking';

export const dynamic = 'force-dynamic';

/**
 * POST /api/team/pvp/leave
 *
 * Backing out of the queue before an opponent turns up. Refuses once a team has
 * been paired — at that point somebody else is already in the arena waiting,
 * and letting one side walk away would leave the other in a duel that can never
 * end.
 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  try {
    const result = await leavePvpQueue(session.team_id);

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: { code: result.code, message: result.message } },
        { status: result.status },
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('PvP Leave Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
