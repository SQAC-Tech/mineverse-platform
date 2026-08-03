import { NextRequest, NextResponse } from 'next/server';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { getTeamResources, getResourceHistory } from '@/lib/gameplay/resources/service';

/** Balance and ledger lookup for one team. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ team_id: string }> }) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const { team_id } = await params;
  const cursor = req.nextUrl.searchParams.get('cursor');

  try {
    const [resources, history] = await Promise.all([
      getTeamResources(team_id),
      getResourceHistory(team_id, cursor, 50),
    ]);

    return NextResponse.json({
      success: true,
      data: { team_id, ...resources, ledger: history.entries, next_cursor: history.next_cursor },
    });
  } catch (error) {
    console.error('Admin Resource Lookup Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
