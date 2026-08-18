import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { DEV_UNLOCK_ALL_ROUNDS } from '@/lib/gameplay/dev-mode';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const [teamResult, accessResult, resourcesResult] = await Promise.all([
    supabaseServer.from('teams').select('id, team_name, team_code').eq('id', session.team_id).single(),
    supabaseServer
      .from('team_round_access')
      .select('*, rounds(id, name, day, sequence, description, time_allotted, status, ends_at)')
      .eq('team_id', session.team_id)
      .order('round_id', { ascending: true }),
    (supabaseServer as any)
      .from('resources')
      .select('wood, stone, iron, gold, diamond, emerald, obsidian')
      .eq('team_id', session.team_id)
      .maybeSingle(),
  ]);

  // These errors used to be discarded. Selecting `teams.name`, a column that has
  // never existed, therefore produced `team: null` and a dashboard stuck on
  // "LOADING..." rather than anything that looked like a failure.
  for (const [label, result] of [
    ['team', teamResult],
    ['round access', accessResult],
    ['resources', resourcesResult],
  ] as const) {
    if (result.error) console.error(`Dashboard ${label} query failed:`, result.error);
  }

  const { data: team } = teamResult;
  const { data: access } = accessResult;
  const { data: resources } = resourcesResult;

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
      can_enter: DEV_UNLOCK_ALL_ROUNDS || unlockedForTeam,
      unlocked_by_dev_mode: DEV_UNLOCK_ALL_ROUNDS && !unlockedForTeam,
    };
  });

  return NextResponse.json({
    success: true,
    team,
    resources: resources ?? { wood: 0, stone: 0, iron: 0, gold: 0, diamond: 0, emerald: 0, obsidian: 0 },
    rounds,
    dev_unlock: DEV_UNLOCK_ALL_ROUNDS,
    server_time: new Date().toISOString(),
  });
}
