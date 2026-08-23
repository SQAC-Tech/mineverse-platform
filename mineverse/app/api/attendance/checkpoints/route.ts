import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { requirePanelScope } from '@/lib/panel/require-admin';

export const dynamic = 'force-dynamic';

/**
 * The desks, with how far each has got.
 *
 * The count is the point. A marshal working a queue has no way to know whether
 * they are twenty teams in or nearly done, and the panel used to show only the
 * dropdown — so "how many are left?" meant asking someone with a laptop.
 *
 * `expected` is the number of teams entitled to be marked at all: on day 1 the
 * RSVP-confirmed qualifiers, on day 2 the teams that made it through. It moves
 * during the evening as RSVPs land, which is correct — the denominator is
 * whoever currently holds a seat.
 */
export async function GET() {
  const guard = await requirePanelScope('attendance');
  if (!guard.ok) return guard.response;

  const { data: checkpoints, error } = await supabaseServer
    .from('attendance_checkpoints')
    .select('id, code, label, day, sequence, covers_rounds')
    .order('sequence', { ascending: true });

  if (error) {
    console.error('Loading checkpoints failed:', error);
    return NextResponse.json({ success: false, error: 'Could not load checkpoints' }, { status: 500 });
  }

  const [{ data: records }, { data: shortlist }, { count: day2Count }] = await Promise.all([
    supabaseServer.from('attendance_records').select('checkpoint_id'),
    supabaseServer
      .from('screening_shortlist')
      .select('team_id')
      .eq('result', 'shortlisted')
      .not('rsvp_confirmed_at', 'is', null),
    supabaseServer
      .from('team_game_state')
      .select('team_id', { count: 'exact', head: true })
      .eq('qualified_for_day2', true),
  ]);

  const markedByCheckpoint = new Map<number, number>();
  for (const row of records ?? []) {
    markedByCheckpoint.set(row.checkpoint_id, (markedByCheckpoint.get(row.checkpoint_id) ?? 0) + 1);
  }

  const day1Expected = shortlist?.length ?? 0;
  const day2Expected = day2Count ?? 0;

  return NextResponse.json({
    success: true,
    data: (checkpoints ?? []).map((cp) => ({
      ...cp,
      marked: markedByCheckpoint.get(cp.id) ?? 0,
      expected: cp.day >= 2 ? day2Expected : day1Expected,
    })),
  });
}
