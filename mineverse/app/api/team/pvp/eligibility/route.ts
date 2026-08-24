import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { pvpEligibility } from '@/lib/gameplay/pvp/eligibility';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  try {
    const eligibility = await pvpEligibility(session.team_id);
    return NextResponse.json({ success: true, data: eligibility });
  } catch (error) {
    console.error('PvP Eligibility Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
