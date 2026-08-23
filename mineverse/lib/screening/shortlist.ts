import { supabaseServer } from '@/lib/supabase/server';
import { teamAcademicYear } from '@/lib/registration-no';
import { mutateTeamResource } from '@/lib/gameplay/marketplace/resource-client';
import { SCREENING_GRANT } from './config';

const db = supabaseServer as any;

/** The round the shortlist opens. Everything after it is unlocked on the day. */
const ROUND_ONE_ID = 1;

export interface RankedTeam {
  team_id: string;
  team_code: string;
  team_name: string;
  rank: number;
  /**
   * 1 for an all-first-year team, 2 for everyone else — the same rule the paper
   * is chosen by, taken from the roster rather than anything a team typed.
   *
   * Present because the cut is made per year: PvP pairs first years against
   * first years, so each year has to come out of the shortlist with an even
   * number of teams or somebody has nobody to play.
   */
  year: 1 | 2;
  /** Position within this team's own year. What the per-year cut is applied to. */
  year_rank: number;
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

  /**
   * The year, from the roster.
   *
   * `teamAcademicYear` takes the most senior member, so a team counts as first
   * year only if every member does — the same rule that picks which paper a
   * team sits, and the one that cannot be gamed by adding a junior. Anything
   * above second year collapses into 2; the event has none, but the ranking
   * should not invent a third bucket if one ever registers.
   */
  const { data: members } = await db.from('members').select('team_id, registration_no');
  const regsByTeam = new Map<string, Array<string | null>>();
  for (const member of (members ?? []) as Array<{ team_id: string; registration_no: string | null }>) {
    const list = regsByTeam.get(member.team_id) ?? [];
    list.push(member.registration_no);
    regsByTeam.set(member.team_id, list);
  }

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
    year: (teamAcademicYear(regsByTeam.get(attempt.team_id) ?? []) === 1 ? 1 : 2) as 1 | 2,
    rank: 0,
    year_rank: 0,
  }));

  const sorted = sortByRank(rows as RankedTeam[]);
  const seenInYear = { 1: 0, 2: 0 };
  sorted.forEach((row, index) => {
    row.rank = index + 1;
    seenInYear[row.year] += 1;
    row.year_rank = seenInYear[row.year];
  });
  return sorted;
}

/** Teams of one year, in their own order. */
export function teamsOfYear(ranked: RankedTeam[], year: 1 | 2): RankedTeam[] {
  return ranked.filter((team) => team.year === year);
}

/**
 * How many teams to take from each year.
 *
 * Two numbers rather than one, because a single merged cut cannot express what
 * the event needs. PvP pairs first years against first years and second years
 * against second years, so each year has to arrive at an even number — and the
 * merged top 48 splits 29/19, which is odd on both sides and leaves a team in
 * each year with nobody to play. No value of a single cut fixes that: at 46 it
 * is 28/18, at 48 it is 29/19.
 */
export interface ShortlistCut {
  year1: number;
  year2: number;
}

export interface ShortlistPreview {
  cut: ShortlistCut;
  shortlisted: RankedTeam[];
  rejected: RankedTeam[];
  /**
   * Teams sitting on the same score across their year's cut line. Not an error
   * — the relay-time tiebreak already resolved them — but the one thing a human
   * should actually look at before committing. With a field where nearly
   * everyone full-clears, expect this to be most of the table.
   */
  contested: RankedTeam[];
  committed: boolean;
  /** Per-year totals available, so the console can say what it is cutting into. */
  available: { year1: number; year2: number };
  /** Empty when the cut is usable. Anything here blocks the commit. */
  problems: string[];
}

/**
 * Everything wrong with a cut, in the order a human would notice it.
 *
 * Parity first: an odd year is the failure this whole per-year mechanism exists
 * to prevent, and it is invisible in a merged table.
 */
export function cutProblems(cut: ShortlistCut, available: { year1: number; year2: number }): string[] {
  const problems: string[] = [];

  for (const year of [1, 2] as const) {
    const take = cut[`year${year}`];
    const have = available[`year${year}`];
    const label = year === 1 ? '1st year' : '2nd year';

    if (!Number.isInteger(take) || take < 0) {
      problems.push(`${label}: pick a whole number of teams.`);
      continue;
    }
    if (take % 2 !== 0) {
      problems.push(`${label}: ${take} is odd — PvP pairs within the year, so one team would have no opponent.`);
    }
    if (take > have) {
      problems.push(`${label}: only ${have} teams sat the paper, cannot take ${take}.`);
    }
  }

  return problems;
}

