import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getMySubmissions } from '@/lib/gameplay/questions/service';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const roundId = Number.parseInt(req.nextUrl.searchParams.get('round_id') ?? '', 10);
  if (!Number.isInteger(roundId)) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_ROUND' } }, { status: 400 });
  }

  try {
    const result = await getMySubmissions(session.team_id, roundId);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: { code: result.code, message: result.message } },
        { status: result.status },
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Dev4 My Submissions Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}