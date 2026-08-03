import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getCurrentPvpMatch } from '@/lib/gameplay/pvp/service';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  try {
    const result = await getCurrentPvpMatch(session.team_id);
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Dev4 PvP Current Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}