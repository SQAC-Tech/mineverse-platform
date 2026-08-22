import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { countGuardianQuestions, getGuardianStatus, GuardianName } from '@/lib/gameplay/guardians/service';
import { verifyTeamRoundAccess } from '@/lib/gameplay/utils/access';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const guardian_name = searchParams.get('guardian_name') as GuardianName;
  const round_id_str = searchParams.get('round_id');

  if (!guardian_name || !round_id_str) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_PAYLOAD' } }, { status: 400 });
  }

  const round_id = parseInt(round_id_str, 10);

  const access = await verifyTeamRoundAccess(session.team_id, round_id);
  if (!access.hasAccess) {
    return NextResponse.json({ success: false, error: { code: access.error } }, { status: 403 });
  }

  try {
    // Include the sealed pack so a reload mid-battle can carry on answering.
    const [status, pack_size] = await Promise.all([
      getGuardianStatus(session.team_id, guardian_name, { includeQuestions: true }),
      countGuardianQuestions(guardian_name, round_id),
    ]);
    // `pack_size` rides alongside `data` rather than inside it: `data` is null when
    // a team has never attempted the guardian, and callers rely on that.
    return NextResponse.json({ success: true, data: status, pack_size, server_time: new Date().toISOString() });
  } catch (error: any) {
    console.error('Get Guardian Status Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
