import { NextRequest, NextResponse } from 'next/server';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { listWorldEvents } from '@/lib/gameplay/events/service';
import { WORLD_EVENTS } from '@/lib/gameplay/events/catalog';

export async function GET(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const roundParam = req.nextUrl.searchParams.get('round_id');
  const roundId = roundParam ? Number.parseInt(roundParam, 10) : undefined;

  if (roundParam && !Number.isInteger(roundId)) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_ROUND' } }, { status: 400 });
  }

  try {
    const events = await listWorldEvents(roundId);

    return NextResponse.json({
      success: true,
      data: {
        events,
        // The catalog an operator may trigger from.
        catalog: Object.values(WORLD_EVENTS).map((config) => ({
          key: config.key,
          label: config.label,
          round_id: config.round_id,
          kind: config.kind,
          duration_seconds: config.durationSeconds ?? null,
        })),
        server_time: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('World Event List Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
