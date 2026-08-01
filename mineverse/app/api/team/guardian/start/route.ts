import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { startGuardianBattle, GuardianName } from '@/lib/gameplay/guardians/service';
import { z } from 'zod';
import { verifyTeamRoundAccess } from '@/lib/gameplay/utils/access';

const startSchema = z.object({
  guardian_name: z.enum(['forest_guardian', 'skeleton_archer', 'blaze_guardian']),
  round_id: z.number().int()
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  try {
    const body = await req.json();
    const result = startSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_PAYLOAD' } }, { status: 400 });
    }

    const { guardian_name, round_id } = result.data;

    const access = await verifyTeamRoundAccess(session.team_id, round_id);
    if (!access.hasAccess) {
      return NextResponse.json({ success: false, error: { code: access.error } }, { status: 403 });
    }

    const res = await startGuardianBattle(session.team_id, guardian_name as GuardianName, round_id);
    
    if (!res.success) {
      const status = res.error === 'COOLDOWN' ? 429 : 409;
      return NextResponse.json({ success: false, error: { code: res.error, message: res.message } }, { status });
    }

    return NextResponse.json({ success: true, data: res.data });
  } catch (error: any) {
    console.error('Start Guardian Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