export async function previewShortlist(cut: ShortlistCut): Promise<ShortlistPreview> {
  const ranked = await rankTeams();
  const byYear = { 1: teamsOfYear(ranked, 1), 2: teamsOfYear(ranked, 2) };
  const available = { year1: byYear[1].length, year2: byYear[2].length };

  const shortlisted = [...byYear[1].slice(0, cut.year1), ...byYear[2].slice(0, cut.year2)];
  const taken = new Set(shortlisted.map((team) => team.team_id));
  const rejected = ranked.filter((team) => !taken.has(team.team_id));

  /**
   * Contested is now per year, because the cut is. A second year sitting on the
   * same score as the last first year in is not near any line that matters.
   */
  const contested = ([1, 2] as const).flatMap((year) => {
    const boundaryScore = byYear[year][cut[`year${year}`] - 1]?.total_score;
    if (boundaryScore === undefined) return [];
    const tied = byYear[year].filter((team) => team.total_score === boundaryScore);
    return tied.length > 1 ? tied : [];
  });

  const { count } = await db.from('screening_shortlist').select('team_id', { count: 'exact', head: true });

  return {
    cut,
    shortlisted,
    rejected,
    contested,
    committed: (count ?? 0) > 0,
    available,
    problems: cutProblems(cut, available),
  };
}

export type CommitResult =
  | { ok: true; shortlisted: number; rejected: number; granted: number; unlocked: number }
  | { ok: false; code: string; message: string };

/**
 * Freezes the shortlist and pays the opening grant.
 *
 * Does not hand out Round 1 — that follows the RSVP, not the cut, and no team
 * has replied yet at the moment this runs. See `syncRoundOneAccess`.
 *
 * Refuses to run twice. Unfreezing is a separate, deliberate action, because
 * everything downstream — the result mails, the resource grants, who can open
 * Round 1 — assumes this list stopped moving.
 */
export async function commitShortlist(cut: ShortlistCut, actor: string): Promise<CommitResult> {
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

  const byYear = { 1: teamsOfYear(ranked, 1), 2: teamsOfYear(ranked, 2) };
  const problems = cutProblems(cut, { year1: byYear[1].length, year2: byYear[2].length });
  if (problems.length > 0) {
    // Checked here and not only in the console: an odd year silently produces a
    // team that cannot be paired, and that is discovered on the floor.
    return { ok: false, code: 'BAD_CUT', message: problems.join(' ') };
  }

  const taken = new Set([
    ...byYear[1].slice(0, cut.year1),
    ...byYear[2].slice(0, cut.year2),
  ].map((team) => team.team_id));


  const rows = ranked.map((team) => ({
    team_id: team.team_id,
    rank: team.rank,
    total_score: team.total_score,
    submitted_at: team.submitted_at,
    result: taken.has(team.team_id) ? 'shortlisted' : 'rejected',
    decided_by: actor,
  }));

  const { error } = await db.from('screening_shortlist').insert(rows);
  if (error) {
    console.error('Shortlist commit failed:', error);
    return { ok: false, code: 'COMMIT_FAILED', message: 'Could not write the shortlist.' };
  }

  // Reconciles rather than opens. Nobody has answered the RSVP at the moment a
  // shortlist is frozen, so this correctly opens Round 1 to nobody and locks
  // every stale unlock away; access arrives team by team as replies come in.
  const unlocked = await syncRoundOneAccess();
  const granted = await grantOpeningResources(rows.filter((row) => row.result === 'shortlisted'));
  return {
    ok: true,
    shortlisted: rows.filter((row) => row.result === 'shortlisted').length,
    rejected: rows.filter((row) => row.result === 'rejected').length,
    granted,
    unlocked,
  };
}

export type PromotionResult =
  | {
      ok: true;
      promoted: Array<{ team_id: string; team_code: string; team_name: string; year: 1 | 2 }>;
      already: string[];
      granted: number;
      year_counts: { year1: number; year2: number };
      parity: string | null;
    }
  | { ok: false; code: string; message: string };

/**
 * Moves a team from below the cut onto the shortlist, after the fact.
 *
 * The cut is one number and the world is not: a seat is turned down, a team is
 * mailed the wrong result, an organiser decides the room holds two more. Before
 * this existed the only way to act on any of that was to clear the whole frozen
 * shortlist and re-commit, which re-ranks all 78 teams and re-opens every
 * decision downstream of it. This moves one team and leaves the rest alone.
 *
 * Deliberately one-way. There is no demote: a team that has been told it is in
 * cannot be told it is out, and a function that can do it is a function that can
 * do it by accident at 2am.
 *
 * `result_mailed_at` is cleared so the console shows the team as unmailed and
 * the next results run picks it up. The run itself is guarded on `email_logs`,
 * not on this column, so the promoted team gets the shortlisted mail while the
 * teams already mailed are skipped — which is exactly the behaviour wanted.
 */
