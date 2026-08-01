import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { craftTeamItem, listCraftRecipes } from '@/lib/gameplay/crafting/service';

const craftSchema = z.object({
  item: z.enum(['wooden_pickaxe', 'stone_pickaxe', 'iron_armor']),
  idempotency_key: z.string().uuid().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  try {
    const data = await listCraftRecipes(session.team_id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Dev4 Craft Recipes Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = craftSchema.safeParse({ ...body, idempotency_key: body.idempotency_key ?? req.headers.get('Idempotency-Key') });
    if (!parsed.success || !parsed.data.idempotency_key) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_PAYLOAD' } }, { status: 400 });
    }

    const result = await craftTeamItem(session.team_id, parsed.data.item, parsed.data.idempotency_key);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: { code: result.code, message: result.message } },
        { status: result.status },
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Dev4 Craft Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}