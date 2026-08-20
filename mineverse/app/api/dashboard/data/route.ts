import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { DEV_UNLOCK_ALL_ROUNDS } from '@/lib/gameplay/dev-mode';
import { CRAFT_RECIPES, type CraftItem } from '@/lib/gameplay/crafting/rules';

export const dynamic = 'force-dynamic';

/** Diamonds the portal repair needs, alongside a core and a fragment. */
const PORTAL_DIAMONDS = 15;

/**
 * One snapshot for the whole dashboard.
 *
 * The spec asks for a single server-backed payload rather than the dashboard
 * fanning out to /api/team/craft/recipes, /day2/status, /qualification/status
 * and the rest — those all guard on Day 2 qualification or return 403s that a
 * status page has no business treating as errors. Everything here is read-only
 * and derived server-side; nothing on this route mutates or grants anything.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const teamId = session.team_id;

  const [teamResult, accessResult, resourcesResult, craftedResult, stateResult, fragmentResult, repairResult, merchantResult] =
    await Promise.all([
      supabaseServer.from('teams').select('id, team_name, team_code').eq('id', teamId).single(),
      supabaseServer
        .from('team_round_access')
        .select('*, rounds(id, name, day, sequence, description, time_allotted, status, ends_at)')
        .eq('team_id', teamId)
        .order('round_id', { ascending: true }),
      supabaseServer
        .from('resources')
        .select('wood, stone, iron, gold, diamond, emerald, obsidian')
        .eq('team_id', teamId)
        .maybeSingle(),
      supabaseServer.from('crafting_log').select('item, crafted_at').eq('team_id', teamId),
      supabaseServer
        .from('team_game_state')
        .select('nether_core_count, armor_crafted, qualified_for_day2, elimination_reason')
        .eq('team_id', teamId)
        .maybeSingle(),
      supabaseServer.from('day2_portal_fragments').select('team_id').eq('team_id', teamId).maybeSingle(),
      supabaseServer.from('day2_portal_repair').select('repaired_at').eq('team_id', teamId).maybeSingle(),
      // The End Merchant writes to the ledger, not to `choice_decisions` like the
      // Day 1 choices do, so the ledger is where "already traded" actually lives.
      supabaseServer
        .from('resource_ledger')
        .select('reason, created_at')
        .eq('team_id', teamId)
        .eq('source_type', 'end_merchant_choice')
        .limit(1)
        .maybeSingle(),
    ]);

  // These errors used to be discarded. Selecting `teams.name`, a column that has
  // never existed, therefore produced `team: null` and a dashboard stuck on
  // "LOADING..." rather than anything that looked like a failure.
  for (const [label, result] of [
    ['team', teamResult],
    ['round access', accessResult],
    ['resources', resourcesResult],
    ['crafting log', craftedResult],
    ['game state', stateResult],
    ['portal fragment', fragmentResult],
    ['portal repair', repairResult],
    ['end merchant', merchantResult],
  ] as const) {
    // 42P01 is "table does not exist" — a Phase 3 table on a Phase 2 database is
    // an absence, not a fault, and the dashboard renders fine without it.
    if (result.error && result.error.code !== '42P01') {
      console.error(`Dashboard ${label} query failed:`, result.error);
    }
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

  const craftedAt = new Map<string, string>(
    ((craftedResult.data ?? []) as Array<{ item: string; crafted_at: string }>).map((row) => [row.item, row.crafted_at]),
  );

  // The catalog is the source of truth for what exists, so an uncrafted item is
  // still listed — a dashboard that hides what you have not earned tells a team
  // nothing about what to aim for.
  const crafted = (Object.keys(CRAFT_RECIPES) as CraftItem[]).map((item) => ({
    item,
    label: CRAFT_RECIPES[item].label,
    cost: CRAFT_RECIPES[item].base_cost,
    crafted: craftedAt.has(item),
    crafted_at: craftedAt.get(item) ?? null,
  }));

  const state = stateResult.data ?? null;
  const netherCores = state?.nether_core_count ?? 0;
  const hasFragment = Boolean(fragmentResult.data);
  const isRepaired = Boolean(repairResult.data);
  const diamonds = resources?.diamond ?? 0;

  const missingForPortal = [
    netherCores < 1 ? 'Nether Core' : null,
    !hasFragment ? 'Portal Fragment' : null,
    diamonds < PORTAL_DIAMONDS ? `${PORTAL_DIAMONDS - diamonds} more Diamonds` : null,
  ].filter((entry): entry is string => entry !== null);

  return NextResponse.json({
    success: true,
    team,
    resources: resources ?? { wood: 0, stone: 0, iron: 0, gold: 0, diamond: 0, emerald: 0, obsidian: 0 },
    rounds,
    crafted,
    progress: {
      qualified_for_day2: Boolean(state?.qualified_for_day2),
      elimination_reason: state?.elimination_reason ?? null,
      pvp_eligible: Boolean(state?.armor_crafted),
      nether_core_count: netherCores,
      end_merchant: {
        traded: Boolean(merchantResult.data),
        reason: merchantResult.data?.reason ?? null,
      },
      portal: {
        // `repaired` | `ready` | `collecting` — the missing list carries the detail,
        // because "locked" on its own never told a team what to go and get.
        state: isRepaired ? 'repaired' : missingForPortal.length === 0 ? 'ready' : 'collecting',
        has_fragment: hasFragment,
        is_repaired: isRepaired,
        diamonds_required: PORTAL_DIAMONDS,
        missing: missingForPortal,
      },
    },
    dev_unlock: DEV_UNLOCK_ALL_ROUNDS,
    server_time: new Date().toISOString(),
  });
}
