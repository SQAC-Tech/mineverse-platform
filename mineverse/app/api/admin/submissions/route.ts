import { NextRequest, NextResponse } from 'next/server';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { listRoundSubmissions } from '@/lib/gameplay/questions/admin';

export const dynamic = 'force-dynamic';

/**
 * Every team's answers to one round.
 *
 * Deliberately one round per request rather than all of them: a round is ~84
 * teams times its paper, and Round 3 and Round 5 carry whole programs. Loading
 * five rounds to look at one would make the screen slow at exactly the moment
 * it is most needed.
 *
 * `proxy.ts` gates `/api/admin/*` already; the scope is verified here too,
 * because a page-level proxy is never sufficient on its own.
 */
export async function GET(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const roundParam = req.nextUrl.searchParams.get('round_id');
  const roundId = Number.parseInt(roundParam ?? '', 10);

  if (!Number.isInteger(roundId)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ROUND', message: 'Pick a round.' } },
      { status: 400 },
    );
  }

  try {
    const data = await listRoundSubmissions(roundId);
    if (!data) {
      return NextResponse.json({ success: false, error: { code: 'ROUND_NOT_FOUND' } }, { status: 404 });
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Admin submissions error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
