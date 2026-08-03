import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { triggerWorldEvent } from '@/lib/gameplay/events/service';
import { WORLD_EVENT_KEYS } from '@/lib/gameplay/events/catalog';

// The request names a canonical key; it never supplies its own effect.
const triggerSchema = z.object({
  event_key: z.enum(WORLD_EVENT_KEYS as [string, ...string[]]),
  round_id: z.number().int().min(1),
  scope: z.enum(['all', 'targeted']).optional().default('all'),
  target_team_ids: z.array(z.string().uuid()).max(200).optional().default([]),
});

export async function POST(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  try {
    const parsed = triggerSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PAYLOAD', message: 'Provide a canonical event key and round.' } },
        { status: 400 },
      );
    }

    if (parsed.data.scope === 'targeted' && parsed.data.target_team_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_TARGETS', message: 'A targeted event needs at least one team.' } },
        { status: 400 },
      );
    }

    const result = await triggerWorldEvent({
      eventKey: parsed.data.event_key as never,
      roundId: parsed.data.round_id,
      adminId: guard.adminId,
      scope: parsed.data.scope,
      targetTeamIds: parsed.data.target_team_ids,
    });

    if (!result.success) {
      const status = result.error === 'ALREADY_ACTIVE' ? 409 : 422;
      return NextResponse.json(
        { success: false, error: { code: result.error, message: result.message } },
        { status },
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('World Event Trigger Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
