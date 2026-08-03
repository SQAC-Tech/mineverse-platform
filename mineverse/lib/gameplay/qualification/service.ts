import { supabaseServer } from '@/lib/supabase/server';
import { Dev3TeamGameState } from '@/lib/gameplay/types';

// Phase 1 panel sessions (lib/panel/session.ts) carry only { scope } and expose no
// per-admin identifier, so per-admin attribution is not possible. A neutral value is
// recorded and the limitation is documented rather than mislabeling the scope as identity.
export const QUALIFICATION_CONFIRMED_BY = 'unknown-admin';

export interface TeamEligibility {
  hasIronArmor: boolean;
  hasBlazeGuardian: boolean;
  hasPvPWin: boolean;
  isEligible: boolean;
}

const EMPTY_ELIGIBILITY: TeamEligibility = {
  hasIronArmor: false,
  hasBlazeGuardian: false,
  hasPvPWin: false,
  isEligible: false,
};

function handleQueryError(error: { message: string }, lenient: boolean, source: string) {
  if (lenient) {
    console.warn(`[qualification] ${source} unavailable:`, error.message);
    return;
  }
  throw new Error(`${source} query failed: ${error.message}`);
}

/**
 * Bulk eligibility snapshot. Eligibility requires Iron Armor crafted (Dev 4 crafting_log),
 * the mandatory Blaze Guardian defeated (guardian_battles), and a winning PvP result (Dev 5 pvp_results).
 * `lenient` reads treat a missing integration table as "no evidence" (for review views);
 * strict reads (default) fail loudly because a wrong frozen decision is worse than an error.
 */
export async function buildEligibilitySnapshot(
  teamIds: string[],
  options: { lenient?: boolean } = {},
): Promise<Map<string, TeamEligibility>> {
  const lenient = options.lenient ?? false;
  const result = new Map<string, TeamEligibility>();
  if (teamIds.length === 0) return result;

  for (const id of teamIds) result.set(id, { ...EMPTY_ELIGIBILITY });

  const { data: craftRows, error: craftError } = await supabaseServer
    .from('crafting_log')
    .select('team_id')
    .eq('item', 'iron_armor')
    .in('team_id', teamIds);

  if (craftError) {
    handleQueryError(craftError, lenient, 'crafting_log');
  } else {
    for (const row of craftRows ?? []) {
      const entry = result.get(row.team_id);
      if (entry) entry.hasIronArmor = true;
    }
  }

  const { data: blazeRows, error: blazeError } = await supabaseServer
    .from('guardian_battles')
    .select('team_id')
    .eq('guardian_name', 'blaze_guardian')
    .eq('status', 'won')
    .in('team_id', teamIds);

  if (blazeError) {
    handleQueryError(blazeError, lenient, 'guardian_battles');
  } else {
    for (const row of blazeRows ?? []) {
      const entry = result.get(row.team_id);
      if (entry) entry.hasBlazeGuardian = true;
    }
  }

  const { data: pvpRows, error: pvpError } = await supabaseServer
    .from('pvp_results')
    .select('winner_team_id')
    .in('winner_team_id', teamIds);

  if (pvpError) {
    handleQueryError(pvpError, lenient, 'pvp_results');
  } else {
    for (const row of pvpRows ?? []) {
      const entry = result.get(row.winner_team_id);
      if (entry) entry.hasPvPWin = true;
    }
  }

  for (const entry of result.values()) {
    entry.isEligible = entry.hasIronArmor && entry.hasBlazeGuardian && entry.hasPvPWin;
  }

  return result;
}

export async function checkTeamEligibility(teamId: string): Promise<TeamEligibility> {
  const snapshot = await buildEligibilitySnapshot([teamId], { lenient: true });
  return snapshot.get(teamId) ?? { ...EMPTY_ELIGIBILITY };
}

/**
 * Issue 8b handoff: Dev 5 owns awarding the Nether Core for a winning online PvP match
 * (Nether Core x1 per win, event brief). Dev 3 derives the durable team_game_state count
 * from Dev 5's immutable pvp_results projection. No fabricated values are written here.
 */
