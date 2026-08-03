import { NextRequest, NextResponse } from 'next/server';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { startPvpMatch } from '@/lib/gameplay/pvp/admin-service';

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

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('PvP Match Start Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
