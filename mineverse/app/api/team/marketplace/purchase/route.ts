import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { purchaseMarketplaceItem, MarketplaceItem } from '@/lib/gameplay/marketplace/service';
import { z } from 'zod';

const purchaseSchema = z.object({
  item: z.enum([
    'hint', 
    'wood_bundle', 
    'stone_bundle', 
    'iron_bundle', 
    'gold_bundle', 
    'diamond_bundle', 
    'totem_of_undying', 
    'guardian_retry_token', 
    'revival_potion', 
    'strength_potion'
  ]),
  idempotency_key: z.string().uuid()
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const idempotencyKeyHeader = req.headers.get('Idempotency-Key');

  try {
    const body = await req.json();
    const result = purchaseSchema.safeParse({ ...body, idempotency_key: body.idempotency_key || idempotencyKeyHeader });
    
    if (!result.success) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_PAYLOAD' } }, { status: 400 });
    }

    const res = await purchaseMarketplaceItem(session.team_id, result.data.item as MarketplaceItem, result.data.idempotency_key);
    
    if (!res.success) {
      const status = res.error === 'INSUFFICIENT_FUNDS' ? 422 : 409;
      return NextResponse.json({ success: false, error: { code: res.error, message: res.message } }, { status });
    }

    return NextResponse.json({ success: true, data: res.data });
  } catch (error: any) {
    console.error('Marketplace Purchase Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
