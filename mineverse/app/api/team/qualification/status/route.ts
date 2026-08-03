import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getQualificationState } from '@/lib/gameplay/qualification/service';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  try {
    const state = await getQualificationState(session.team_id);
    return NextResponse.json({ success: true, data: state });
  } catch (error: any) {
    console.error('Get Team Qualification Status Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
