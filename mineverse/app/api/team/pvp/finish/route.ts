import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { finishPvpMatch } from '@/lib/gameplay/pvp/finish';
import { supabaseServer } from '@/lib/supabase/server';
import { broadcastMatchResolved } from '@/lib/gameplay/pvp/notify';

export const dynamic = 'force-dynamic';

/**
 * POST /api/team/pvp/finish
 *
 * The SUBMIT button at the end of the pack. Grades both teams against the
 * sealed questions, picks the winner and pays the award — all server-side, in
 * one transaction, with no organiser in the loop.
 *
 * Safe to call twice: the second caller (usually the opponent's browser, a
 * moment after it is told the duel ended) gets the standing result back rather
 * than a second award.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  let matchId: string | undefined;
  try {
    const body = await req.json();
    matchId = typeof body?.match_id === 'string' ? body.match_id : undefined;
  } catch {
    // A missing body is simply a bad request; handled below.
  }

  if (!matchId) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_PAYLOAD' } }, { status: 400 });
  }

  try {
    const result = await finishPvpMatch(matchId, session.team_id);

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: { code: result.code, message: result.message } },
        { status: result.status },
      );
    }

    // Best-effort, and after the fact: the duel is already decided and paid by
    // the time this runs, so a failed broadcast costs the other team a few
    // seconds of poll, not their result.
    if (!result.data.idempotent) {
      const db = supabaseServer as any;
      const { data: teams } = await db
        .from('pvp_match_teams')
        .select('team_id')
        .eq('match_id', matchId);

      if (teams?.length) {
        void broadcastMatchResolved(
          matchId,
          teams.map((row: { team_id: string }) => row.team_id),
          result.data.winner_team_id,
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: { ...result.data, won: result.data.winner_team_id === session.team_id },
    });
  } catch (error) {
    console.error('PvP Finish Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
