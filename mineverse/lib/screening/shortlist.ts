import { supabaseServer } from '@/lib/supabase/server';
import { mutateTeamResource } from '@/lib/gameplay/marketplace/resource-client';
import { SCREENING_GRANT } from './config';

const db = supabaseServer as any;

export interface RankedTeam {
  team_id: string;
  team_code: string;
  team_name: string;
  rank: number;
  total_score: number;
  raw_score: number;
  bonus_points: number;
  correct_count: number;
  submitted_at: string | null;
  auto_submitted: boolean;
  status: string;
  /**
   * Seconds spent on the relay, summed over the puzzles this team actually
   * solved. Null only when no relay row exists at all, which in practice means
   * a team that solved nothing.
   */
  relay_seconds: number | null;
  /** Set once a shortlist has been committed. */
  result: 'shortlisted' | 'rejected' | null;
}

/**
 * The ranking chain, as a pure function.
 *
 * Score, then relay time, then submit time, then team code.
 *
 * Relay time is the key that actually draws the line. 61 of the 78 teams that
 * sat the qualifier cleared all three puzzles, so the score separates almost
 * nobody — whatever sits second in this chain *is* the shortlist.
 *
 * It used to be submit time, and submit time is a clock, not a performance: the
 * window ran four and a half hours, so a team that took twelve minutes at 18:10
 * outranked a team that took four at 21:40. MNV-348 solved the whole relay in
 * 251 seconds, the fastest in the field, and sat 30-odd places down the table
 * for the crime of starting late. Relay time is what the team did; the hour
 * they happened to log in is not.
 *
 * The timings come from `relay_screening_attempts`, which the paper writes as
 * it goes — a per-puzzle duration measured while the puzzle is open, so idle
 * time between the handoffs does not count against anyone.
 *
 * Submit time stays as the third key rather than being dropped: it is the only
 * ordering left for the handful of teams with no relay row. Team code is fourth
 * and does no moral work — it exists so running this twice can never produce
 * two different lists, which starts to matter the moment result mails have gone
 * out.
 *
 * Split out of `rankTeams` so it can be tested against hand-built ties without
 * a database.
 */
export function sortByRank<
  T extends {
    total_score: number;
    relay_seconds?: number | null;
    submitted_at: string | null;
    team_code: string;
  },
>(teams: T[]): T[] {
  return [...teams].sort((a, b) => {
    if (b.total_score !== a.total_score) return b.total_score - a.total_score;

    // Missing timings sort last rather than first, which a null-as-zero
    // comparison would do — an unrecorded relay is not a zero-second one.
    const aRelay = a.relay_seconds ?? Number.MAX_SAFE_INTEGER;
    const bRelay = b.relay_seconds ?? Number.MAX_SAFE_INTEGER;
    if (aRelay !== bRelay) return aRelay - bRelay;

    const aTime = a.submitted_at ? new Date(a.submitted_at).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.submitted_at ? new Date(b.submitted_at).getTime() : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;

    return a.team_code.localeCompare(b.team_code);
  });
}

/**
 * Total relay seconds from one telemetry row.
 *
 * Summed over the puzzles that were actually solved, so a team that stopped at
 * puzzle two is timed on two puzzles. That only ever compares it against other
 * teams that stopped at two — a shorter relay is a lower score, and the score
 * is ranked first.
 *
 * A row with no timings at all returns null rather than 0: an older attempt
 * predating the telemetry columns must not be handed the fastest time in the
 * field.
 */
interface RelayTiming {
  team_id: string;
  year1_duration_seconds: number | null;
  year2_duration_seconds: number | null;
  year3_duration_seconds: number | null;
}

function relaySeconds(row: RelayTiming | undefined): number | null {
  if (!row) return null;
  const parts = [row.year1_duration_seconds, row.year2_duration_seconds, row.year3_duration_seconds]
    .filter((value): value is number => typeof value === 'number');
  if (parts.length === 0) return null;
  return parts.reduce((total, value) => total + value, 0);
}

/** The ranking, in full, from the database. */
export async function rankTeams(): Promise<RankedTeam[]> {
  const { data: attempts } = await db
    .from('screening_attempts')
    .select('team_id, raw_score, bonus_points, total_score, correct_count, submitted_at, auto_submitted, status, teams(team_code, team_name)')
    .not('total_score', 'is', null);

  const { data: decided } = await db.from('screening_shortlist').select('team_id, result');
  const resultByTeam = new Map((decided ?? []).map((row: any) => [row.team_id, row.result]));

  // Read whole rather than joined onto the attempt: `relay_screening_attempts`
  // is a separate table keyed by team, not a child of the attempt, and there is
  // no foreign key for PostgREST to embed across.
  const { data: relay } = await db
    .from('relay_screening_attempts')
    .select('team_id, year1_duration_seconds, year2_duration_seconds, year3_duration_seconds');
  const relayByTeam = new Map<string, RelayTiming>(
    ((relay ?? []) as RelayTiming[]).map((row) => [row.team_id, row]),
  );

  const rows = (attempts ?? []).map((attempt: any) => ({
    team_id: attempt.team_id,
    team_code: attempt.teams?.team_code ?? '',
    team_name: attempt.teams?.team_name ?? '',
    total_score: Number(attempt.total_score ?? 0),
    raw_score: Number(attempt.raw_score ?? 0),
    bonus_points: Number(attempt.bonus_points ?? 0),
    correct_count: attempt.correct_count ?? 0,
    submitted_at: attempt.submitted_at,
    auto_submitted: Boolean(attempt.auto_submitted),
    status: attempt.status,
    relay_seconds: relaySeconds(relayByTeam.get(attempt.team_id)),
    result: (resultByTeam.get(attempt.team_id) as RankedTeam['result']) ?? null,
    rank: 0,
  }));

  const sorted = sortByRank(rows as RankedTeam[]);
  sorted.forEach((row, index) => { row.rank = index + 1; });
  return sorted;
}