export async function promoteToShortlist(teamIds: string[], actor: string): Promise<PromotionResult> {
  const ids = [...new Set(teamIds.filter(Boolean))];
  if (ids.length === 0) {
    return { ok: false, code: 'NO_TEAMS', message: 'Pick at least one team to promote.' };
  }

  const { data: rows } = await db
    .from('screening_shortlist')
    .select('team_id, result')
    .in('team_id', ids);

  const found = (rows ?? []) as Array<{ team_id: string; result: string }>;
  if (found.length === 0) {
    return { ok: false, code: 'NOT_ON_LIST', message: 'No frozen shortlist row for those teams — is the shortlist committed?' };
  }

  const missing = ids.filter((id) => !found.some((row) => row.team_id === id));
  if (missing.length > 0) {
    return { ok: false, code: 'NOT_ON_LIST', message: `${missing.length} of those teams never sat the screening round.` };
  }

  // Already-shortlisted teams are reported, not treated as an error: pressing
  // the button twice should be dull, not destructive.
  const already = found.filter((row) => row.result === 'shortlisted').map((row) => row.team_id);
  const toPromote = found.filter((row) => row.result !== 'shortlisted').map((row) => row.team_id);

  if (toPromote.length > 0) {
    const { error } = await db
      .from('screening_shortlist')
      .update({ result: 'shortlisted', decided_by: actor, decided_at: new Date().toISOString(), result_mailed_at: null })
      .in('team_id', toPromote);

    if (error) {
      console.error('Promotion failed:', error);
      return { ok: false, code: 'PROMOTE_FAILED', message: 'Could not update the shortlist.' };
    }
  }

  // The same bundle every other qualifier got, on the same idempotency key, so
  // a team promoted twice is still paid once.
  const granted = await grantOpeningResources(toPromote.map((team_id) => ({ team_id })));

  // No RSVP yet, so this opens Round 1 to nobody new — called anyway because
  // every other writer of `result` calls it, and a path that skips it is how
  // the two states drift apart.
  await syncRoundOneAccess();

  const ranked = await rankTeams();
  const byId = new Map(ranked.map((team) => [team.team_id, team]));
  const shortlisted = ranked.filter((team) => team.result === 'shortlisted' || toPromote.includes(team.team_id));
  const yearCounts = {
    year1: shortlisted.filter((team) => team.year === 1).length,
    year2: shortlisted.filter((team) => team.year === 2).length,
  };

  // Reported, not enforced. A promotion of one now and one later passes through
  // an odd count legitimately, so refusing here would block the normal way of
  // working; the console shows the warning and the organiser decides.
  const odd = [
    yearCounts.year1 % 2 === 1 ? `year 1 (${yearCounts.year1})` : null,
    yearCounts.year2 % 2 === 1 ? `year 2 (${yearCounts.year2})` : null,
  ].filter(Boolean);

  for (const teamId of toPromote) {
    console.warn(`[shortlist] promoted team ${teamId} by ${actor}`);
  }

  return {
    ok: true,
    promoted: toPromote.map((teamId) => {
      const team = byId.get(teamId);
      return {
        team_id: teamId,
        team_code: team?.team_code ?? teamId,
        team_name: team?.team_name ?? '',
        year: team?.year ?? 2,
      };
    }),
    already,
    granted,
    year_counts: yearCounts,
    parity: odd.length > 0 ? `Odd count in ${odd.join(' and ')} — PvP needs an even number per year.` : null,
  };
}

/**
 * Who is entitled to open Round 1: shortlisted *and* RSVP confirmed.
 *
 * Qualifying earns the seat; the RSVP is what keeps it. A team that never
 * replied has not said it is coming, and the seats are finite.
 */
export async function roundOneEntitled(): Promise<{ frozen: boolean; teamIds: string[] }> {
  const { data: rows } = await db
    .from('screening_shortlist')
    .select('team_id, result, rsvp_confirmed_at');

  const all = (rows ?? []) as Array<{ team_id: string; result: string; rsvp_confirmed_at: string | null }>;
  if (all.length === 0) return { frozen: false, teamIds: [] };

  return {
    frozen: true,
    teamIds: all
      .filter((row) => row.result === 'shortlisted' && row.rsvp_confirmed_at)
      .map((row) => row.team_id),
  };
}

