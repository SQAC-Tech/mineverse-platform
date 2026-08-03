import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { resolveGuardianBattle, GuardianName } from '@/lib/gameplay/guardians/service';
import { verifyTeamRoundAccess } from '@/lib/gameplay/utils/access';
import { z } from 'zod';

const submitSchema = z.object({
  guardian_name: z.enum(['forest_guardian', 'skeleton_archer', 'blaze_guardian']),
  round_id: z.number().int(),
  idempotency_key: z.string().uuid(),
  answers: z
    .array(
      z.object({
        question_id: z.string().uuid(),
        answer_text: z.string().trim().max(20000),
      }),
    )
    .max(50)
    .default([]),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const idempotencyKeyHeader = req.headers.get('Idempotency-Key');

  try {
    const body = await req.json();
    const result = submitSchema.safeParse({ ...body, idempotency_key: body.idempotency_key || idempotencyKeyHeader });
    
    if (!result.success) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_PAYLOAD' } }, { status: 400 });
    }

    const { guardian_name, round_id, idempotency_key, answers } = result.data;

    const access = await verifyTeamRoundAccess(session.team_id, round_id);
    if (!access.hasAccess) {
      return NextResponse.json({ success: false, error: { code: access.error } }, { status: 403 });
    }

    const res = await resolveGuardianBattle(session.team_id, guardian_name as GuardianName, idempotency_key, answers);
    
    if (!res.success) {
      return NextResponse.json({ success: false, error: { code: res.error, message: res.message } }, { status: 409 });
    }

    return NextResponse.json({ success: true, data: res.data });
  } catch (error: any) {
    console.error('Guardian Resolve Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
