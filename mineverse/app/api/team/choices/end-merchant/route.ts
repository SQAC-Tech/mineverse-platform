import { NextResponse } from 'next/server';
import { requireDay2Access, Day2Session } from '@/lib/day2/access/guard';
import { mutateTeamResource } from '@/lib/gameplay/marketplace/resource-client';

export async function POST(request: Request) {
  const guardResult = await requireDay2Access();
  if (guardResult instanceof NextResponse) {
    return guardResult;
  }
  const session = guardResult as Day2Session;

  const { choice, idempotency_key } = await request.json();

  if (!['option_a', 'option_b', 'option_c'].includes(choice)) {
    return NextResponse.json({ success: false, error: 'INVALID_CHOICE' }, { status: 400 });
  }

  let delta = {};
  let reason = '';

  if (choice === 'option_a') {
    // 5 Emeralds -> 18 Diamonds
    delta = { emerald: -5, diamond: 18 };
    reason = 'End Merchant Option A';
  } else if (choice === 'option_b') {
    // 12 Diamonds -> 4 Emeralds
    delta = { diamond: -12, emerald: 4 };
    reason = 'End Merchant Option B';
  } else if (choice === 'option_c') {
    // Ignore
    delta = {};
    reason = 'End Merchant Option C (Ignore)';
  }

  try {
    const res = await mutateTeamResource({
      teamId: session.team_id,
      delta,
      sourceType: 'end_merchant_choice',
      sourceId: 'end_merchant',
      idempotencyKey: idempotency_key,
      reason,
    });

    if (!res.success && res.error !== 'CONFLICT') {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, idempotent: res.error === 'CONFLICT' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
