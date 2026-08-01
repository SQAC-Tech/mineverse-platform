import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { applyMarketplaceItem } from '@/lib/gameplay/marketplace/use-service';
import { z } from 'zod';

const useSchema = z.object({
  transaction_id: z.string().uuid(),
  idempotency_key: z.string().uuid().optional(),
  question_id: z.string().uuid().optional(),
});

const ERROR_STATUS: Record<string, number> = {
  TRANSACTION_NOT_FOUND: 404,
  NOT_CONSUMABLE: 400,
  ALREADY_USED: 409,
  NO_PENALTY_TO_REVIVE: 422,
  QUESTION_REQUIRED: 400,
  HINT_PROVIDER_UNAVAILABLE: 503,
  QUESTION_NOT_FOUND: 404,
  CONFLICT: 409,
  INSUFFICIENT_FUNDS: 422,
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  try {
    const body = await req.json();
    const idempotencyKeyHeader = req.headers.get('Idempotency-Key');
    const result = useSchema.safeParse({
      ...body,
      idempotency_key: body.idempotency_key || idempotencyKeyHeader || undefined,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_PAYLOAD' } }, { status: 400 });
    }

    const { transaction_id, idempotency_key, question_id } = result.data;

    const res = await applyMarketplaceItem({
      teamId: session.team_id,
      transactionId: transaction_id,
      questionId: question_id,
      idempotencyKey: idempotency_key ?? crypto.randomUUID(),
    });

    if (!res.success) {
      const status = ERROR_STATUS[res.error] ?? 500;
      return NextResponse.json({ success: false, error: { code: res.error, message: res.message } }, { status });
    }

    return NextResponse.json({ success: true, data: res.data });
  } catch (error: unknown) {
    console.error('Use Item Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
