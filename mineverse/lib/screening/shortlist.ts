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
  /** Set once a shortlist has been committed. */
  result: 'shortlisted' | 'rejected' | null;
}

/**
 * The ranking chain, as a pure function.
 *
 * Score first, then whoever submitted earlier, then team code. The third key
 * does no moral work — it exists so running this twice can never produce two
 * different lists, which starts to matter the moment result mails have gone out.
 *
 * Split out of `rankTeams` so it can be tested against hand-built ties without
 * a database.
 */
export function sortByRank<T extends { total_score: number; submitted_at: string | null; team_code: string }>(
  teams: T[],
): T[] {
  return [...teams].sort((a, b) => {
    if (b.total_score !== a.total_score) return b.total_score - a.total_score;
    // A team with no submit time has not finished; it sorts last rather than
    // first, which a null-as-zero comparison would do.
    const aTime = a.submitted_at ? new Date(a.submitted_at).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.submitted_at ? new Date(b.submitted_at).getTime() : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;
    return a.team_code.localeCompare(b.team_code);
  });
}

/** The ranking, in full, from the database. */
export async function rankTeams(): Promise<RankedTeam[]> {
  const { data: attempts } = await db
    .from('screening_attempts')
    .select('team_id, raw_score, bonus_points, total_score, correct_count, submitted_at, auto_submitted, status, teams(team_code, team_name)')
    .not('total_score', 'is', null);

  const { data: decided } = await db.from('screening_shortlist').select('team_id, result');
  const resultByTeam = new Map((decided ?? []).map((row: any) => [row.team_id, row.result]));

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
   * submit-time tiebreak already resolved them — but the one thing a human
   * should actually look at before committing.
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