export async function syncNetherCoreCounts(teamIds: string[]) {
  if (teamIds.length === 0) return;

  const { data: pvpRows, error: pvpError } = await supabaseServer
    .from('pvp_results')
    .select('winner_team_id')
    .in('winner_team_id', teamIds);

  if (pvpError) throw pvpError;

  const counts = new Map<string, number>();
  for (const row of pvpRows ?? []) {
    const id = row.winner_team_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  for (const teamId of teamIds) {
    const count = counts.get(teamId) ?? 0;
    const { error } = await supabaseServer
      .from('team_game_state')
      .upsert(
        { team_id: teamId, nether_core_count: count, updated_at: new Date().toISOString() },
        { onConflict: 'team_id' },
      );

    if (error) throw error;
  }
}

export async function getQualificationState(teamId: string): Promise<Dev3TeamGameState> {
  const { data, error } = await supabaseServer
    .from('team_game_state')
    .select('*')
    .eq('team_id', teamId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;

  return (data as unknown as Dev3TeamGameState) || {
    team_id: teamId,
    nether_core_count: 0,
    armor_crafted: false,
    qualified_for_day2: false,
    qualification_frozen_by: null,
    qualification_frozen_at: null,
    qualification_freeze_id: null,
    qualification_cutoff_percent: null,
    qualification_reason: null,
    elimination_reason: null,
    updated_at: new Date().toISOString(),
  };
}

export interface ConfirmQualificationParams {
  cutoffPercent: number;
  reason?: string;
}

export interface ConfirmQualificationResult {
  success: boolean;
  error?: string;
  message?: string;
  data?: {
    freeze_id: string;
    qualified_count: number;
    total_eligible: number;
    total_participants: number;
    cutoff_percent: number;
    is_override: boolean;
    confirmed_by: string;
    frozen_at: string;
  };
}

/**
 * Explicit, auditable qualification freeze. Runs on the participant set (teams that
 * engaged Round 3 PvP). Qualifies the eligible subset up to the cutoff cap; if the
 * eligible set exceeds the cap, a non-empty override reason is required rather than
 * inventing a ranking. Every freeze is a new immutable decision row set on team_game_state.
 */
export async function confirmQualification(params: ConfirmQualificationParams): Promise<ConfirmQualificationResult> {
  const { cutoffPercent, reason } = params;

  const { data: pvpRows, error: pvpError } = await supabaseServer
    .from('pvp_results')
    .select('winner_team_id');

  if (pvpError) throw pvpError;

  const participantIds = [...new Set((pvpRows ?? []).map((row) => row.winner_team_id as string))];

  const eligibility = await buildEligibilitySnapshot(participantIds);
  const eligibleIds = participantIds.filter((id) => eligibility.get(id)?.isEligible);

  const cutoffCap = Math.ceil((participantIds.length * cutoffPercent) / 100);
  const isOverride = eligibleIds.length > cutoffCap;

  if (isOverride && !reason?.trim()) {
    return {
      success: false,
      error: 'CUTOFF_EXCEEDED',
      message: `Eligible teams (${eligibleIds.length}) exceed the ${cutoffPercent}% cutoff (${cutoffCap} of ${participantIds.length} participants). Provide an override reason to confirm all eligible teams.`,
    };
  }

  await syncNetherCoreCounts(participantIds);

  const freezeId = crypto.randomUUID();
  const now = new Date().toISOString();

  for (const teamId of participantIds) {
    const entry = eligibility.get(teamId)!;
    const { error } = await supabaseServer
      .from('team_game_state')
      .upsert(
        {
          team_id: teamId,
          armor_crafted: entry.hasIronArmor,
          qualified_for_day2: entry.isEligible,
          qualification_frozen_by: QUALIFICATION_CONFIRMED_BY,
          qualification_frozen_at: now,
          qualification_freeze_id: freezeId,
          qualification_cutoff_percent: cutoffPercent,
          qualification_reason: isOverride ? reason?.trim() ?? null : null,
          elimination_reason: entry.isEligible
            ? null
            : `Did not meet the top ${cutoffPercent}% cutoff.`,
          updated_at: now,
        },
        { onConflict: 'team_id' },
      );

    if (error) throw error;
  }

  return {
    success: true,
    data: {
      freeze_id: freezeId,
      qualified_count: eligibleIds.length,
      total_eligible: eligibleIds.length,
      total_participants: participantIds.length,
      cutoff_percent: cutoffPercent,
      is_override: isOverride,
      confirmed_by: QUALIFICATION_CONFIRMED_BY,
      frozen_at: now,
    },
  };
}

export interface QualificationOverview {
  teams: Array<{
    id: string;
    team_code: string;
    team_name: string;
    status: string;
    eligibility: TeamEligibility;
    state: Dev3TeamGameState | null;
  }>;
}

export async function getQualificationOverview(): Promise<QualificationOverview> {
  // A paid team sits at 'verified' — nothing in the platform promotes it to
  // 'active', so omitting 'verified' here returned an empty roster for the whole
  // event and left qualification (and PvP team selection) with nothing to show.
  const { data: teams, error: teamsError } = await supabaseServer
    .from('teams')
    .select('id, team_code, team_name, status')
    .in('status', ['verified', 'active', 'eliminated', 'champion']);

  if (teamsError) throw teamsError;

  const teamIds = (teams ?? []).map((team) => team.id);
  const [eligibility, states] = await Promise.all([
    buildEligibilitySnapshot(teamIds, { lenient: true }),
    (async () => {
      if (teamIds.length === 0) return [];
      const { data, error } = await supabaseServer
        .from('team_game_state')
        .select('*')
        .in('team_id', teamIds);
      if (error) throw error;
      return (data ?? []) as unknown as Dev3TeamGameState[];
    })(),
  ]);

  const stateByTeam = new Map<string, Dev3TeamGameState>();
  for (const state of states) stateByTeam.set(state.team_id, state);

  return {
    teams: (teams ?? []).map((team) => ({
      id: team.id,
      team_code: team.team_code,
      team_name: team.team_name,
      status: team.status,
      eligibility: eligibility.get(team.id) ?? { ...EMPTY_ELIGIBILITY },
      state: stateByTeam.get(team.id) ?? null,
    })),
  };
}

export async function exportQualifiedTeams() {
  const { data: states, error } = await supabaseServer
    .from('team_game_state')
    .select(
      'team_id, qualified_for_day2, nether_core_count, qualification_frozen_by, qualification_frozen_at, qualification_freeze_id, qualification_cutoff_percent, qualification_reason, elimination_reason',
    )
    .eq('qualified_for_day2', true)
    .not('qualification_frozen_at', 'is', null);

  if (error) throw error;
  if (!states || states.length === 0) return null;

  const teamIds = states.map((state) => state.team_id);
  const { data: teams, error: teamsError } = await supabaseServer
    .from('teams')
    .select('id, team_code, team_name')
    .in('id', teamIds);

  if (teamsError) throw teamsError;

  const teamMap = new Map<string, { team_code: string; team_name: string }>();
  for (const team of teams ?? []) teamMap.set(team.id, team);

  const first = states[0];

  return {
    export_type: 'qualified_teams',
    exported_at: new Date().toISOString(),
    freeze: {
      freeze_id: first.qualification_freeze_id,
      frozen_by: first.qualification_frozen_by,
      frozen_at: first.qualification_frozen_at,
      cutoff_percent: first.qualification_cutoff_percent,
      reason: first.qualification_reason,
    },
    qualified_count: states.length,
    qualified: states.map((state) => ({
      team_id: state.team_id,
      team_code: teamMap.get(state.team_id)?.team_code ?? null,
      team_name: teamMap.get(state.team_id)?.team_name ?? null,
      nether_core_count: state.nether_core_count,
    })),
  };
}
