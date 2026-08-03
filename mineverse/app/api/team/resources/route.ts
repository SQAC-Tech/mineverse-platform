import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getTeamResources } from '@/lib/gameplay/resources/service';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  try {
    const data = await getTeamResources(session.team_id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Dev4 Resources Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}