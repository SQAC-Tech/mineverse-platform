import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { createPvpMatch, listPvpMatches } from '@/lib/gameplay/pvp/admin-service';

const createSchema = z.object({
  team_ids: z.array(z.string().uuid()).length(2),
  pack_id: z.string().trim().min(1).max(120),
  duration_seconds: z.number().int().min(60).max(3600).optional(),
  replay_of_match_id: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PAYLOAD', message: 'Select exactly two teams and an approved pack.' } },
        { status: 400 },
      );
    }

    const result = await createPvpMatch({
      teamIds: parsed.data.team_ids as [string, string],
      packId: parsed.data.pack_id,
      adminId: guard.adminId,
      durationSeconds: parsed.data.duration_seconds,
      replayOfMatchId: parsed.data.replay_of_match_id ?? null,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: { code: result.code, message: result.message } },
        { status: result.status },
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('PvP Match Create Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}

export async function GET() {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  try {
    const matches = await listPvpMatches();
    return NextResponse.json({ success: true, data: { matches, server_time: new Date().toISOString() } });
  } catch (error) {
    console.error('PvP Match List Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
