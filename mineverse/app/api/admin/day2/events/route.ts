import { NextResponse } from 'next/server';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { DAY2_EVENTS } from '@/lib/day2/events/catalog';
import { listDay2Events } from '@/lib/day2/events/service';

export async function GET() {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  try {
    const events = await listDay2Events();
    return NextResponse.json({
      success: true,
      data: {
        events,
        catalog: Object.values(DAY2_EVENTS),
      },
    });
  } catch (error) {
    console.error('Day2 Event List Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}

