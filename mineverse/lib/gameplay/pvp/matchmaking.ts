import { supabaseServer } from '@/lib/supabase/server';
import { PVP_ROUND_ID, PVP_PACK_ROUND_ID } from '@/lib/gameplay/round-config';
import { getTeamYear } from '@/lib/gameplay/pvp/year-detection';
import { pvpEntryEligibility } from '@/lib/gameplay/pvp/eligibility';

const db = supabaseServer as any;

/** How long a duel runs once both teams are seeded. */
export const PVP_DURATION_SECONDS = 600;

export interface RankSnapshot {
  /** Primary ordering: points from graded submissions across every round. */
  rank_score: number;
  /** Secondary ordering: resources the team has won from correct answers. */
  tie_break: number;
}

/**
 * Where a team stands, for seeding purposes.
 *
 * Two numbers, because neither is sufficient alone:
 *
 *  - `rank_score` is the sum of `submissions.final_score`. It is the real
 *    measure, but it only exists once a round has been graded, and the duel
 *    opens the moment Round 3 closes — Round 3's coding questions may still be
 *    in the grading queue at that point.
 *  - `tie_break` is what the team has actually been paid for correct answers
 *    (`resource_ledger`, `source_type = 'question_grade'`). Instant-graded
 *    questions pay the moment they are answered, so this is populated even when
 *    grading lags, and it separates teams that are level on points.
 *
 * `teams.total_score` is deliberately not used: nothing in the codebase writes
 * it, so every team reads 0 and the leaderboard it feeds is flat.
 */
export async function teamRankSnapshot(teamId: string): Promise<RankSnapshot> {
  const [scoreResult, ledgerResult] = await Promise.all([
    db.from('submissions').select('final_score').eq('team_id', teamId),
    db.from('resource_ledger').select('delta').eq('team_id', teamId).eq('source_type', 'question_grade'),
  ]);

  const rank_score = (scoreResult.data ?? []).reduce(
    (total: number, row: { final_score: number | null }) => total + Number(row.final_score ?? 0),
    0,
  );

  const tie_break = (ledgerResult.data ?? []).reduce((total: number, row: { delta: Record<string, number> | null }) => {
    const delta = row.delta ?? {};
    // Only the credits count. A question grade never debits, but summing the
    // absolute values would make a penalty look like a reward if one ever did.
    return total + Object.values(delta).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  }, 0);

  return { rank_score, tie_break };
}

export type EnterResult =
  | { ok: true; state: 'matched'; match_id: string }
  | { ok: true; state: 'waiting'; queued_at: string; waiting_count: number }
  | { ok: false; status: number; code: string; message: string };

/**
 * Puts a team into the duel queue and runs a pairing pass.
 *
 * The pass is run here, on the team's own request, rather than on a timer: the
 * hall enters over a couple of minutes and a team that presses the button
 * should be paired against whoever is already waiting, not wait for a tick. The
 * pairing itself is serialised by an advisory lock inside `pvp_matchmake`, so
 * two teams pressing at the same instant cannot both be paired to a third.
 */
export async function enterPvpQueue(teamId: string): Promise<EnterResult> {
  const { data: round, error: roundError } = await db
    .from('rounds')
    .select('id, status')
    .eq('id', PVP_ROUND_ID)
    .single();

  if (roundError || !round) {
    return { ok: false, status: 404, code: 'ROUND_NOT_FOUND', message: 'The Duel has not been set up yet.' };
  }

  if (round.status !== 'active') {
    return { ok: false, status: 409, code: 'ROUND_NOT_ACTIVE', message: 'The Duel is not open yet.' };
  }

  const eligibility = await pvpEntryEligibility(teamId);
  if (!eligibility.isEligible) {
    return {
      ok: false,
      status: 403,
      code: 'NOT_ELIGIBLE',
      message: eligibility.reason ?? 'Your team cannot enter the duel yet.',
    };
  }

  // Already fighting, or already seeded and waiting for the arena to be opened.
  // `idx_pvp_match_teams_one_active` guarantees there is at most one.
  const { data: activeRows } = await db
    .from('pvp_match_teams')
    .select('match_id, status')
    .eq('team_id', teamId)
    .in('status', ['pending', 'live'])
    .limit(1);

  if (activeRows?.[0]) {
    return { ok: true, state: 'matched', match_id: activeRows[0].match_id };
  }

  const { data: team } = await db.from('teams').select('team_code').eq('id', teamId).single();
  const [yearLabel, rank] = await Promise.all([getTeamYear(teamId), teamRankSnapshot(teamId)]);

  const { error: queueError } = await db.from('pvp_queue').upsert(
    {
      team_id: teamId,
      round_id: PVP_ROUND_ID,
      year_label: yearLabel,
      rank_score: rank.rank_score,
      tie_break: rank.tie_break,
      team_code: team?.team_code ?? '',
      // A team that was matched, then had its match voided, re-enters cleanly.
      match_id: null,
      matched_at: null,
    },
    { onConflict: 'team_id' },
  );

  if (queueError) throw queueError;

  const { error: matchError } = await db.rpc('pvp_matchmake', {
    p_round_id: PVP_ROUND_ID,
    p_pack_round_id: PVP_PACK_ROUND_ID,
    p_duration_seconds: PVP_DURATION_SECONDS,
    p_actor: `team:${teamId}`,
  });

  if (matchError) throw matchError;

  // Read back rather than trusting the pass's return value: the team may have
  // been paired by somebody else's concurrent pass a moment earlier.
  const { data: queueRow } = await db
    .from('pvp_queue')
    .select('match_id, joined_at')
    .eq('team_id', teamId)
    .maybeSingle();

  if (queueRow?.match_id) {
    return { ok: true, state: 'matched', match_id: queueRow.match_id };
  }

  const { count } = await db
    .from('pvp_queue')
    .select('team_id', { count: 'exact', head: true })
    .eq('round_id', PVP_ROUND_ID)
    .is('match_id', null);

  return {
    ok: true,
    state: 'waiting',
    queued_at: queueRow?.joined_at ?? new Date().toISOString(),
    waiting_count: count ?? 1,
  };
}

/** Whether the team is sitting in the queue unpaired, for the panel's status line. */
export async function pvpQueueStatus(teamId: string) {
  const { data } = await db
    .from('pvp_queue')
    .select('joined_at, match_id')
    .eq('team_id', teamId)
    .eq('round_id', PVP_ROUND_ID)
    .maybeSingle();

  return { queued: Boolean(data && !data.match_id), joined_at: data?.joined_at ?? null };
}
