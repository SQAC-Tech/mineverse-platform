import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { makeChoiceDecision, isChoiceOpen, ChoiceKey, ChoiceOption } from '@/lib/gameplay/choices/service';
import { z } from 'zod';

import { dashboardEntitlement } from '@/lib/attendance/gates';

const choiceSchema = z.object({
  choice_key: z.enum(['ancient_shrine', 'piglin_merchant']),
  option: z.enum(['option_a', 'option_b', 'ignore']),
  round_id: z.number().int().optional(),
  idempotency_key: z.string().uuid()
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const idempotencyKeyHeader = req.headers.get('Idempotency-Key');

  try {
    const body = await req.json();
    const result = choiceSchema.safeParse({ ...body, idempotency_key: body.idempotency_key || idempotencyKeyHeader });
    
    if (!result.success) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_PAYLOAD' } }, { status: 400 });
    }

    const { choice_key, option, idempotency_key } = result.data;

    /**
     * Entitlement, then whether the trader has turned up.
     *
     * This called `verifyTeamRoundAccess`, which requires the round to be
     * active *and* the team marked present for it. The Shrine is a
     * between-rounds decision — the brief has it appearing after the Cave
     * Biome closes — and it is now made from the dashboard, so that gate
     * refused the trade at exactly the moment it is meant to happen.
     *
     * Nothing is loosened that matters: `dashboardEntitlement` still keeps out
     * anyone who did not qualify, `isChoiceOpen` still refuses a trader whose
     * round has not opened, and the one-decision-per-choice rule lives in the
     * RPC alongside the ledger write where it cannot be raced.
     */
    const entitled = await dashboardEntitlement(session.team_id);
    if (!entitled.ok) {
      return NextResponse.json(
        { success: false, error: { code: entitled.reason, message: entitled.message } },
        { status: 403 },
      );
    }

    if (!(await isChoiceOpen(choice_key as ChoiceKey))) {
      return NextResponse.json(
        { success: false, error: { code: 'CHOICE_NOT_OPEN', message: 'This trader has not arrived yet.' } },
        { status: 403 },
      );
    }

    const res = await makeChoiceDecision(session.team_id, choice_key as ChoiceKey, option as ChoiceOption, idempotency_key);
    
    if (!res.success) {
      const status = res.error === 'INSUFFICIENT_FUNDS' ? 422 : 409;
      return NextResponse.json({ success: false, error: { code: res.error, message: res.message } }, { status });
    }

    return NextResponse.json({ success: true, data: res.data });
  } catch (error: any) {
    console.error('Choice Decision Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
