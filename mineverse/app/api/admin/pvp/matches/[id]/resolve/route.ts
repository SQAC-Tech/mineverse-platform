import { NextRequest, NextResponse } from 'next/server';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { evaluatePvpCompletion, resolvePvpMatch, getPvpMatchForAdmin } from '@/lib/gameplay/pvp/admin-service';

/**
 * Validates both teams' answers against the sealed pack, stamps server completion
 * times, then resolves the match. The winner is derived from server-recorded
 * elapsed time inside the resolution transaction — never from a browser payload.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const match = await getPvpMatchForAdmin(id);
    if (!match.ok) {
      return NextResponse.json(
        { success: false, error: { code: match.code, message: match.message } },
        { status: match.status },
      );
    }

    for (const team of match.data.teams as Array<{ team_id: string }>) {
      await evaluatePvpCompletion(id, team.team_id);
    }

    const result = await resolvePvpMatch(id, guard.adminId);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: { code: result.code, message: result.message } },
        { status: result.status },
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('PvP Match Resolve Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
