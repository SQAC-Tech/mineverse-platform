import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { expireWorldEvent } from '@/lib/gameplay/events/service';

const expireSchema = z.object({ event_id: z.string().uuid() });

export async function POST(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  try {
    const parsed = expireSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_PAYLOAD' } }, { status: 400 });
    }

    const result = await expireWorldEvent(parsed.data.event_id);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { code: result.error, message: result.message } },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('World Event Expire Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
