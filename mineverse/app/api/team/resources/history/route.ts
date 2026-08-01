import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getResourceHistory } from '@/lib/gameplay/resources/service';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const cursor = req.nextUrl.searchParams.get('cursor');
  const limit = Math.min(Number.parseInt(req.nextUrl.searchParams.get('limit') ?? '25', 10) || 25, 100);

  try {
    const data = await getResourceHistory(session.team_id, cursor, limit);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Dev4 Resource History Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}