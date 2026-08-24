import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { pvpEntryEligibility } from '@/lib/gameplay/pvp/eligibility';
import { pvpQueueStatus } from '@/lib/gameplay/pvp/matchmaking';
import { PVP_ROUND_ID } from '@/lib/gameplay/round-config';
import { getCachedRound } from '@/lib/cache/reads';

export const dynamic = 'force-dynamic';

/**
 * What the duel panel needs to draw itself: whether the round is open, whether
 * this team may enter, and whether it is already waiting to be paired.
 *
 * Deliberately not `checkTeamEligibility` from the qualification service — that
 * one answers "may this team go through to Day 2", which the duel decides.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  try {
    const [eligibility, queue, duelRound] = await Promise.all([
      pvpEntryEligibility(session.team_id),
      pvpQueueStatus(session.team_id),
      getCachedRound(PVP_ROUND_ID),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...eligibility,
        round_open: duelRound?.status === 'active',
        queued: queue.queued,
        queued_at: queue.joined_at,
        // What the searching screen watches for. `match_status` matters as much
        // as the id: a resolved duel still has one, and sending a team back
        // into it would put them on a dead arena.
        match_id: queue.match_id,
        match_status: queue.match_status,
      },
    });
  } catch (error) {
    console.error('PvP Eligibility Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
