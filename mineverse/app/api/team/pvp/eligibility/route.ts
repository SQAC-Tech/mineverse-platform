import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { checkTeamEligibility } from '@/lib/gameplay/qualification/service';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  try {
    const eligibility = await checkTeamEligibility(session.team_id);
    return NextResponse.json({ success: true, data: eligibility });
  } catch (error) {
    console.error('PvP Eligibility Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
