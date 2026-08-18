import { supabaseServer } from '@/lib/supabase/server';
import { DEV_UNLOCK_ALL_ROUNDS, noteDevUnlockBypass } from '@/lib/gameplay/dev-mode';
import { isDemoTeamId, noteDemoBypass } from '@/lib/gameplay/demo-teams';

export type Dev4RoundAccess =
  | { ok: true; round: { id: number; name: string; status: string; starts_at: string | null; ends_at: string | null; time_allotted: number } }
  | { ok: false; status: number; code: string; message?: string };

const db = supabaseServer as any;

export async function verifyDev4RoundAccess(teamId: string, roundId: number): Promise<Dev4RoundAccess> {
  const { data: round, error: roundError } = await db
    .from('rounds')
    .select('id, name, status, starts_at, ends_at, time_allotted')
    .eq('id', roundId)
    .single();

  if (roundError || !round) {
    return { ok: false, status: 404, code: 'ROUND_NOT_FOUND', message: 'Round not found.' };
  }

  // Dev unlock skips the lock checks only; the team session was already verified
  // by the caller and every mutation path downstream is untouched.
  if (DEV_UNLOCK_ALL_ROUNDS) {
    noteDevUnlockBypass(`team ${teamId} round ${roundId}`);
    return { ok: true, round };
  }

  // Scoped to named team codes — see lib/gameplay/demo-teams.ts. This waives the
  // *scheduling* gates (round status, window, per-team lock) so a round can be
  // walked without flipping `rounds.status`, which is global. The progression
  // gates below are not waived: a demo team still has to qualify for Day 2 and
  // repair the portal, because those are the thing worth testing.
  const isDemo = await isDemoTeamId(teamId);
  if (isDemo) noteDemoBypass(`team ${teamId} round ${roundId}`);

  if (!isDemo) {
    if (round.status !== 'active') {
      return { ok: false, status: 403, code: 'ROUND_NOT_ACTIVE', message: 'This round is not active.' };
    }

    if (!round.ends_at || new Date(round.ends_at).getTime() <= Date.now()) {
      return { ok: false, status: 403, code: 'ROUND_LOCKED', message: 'This round is no longer accepting submissions.' };
    }

    const { data: access, error: accessError } = await db
      .from('team_round_access')
      .select('is_locked')
      .eq('team_id', teamId)
      .eq('round_id', roundId)
      .single();

    if (accessError || !access || access.is_locked) {
      return { ok: false, status: 403, code: 'TEAM_NOT_AUTHORIZED_FOR_ROUND', message: 'This round is not unlocked for your team.' };
    }
  }

  // Round 5 (The End) requires Day 2 qualification + portal repair (Dev 3 tables)
  if (roundId === 5) {
    const { data: gameState, error: gsError } = await db
      .from('team_game_state')
      .select('qualified_for_day2')
      .eq('team_id', teamId)
      .single();

    if (gsError || !gameState || !gameState.qualified_for_day2) {
      return { ok: false, status: 403, code: 'DAY2_NOT_QUALIFIED', message: 'Your team has not qualified for Day 2.' };
    }

    const { data: portalRepair, error: prError } = await db
      .from('day2_portal_repair')
      .select('team_id')
      .eq('team_id', teamId)
      .single();

    if (prError || !portalRepair) {
      return { ok: false, status: 403, code: 'PORTAL_NOT_REPAIRED', message: 'Your team must repair the Nether Portal before entering The End.' };
    }
  }

  return { ok: true, round };
}

export function accessErrorResponse(access: Extract<Dev4RoundAccess, { ok: false }>) {
  return Response.json(
    { success: false, error: { code: access.code, message: access.message } },
    { status: access.status },
  );
}