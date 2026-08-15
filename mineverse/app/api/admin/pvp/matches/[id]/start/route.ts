import { NextRequest, NextResponse } from 'next/server';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { startPvpMatch } from '@/lib/gameplay/pvp/admin-service';
import { supabaseServer } from '@/lib/supabase/server';
import { broadcastMatchStarted } from '@/lib/gameplay/pvp/notify';

/**
 * The Start PvP action. The transaction stamps the server clock and transitions
 * the match to live; the client never supplies a start time.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const result = await startPvpMatch(id, guard.adminId);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: { code: result.code, message: result.message } },
        { status: result.status },
      );
    }

    // Notify both player teams that their match is live — best-effort, non-blocking.
    const db = supabaseServer as any;
    const { data: matchTeams } = await db
      .from('pvp_match_teams')
      .select('team_id')
      .eq('match_id', id);

    if (matchTeams?.length) {
      void broadcastMatchStarted(id, matchTeams.map((t: any) => t.team_id));
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('PvP Match Start Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}

