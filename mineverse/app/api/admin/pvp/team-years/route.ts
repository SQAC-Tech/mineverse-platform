import { NextRequest, NextResponse } from 'next/server';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { getTeamYear } from '@/lib/gameplay/pvp/year-detection';

/**
 * GET /api/admin/pvp/team-years?ids=uuid1,uuid2,...
 * Returns academic year labels for the given team IDs.
 * Used by the admin PvP page to display year info next to team names.
 */
export async function GET(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const idsParam = req.nextUrl.searchParams.get('ids') ?? '';
  const ids = idsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50); // safety cap

  if (ids.length === 0) {
    return NextResponse.json({ success: true, data: { years: {} } });
  }

  try {
    const entries = await Promise.all(
      ids.map(async (id) => [id, await getTeamYear(id)] as const),
    );
    const years: Record<string, string> = Object.fromEntries(entries);
    return NextResponse.json({ success: true, data: { years } });
  } catch (error) {
    console.error('PvP Team Years Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
