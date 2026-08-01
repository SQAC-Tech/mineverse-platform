import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getSafeQuestionsForRound } from '@/lib/gameplay/questions/service';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ round_id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const { round_id } = await params;
  const roundId = Number.parseInt(round_id, 10);
  if (!Number.isInteger(roundId)) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_ROUND' } }, { status: 400 });
  }

  try {
    const result = await getSafeQuestionsForRound(session.team_id, roundId);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: { code: result.code, message: result.message } },
        { status: result.status },
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Dev4 Questions Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}