/**
 * Reconciles Round 1 access with the shortlist and the RSVPs.
 *
 * Written as a reconcile rather than a grant so it can be called from anywhere
 * that changes the inputs — the commit, and every RSVP toggle — and always
 * leaves the same answer. An RSVP withdrawn takes the access back with it,
 * which a one-way grant could not do.
 *
 * Both halves matter. Registration inserts every round locked, so the unlock is
 * what a qualifier needs; the re-lock is what stops a team from holding an
 * unlock granted earlier — the round toggle in `/api/admin/rounds/action` opens
 * a round to teams in bulk, and a team unlocked by an earlier press would
 * otherwise keep that access straight through the cut.
 *
 * A no-op when no shortlist is frozen. Locking every team out on the strength
 * of an empty table would break the rehearsal path, where rounds are opened by
 * the toggle with no screening in the picture at all.
 *
 * Only Round 1. Rounds 2 onward are opened on the day as the event moves, and
 * pre-opening them here would let a team walk into Round 3 from home.
 *
 * Attendance is deliberately untouched — it is marked on the day from the
 * attendance console by scanning the team's QR, and a row written here would
 * mean the desk had nothing left to record.
 */
export async function syncRoundOneAccess(): Promise<number> {
  const { frozen, teamIds } = await roundOneEntitled();
  if (!frozen) return 0;

  if (teamIds.length > 0) {
    const { error: openErr } = await db
      .from('team_round_access')
      .update({ is_locked: false })
      .eq('round_id', ROUND_ONE_ID)
      .in('team_id', teamIds);

    if (openErr) {
      console.error('Opening Round 1 to the confirmed teams failed:', openErr);
      return 0;
    }
  }

  // Everyone else goes back to locked. With nobody confirmed yet that is every
  // team, which is correct: the list is frozen and no seat has been taken up.
  // Split on the empty case because `not.in.()` is not valid PostgREST.
  const close = db.from('team_round_access').update({ is_locked: true }).eq('round_id', ROUND_ONE_ID);
  const { error: closeErr } = await (teamIds.length > 0
    ? close.not('team_id', 'in', `(${teamIds.join(',')})`)
    : close);

  if (closeErr) console.error('Re-locking Round 1 failed:', closeErr);

  console.warn(`[shortlist] Round 1 open to ${teamIds.length} RSVP-confirmed teams, closed to the rest`);
  return teamIds.length;
}

export interface RsvpState {
  team_id: string;
  confirmed_at: string | null;
  confirmed_by: string | null;
}

/**
 * Marks a shortlisted team as having answered the RSVP form.
 *
 * The form asks whether the team can actually come — hostellers need
 * permission to be out — and nothing reads it automatically, so this is
 * organiser-entered from the replies. Reversible on purpose: a team that
 * confirms and then withdraws is a normal evening, not a mistake.
 *
 * Restricted to teams on the shortlist. An RSVP from a team that did not
 * qualify is not a thing that should be recordable.
 */
export async function setRsvp(teamId: string, confirmed: boolean, actor: string): Promise<
  { ok: true; confirmed: boolean; with_access: number } | { ok: false; code: string; message: string }
> {
  const { data: row } = await db
    .from('screening_shortlist')
    .select('team_id, result')
    .eq('team_id', teamId)
    .maybeSingle();

  if (!row) {
    return { ok: false, code: 'NOT_ON_SHORTLIST', message: 'That team is not on the frozen shortlist.' };
  }
  if (row.result !== 'shortlisted') {
    return { ok: false, code: 'NOT_SHORTLISTED', message: 'That team did not qualify, so it has no RSVP to confirm.' };
  }

  const { error } = await db
    .from('screening_shortlist')
    .update({
      rsvp_confirmed_at: confirmed ? new Date().toISOString() : null,
      rsvp_confirmed_by: confirmed ? actor : null,
    })
    .eq('team_id', teamId);

  if (error) {
    console.error('RSVP update failed:', error);
    return { ok: false, code: 'RSVP_FAILED', message: 'Could not record the RSVP.' };
  }

  // The RSVP is what holds the seat, so Round 1 access moves with it — granted
  // on a confirmation and taken back on a withdrawal.
  const withAccess = await syncRoundOneAccess();

  console.warn(`[shortlist] RSVP ${confirmed ? 'confirmed' : 'cleared'} for team ${teamId} by ${actor}`);
  return { ok: true, confirmed, with_access: withAccess };
}

/** Who has answered, for the console. */
export async function rsvpStates(): Promise<RsvpState[]> {
  const { data } = await db
    .from('screening_shortlist')
    .select('team_id, rsvp_confirmed_at, rsvp_confirmed_by')
    .eq('result', 'shortlisted');

  return ((data ?? []) as Array<{ team_id: string; rsvp_confirmed_at: string | null; rsvp_confirmed_by: string | null }>)
    .map((row) => ({
      team_id: row.team_id,
      confirmed_at: row.rsvp_confirmed_at,
      confirmed_by: row.rsvp_confirmed_by,
    }));
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
