import { NextRequest, NextResponse } from 'next/server';
import { verifyPanelToken, PANEL_COOKIE } from '@/lib/panel/session';
import { checkTeamEligibility, getQualificationState } from '@/lib/gameplay/qualification/service';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(PANEL_COOKIE)?.value;
  
  if (!token) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  
  const isAdmin = await verifyPanelToken(token, 'admin');
  if (!isAdmin) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const team_id = searchParams.get('team_id');

  if (!team_id) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_PAYLOAD' } }, { status: 400 });
  }

  try {
    const eligibility = await checkTeamEligibility(team_id);
    const state = await getQualificationState(team_id);

    return NextResponse.json({ 
      success: true, 
      data: {
        eligibility,
        state
      } 
    });
  } catch (error: any) {
    console.error('Get Qualification Status Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