export interface ShortlistPreview {
  cut: number;
  shortlisted: RankedTeam[];
  rejected: RankedTeam[];
  /**
   * Teams sitting on the same score across the cut line. Not an error — the
   * relay-time tiebreak already resolved them — but the one thing a human
   * should actually look at before committing. With a field where nearly
   * everyone full-clears, expect this to be most of the table.
   */
  contested: RankedTeam[];
  committed: boolean;
}

export async function previewShortlist(cut: number): Promise<ShortlistPreview> {
  const ranked = await rankTeams();
  const shortlisted = ranked.slice(0, cut);
  const rejected = ranked.slice(cut);

  const boundaryScore = shortlisted.at(-1)?.total_score;
  const contested = boundaryScore === undefined
    ? []
    : ranked.filter((team) => team.total_score === boundaryScore);

  const { count } = await db.from('screening_shortlist').select('team_id', { count: 'exact', head: true });

  return {
    cut,
    shortlisted,
    rejected,
    contested: contested.length > 1 ? contested : [],
    committed: (count ?? 0) > 0,
  };
}

export type CommitResult =
  | { ok: true; shortlisted: number; rejected: number; granted: number }
  | { ok: false; code: string; message: string };

/**
 * Freezes the shortlist and pays the opening grant.
 *
 * Refuses to run twice. Unfreezing is a separate, deliberate action, because
 * everything downstream — the result mails, the resource grants — assumes this
 * list stopped moving.
 */
export async function commitShortlist(cut: number, actor: string): Promise<CommitResult> {
  const { count: existing } = await db
    .from('screening_shortlist')
    .select('team_id', { count: 'exact', head: true });

  if ((existing ?? 0) > 0) {
    return {
      ok: false,
      code: 'ALREADY_COMMITTED',
      message: 'A shortlist is already frozen. Clear it first if you really mean to redo it.',
    };
  }

  const ranked = await rankTeams();
  if (ranked.length === 0) {
    return { ok: false, code: 'NO_ATTEMPTS', message: 'No graded attempts to shortlist.' };
  }

  const rows = ranked.map((team, index) => ({
    team_id: team.team_id,
    rank: team.rank,
    total_score: team.total_score,
    submitted_at: team.submitted_at,
    result: index < cut ? 'shortlisted' : 'rejected',
    decided_by: actor,
  }));

  const { error } = await db.from('screening_shortlist').insert(rows);
  if (error) {
    console.error('Shortlist commit failed:', error);
    return { ok: false, code: 'COMMIT_FAILED', message: 'Could not write the shortlist.' };
  }

  const granted = await grantOpeningResources(rows.filter((row) => row.result === 'shortlisted'));
  return {
    ok: true,
    shortlisted: rows.filter((row) => row.result === 'shortlisted').length,
    rejected: rows.filter((row) => row.result === 'rejected').length,
    granted,
  };
}

/**
 * Pays every qualifier the same bundle.
 *
 * Not scaled by score on purpose — the screening decides who plays, never who
 * starts ahead. The idempotency key is derived from the team id, so a retry
 * after a partial failure cannot pay anyone twice.
 */
async function grantOpeningResources(shortlisted: Array<{ team_id: string }>): Promise<number> {
  if (Object.keys(SCREENING_GRANT).length === 0) return 0;

  let granted = 0;
  for (const row of shortlisted) {
    const result = await mutateTeamResource({
      teamId: row.team_id,
      delta: SCREENING_GRANT,
      sourceType: 'screening_grant',
      sourceId: row.team_id,
      idempotencyKey: deterministicKey(row.team_id),
      reason: 'Screening round qualifier — opening resources',
    });

    if (result.success) {
      granted += 1;
      await db
        .from('screening_shortlist')
        .update({ grant_ledger_id: result.ledgerId })
        .eq('team_id', row.team_id);
    } else if (result.error !== 'CONFLICT') {
      // CONFLICT means it was already paid, which is the point of the key.
      console.error('Screening grant failed for team', row.team_id, result);
    }
  }
  return granted;
}

/**
 * A stable uuid per team, so the same grant is always the same idempotency key.
 * Built from the team's own uuid rather than random, which is what makes a
 * re-run safe.
 */
function deterministicKey(teamId: string): string {
  const hex = teamId.replace(/-/g, '');
  // Version and variant nibbles set so Postgres accepts it as a v4-shaped uuid.
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    // Distinct tail so this can never collide with another feature's key for
    // the same team.
    `5c8ee`.padEnd(12, '0').slice(0, 12),
  ].join('-');
}

/** Unfreezes the shortlist. Does not claw back resources already granted. */
export async function clearShortlist(): Promise<boolean> {
  const { error } = await db.from('screening_shortlist').delete().not('team_id', 'is', null);
  return !error;
}
