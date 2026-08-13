import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { DAY2_EVENT_KEYS, type Day2EventKey } from '@/lib/day2/events/catalog';
import { triggerDay2Event } from '@/lib/day2/events/service';

const triggerSchema = z.object({
  event_key: z.enum(DAY2_EVENT_KEYS as [Day2EventKey, ...Day2EventKey[]]),
  target_team_ids: z.array(z.string().uuid()).max(200).optional().default([]),
  idempotency_key: z.string().uuid(),
  reason: z.string().trim().min(1).max(1000),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const headerKey = req.headers.get('Idempotency-Key');

  try {
    const body = await req.json();
    const parsed = triggerSchema.safeParse({ ...body, idempotency_key: body.idempotency_key || headerKey });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PAYLOAD', message: parsed.error.issues[0]?.message } },
        { status: 400 },
      );
    }

    if (parsed.data.event_key !== 'chorus_fruit_blessing' && parsed.data.target_team_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'TARGETS_REQUIRED', message: 'Targeted negative events require at least one team.' } },
        { status: 400 },
      );
    }

    const result = await triggerDay2Event({
      eventKey: parsed.data.event_key,
      targetTeamIds: parsed.data.target_team_ids,
      adminId: guard.adminId,
      idempotencyKey: parsed.data.idempotency_key,
      reason: parsed.data.reason,
      notes: parsed.data.notes ?? null,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: { code: result.code, message: result.message } },
        { status: result.status },
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Day2 Event Trigger Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}

