import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { DEV_UNLOCK_ALL_ROUNDS } from '@/lib/gameplay/dev-mode';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { data: team } = await supabaseServer.from('teams').select('*').eq('id', session.team_id).single();

  const { data: access } = await supabaseServer
    .from('team_round_access')
    .select('*, rounds(id, name, day, sequence, description, time_allotted, status, ends_at)')
    .eq('team_id', session.team_id)
    .order('round_id', { ascending: true });

  // One normalized shape for the dashboard panels, so the UI never has to
  // recombine round status and per-team lock state itself.
  const rounds = (access ?? []).map((row: any) => {
    const round = row.rounds ?? {};
    const unlockedForTeam = !row.is_locked && round.status === 'active';

    return {
      round_id: row.round_id,
      name: round.name ?? `Round ${row.round_id}`,
      day: round.day ?? null,
      sequence: round.sequence ?? null,
      description: round.description ?? '',
      time_allotted: round.time_allotted ?? null,
      round_status: round.status ?? 'locked',
      ends_at: round.ends_at ?? null,
      is_locked: row.is_locked,
      completed_at: row.completed_at,
      score: row.score,
      // Dev unlock mirrors the server-side bypass so button state and the API
      // agree; without it a panel would open onto an access error.
      can_enter: DEV_UNLOCK_ALL_ROUNDS || unlockedForTeam,
      unlocked_by_dev_mode: DEV_UNLOCK_ALL_ROUNDS && !unlockedForTeam,
    };
  });

  return NextResponse.json({
    success: true,
    team,
    rounds,
    dev_unlock: DEV_UNLOCK_ALL_ROUNDS,
    server_time: new Date().toISOString(),
  });
}
