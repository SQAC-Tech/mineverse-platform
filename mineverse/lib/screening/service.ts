import { supabaseServer } from '@/lib/supabase/server';
import { teamAcademicYear } from '@/lib/registration-no';
import { noteDevUnlockBypass } from '@/lib/gameplay/dev-mode';
import {
  applyCipher,
  DEV_OPEN_SCREENING,
  FIRST_YEAR_BONUS,
  GAUNTLET_PUZZLES,
  REQUIRE_PAYMENT_VERIFIED,
  SCREENING_QUESTION_COUNT,
  SCREENING_ROUND_ID,
  canStart,
  deadlineFrom,
  scoreGauntlet,
} from './config';
import { RELAY_WORDS, calculateCombinatorics, generateCodeSnippets } from './relayLogic';

const db = supabaseServer as any;

const PUZZLE_PHOTOS = [
  'Cave Biome.jpg',
  'Cherry Grove.webp',
  'Forest Biome.jpg',
  'Mountain Biome.jpg',
  'Nether Biome.jpg'
];

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string; message?: string };

/* ------------------------------------------------------------------ window */

export interface ScreeningRound {
  starts_at: string | null;
  ends_at: string | null;
  status: string;
}

export async function getScreeningRound(): Promise<ScreeningRound | null> {
  const { data } = await db
    .from('rounds')
    .select('starts_at, ends_at, status')
    .eq('id', SCREENING_ROUND_ID)
    .single();
  return data ?? null;
}

/* ------------------------------------------------------------- serializing */

/**
 * What a player is allowed to see.
 *
 * `correct_index` is the obvious one. `difficulty` is deliberately stripped too:
 * the weights are organiser-only, and a labelled "hard" tells a team which five
 * questions are worth double and therefore which twenty to skip.
 */
export interface SafeScreeningQuestion {
  id: string;
  /** 1-based position on this team's paper, not the bank's order_index. */
  number: number;
  prompt: string;
  /** Already permuted into this team's order. */
  options: string[];
  /** The slot this team picked, in the same permuted order. */
  selected_slot: number | null;
}

/* ------------------------------------------------------------- eligibility */

/**
 * The year this team sits the screening as, read off the roster.
 *
 * Registration numbers carry the admission year, so the team never had to be
 * asked. It used to be: the instructions screen showed a pair of radio buttons
 * and posted the answer to `start`, which trusted it. That put the choice of
 * paper in the hands of the team taking it — a second-year team could pick
 * "1st Year", skip the code-reading variant, and also be scored against a
 * first-year field.
 *
 * `teamAcademicYear` carries the rules and the reasoning; the only thing this
 * adds is the database read. Members with no registration number count as
 * second years, so this cannot be steered by leaving a field blank either.
 */
export async function getTeamYear(teamId: string, now: Date = new Date()): Promise<number> {
  const { data: members } = await db
    .from('members')
    .select('registration_no')
    .eq('team_id', teamId);

  return teamAcademicYear(
    (members ?? []).map((member: { registration_no: string | null }) => member.registration_no),
    now,
  );
}

/**
 * True when every member of the team is a first year.
 *
 * A team is the unit, so paying any team that merely contains a first year
 * would let one junior carry two seniors past an all-first-year team — the
 * opposite of favouring first years. See FIRST_YEAR_BONUS.
 *
 * Same rule as the paper, deliberately: a team that sits the first-year paper
 * is exactly the team that collects the first-year bonus. Deriving both from
 * `getTeamYear` is what keeps that true — they were two separate readings of
 * the roster before, and only one of them was server-side.
 */
export async function isFirstYearTeam(teamId: string, now: Date = new Date()): Promise<boolean> {
  const { data: members } = await db
    .from('members')
    .select('registration_no')
    .eq('team_id', teamId);

  // An empty roster is not a first-year team. `teamAcademicYear` already
  // returns 2 for one, but saying so here keeps the intent readable.
  if (!members?.length) return false;

  return (await getTeamYear(teamId, now)) === 1;
}

/* ------------------------------------------------------------------- start */

export interface StartedAttempt {
  attempt_id: string;
  deadline_at: string;
  seconds_remaining: number;
  questions: SafeScreeningQuestion[];
}

/**
 * Seals this team's paper and starts their clock.
 *
 * The ONLY place the window is checked. Every other route reads the attempt's
 * own `deadline_at`, so a team that starts at 23:58 keeps its full 30 minutes
 * and submits at 00:28 — the window closes the door on starting, nothing else.
 */
export async function resetAttempt(teamId: string): Promise<Result<{ reset: boolean }>> {
  const { error } = await db
    .from('screening_attempts')
    .delete()
    .eq('team_id', teamId);

  if (error) {
    console.error('Screening reset failed:', error);
    return { ok: false, status: 500, code: 'RESET_FAILED' };
  }

  return { ok: true, data: { reset: true } };
}

/**
 * Seals this team's paper and starts their clock.
 */
export async function startAttempt(
  teamId: string,
  options: { forceReset?: boolean } = {},
): Promise<Result<StartedAttempt>> {
  const round = await getScreeningRound();
  if (!round) {
    return { ok: false, status: 500, code: 'SCREENING_NOT_CONFIGURED' };
  }

  if (options.forceReset) {
    await resetAttempt(teamId);
  } else {
    const existing = await loadAttempt(teamId);
    if (existing) {
      // If the existing attempt is already completed or expired, reset it on start if dev mode is enabled
      if ((existing.status !== 'in_progress' && DEV_OPEN_SCREENING) || options.forceReset) {
        await resetAttempt(teamId);
      } else {
        return getAttemptForPlayer(teamId);
      }
    }
  }

  if (!canStart({ startsAt: round.starts_at, endsAt: round.ends_at })) {
    if (!DEV_OPEN_SCREENING) {
      return { ok: false, status: 403, code: 'WINDOW_CLOSED', message: 'The screening round is not open.' };
    }
    noteDevUnlockBypass(`screening window for team ${teamId}`);
  }

  const { data: team } = await db
    .from('teams')
    .select('is_payment_verified')
    .eq('id', teamId)
    .single();

  if (REQUIRE_PAYMENT_VERIFIED && !team?.is_payment_verified) {
    return {
      ok: false,
      status: 403,
      code: 'PAYMENT_NOT_VERIFIED',
      message: 'Your registration payment has not been verified yet. Contact an organizer.',
    };
  }

  const startedAt = new Date();
  const word_assigned = RELAY_WORDS[Math.floor(Math.random() * RELAY_WORDS.length)];
  const image_assigned = PUZZLE_PHOTOS[Math.floor(Math.random() * PUZZLE_PHOTOS.length)];
  // Read off the roster, never taken from the request. See `getTeamYear`.
  const teamYear = await getTeamYear(teamId, startedAt);
  let code_snippets: Record<string, string> | undefined;
  
  if (teamYear >= 2) {
    const targetAnswer = calculateCombinatorics(word_assigned);
    code_snippets = generateCodeSnippets(word_assigned, targetAnswer);
  }

  const initialGauntletState = {
    current_step: 1,
    answers: {},
    year: teamYear,
    word_assigned,
    image_assigned,
    code_snippets,
  };

  const { error } = await db.from('screening_attempts').insert({
    team_id: teamId,
    question_ids: [],
    option_order: initialGauntletState,
    started_at: startedAt.toISOString(),
    deadline_at: deadlineFrom(startedAt).toISOString(),
    status: 'in_progress',
  });

  if (error) {
    if (error.code === '23505') return getAttemptForPlayer(teamId);
    console.error('Screening start failed:', error);
    return { ok: false, status: 500, code: 'START_FAILED' };
  }

  return getAttemptForPlayer(teamId);
}

/* ------------------------------------------------------------------ attempt */

/**
 * Everything the Gauntlet knows about one attempt, stored in `option_order`.
 *
 * The column is misnamed: it belongs to the 25-question MCQ paper the screening
 * used to be, where it held each team's shuffled option permutation. The
 * Gauntlet reuses it as a state blob rather than migrating, which is a fair
 * trade for a round that runs once — but it means this interface is the only
 * description of the shape anywhere, so it is worth keeping honest.
 */
export interface GauntletState {
  current_step?: number;
  /** The text each solved puzzle was solved with, keyed by puzzle id. */
  answers?: Record<string, string>;
  /**
   * Per-puzzle audit. `tries` counts every answer submitted, right or wrong, so
   * an organiser looking at a dispute can tell a team that solved puzzle 1 in
   * one go from a team that arrived at it after forty guesses.
   */
  progress?: Record<string, { tries: number; solved_at: string | null }>;
  year?: number;
  word_assigned?: string;
  image_assigned?: string;
  code_snippets?: Record<string, string>;
}

interface AttemptRow {
  id: string;
  team_id: string;
  question_ids: string[];
  option_order: GauntletState | null;
  started_at: string;
  deadline_at: string;
  submitted_at: string | null;
  status: 'in_progress' | 'submitted' | 'expired';
  total_score: number | null;
}

async function loadAttempt(teamId: string): Promise<AttemptRow | null> {
  const { data } = await db
    .from('screening_attempts')
    .select('id, team_id, question_ids, option_order, started_at, deadline_at, submitted_at, status, total_score')
    .eq('team_id', teamId)
    .maybeSingle();
  return (data as AttemptRow) ?? null;
}

/**
 * The puzzles this attempt actually solved.
 *
 * Reads `progress` first because that is where a solve is recorded with its
 * time, and falls back to the keys of `answers` for rows written before
 * `progress` existed — those carry an entry only when the answer was accepted,
 * so the two agree on which puzzles are done.
 */
export function solvedPuzzleIds(state: GauntletState | null | undefined): number[] {
  const solved = new Set<number>();
  for (const [key, entry] of Object.entries(state?.progress ?? {})) {
    if (entry?.solved_at) solved.add(Number(key));
  }
  for (const key of Object.keys(state?.answers ?? {})) solved.add(Number(key));
  return [...solved].filter((id) => Number.isInteger(id)).sort((a, b) => a - b);
}

/** Every answer submitted across the attempt, right or wrong. */
export function totalTries(state: GauntletState | null | undefined): number {
  return Object.values(state?.progress ?? {}).reduce((sum, entry) => sum + (entry?.tries ?? 0), 0);
}

export interface PlayerAttempt {
  attempt_id: string;
  deadline_at: string;
  seconds_remaining: number;
  current_step: number;
  answers: Record<number, string>;
  questions: SafeScreeningQuestion[];
  status: 'in_progress' | 'submitted' | 'expired';
  submitted_at: string | null;
  year?: number;
  word_assigned?: string;
  image_assigned?: string;
  code_snippets?: Record<string, string>;
}

export async function getAttemptForPlayer(teamId: string): Promise<Result<PlayerAttempt>> {
  const attempt = await loadAttempt(teamId);
  if (!attempt) return { ok: false, status: 404, code: 'NO_ATTEMPT' };

  if (attempt.status === 'in_progress' && Date.now() >= new Date(attempt.deadline_at).getTime()) {
    await submitAttempt(teamId, { auto: true });
    const graded = await loadAttempt(teamId);
    if (graded) attempt.status = graded.status;
  }

  const optionOrder = attempt.option_order || {};
  const currentStep = typeof optionOrder.current_step === 'number' ? optionOrder.current_step : 1;
  const answersMap = optionOrder.answers || {};

  return {
    ok: true,
    data: {
      attempt_id: attempt.id,
      deadline_at: attempt.deadline_at,
      seconds_remaining: Math.max(0, Math.floor((new Date(attempt.deadline_at).getTime() - Date.now()) / 1000)),
      current_step: currentStep,
      answers: answersMap,
      questions: [],
      status: attempt.status,
      submitted_at: attempt.submitted_at,
      year: optionOrder.year,
      word_assigned: optionOrder.word_assigned,
      image_assigned: optionOrder.image_assigned,
      code_snippets: optionOrder.code_snippets,
    },
  };
}

/* ------------------------------------------------------------------ answer */

export async function saveGauntletAnswer(
  teamId: string,
  puzzleId: number,
  answerText: string,
  durationSeconds?: number,
  moves?: number,
): Promise<Result<{ success: boolean; current_step: number; message?: string; completed?: boolean; seconds_remaining: number }>> {
  const attempt = await loadAttempt(teamId);
  if (!attempt) return { ok: false, status: 404, code: 'NO_ATTEMPT' };
  if (attempt.status !== 'in_progress') {
    return { ok: false, status: 409, code: 'ALREADY_SUBMITTED' };
  }
  if (Date.now() >= new Date(attempt.deadline_at).getTime()) {
    await submitAttempt(teamId, { auto: true });
    return { ok: false, status: 409, code: 'TIME_UP', message: 'Your 30 minutes are over.' };
  }

  const puzzleConfig = GAUNTLET_PUZZLES.find((p) => p.id === puzzleId);
  if (!puzzleConfig) {
    return { ok: false, status: 400, code: 'INVALID_PUZZLE' };
  }

  const optionOrder = attempt.option_order || {};
  const cleanAnswer = answerText.trim().toUpperCase();
  
  let expected = puzzleConfig.expectedAnswer.toUpperCase();
  
  // Dynamic override for Puzzle 1
  if (puzzleId === 1 && optionOrder.word_assigned) {
    const calculatedAnswer = calculateCombinatorics(optionOrder.word_assigned);
    expected = calculatedAnswer.toString();
  }

  // Dynamic override for Puzzle 3
  if (puzzleId === 3 && optionOrder.image_assigned) {
    const imageName = optionOrder.image_assigned.replace(/\.[^/.]+$/, ""); // strip extension
    expected = applyCipher(imageName);
  }

  const correct = cleanAnswer === expected;
  const now = new Date().toISOString();
  const key = String(puzzleId);
  const previous = optionOrder.progress?.[key];

  // Every attempt is recorded, not just the winning one. A wrong guess is the
  // only evidence that a team was working rather than idle, and the count is
  // what makes a brute-forced numeric PIN visible on the admin screen instead
  // of looking identical to a team that got it first time.
  const progress: GauntletState['progress'] = {
    ...(optionOrder.progress ?? {}),
    [key]: {
      tries: (previous?.tries ?? 0) + 1,
      solved_at: previous?.solved_at ?? (correct ? now : null),
    },
  };

  if (!correct) {
    // Persisted even on a wrong answer, so the try count survives a team that
    // never gets there. Nothing else about the attempt changes.
    const { error: missError } = await db
      .from('screening_attempts')
      .update({ option_order: { ...optionOrder, progress } })
      .eq('id', attempt.id)
      .eq('status', 'in_progress');

    if (missError) console.error('Screening Gauntlet miss log failed:', missError);

    return {
      ok: false,
      status: 400,
      code: 'WRONG_ANSWER',
      message: puzzleConfig.errorMessage,
    };
  }

  const currentAnswers = { ...(optionOrder.answers ?? {}), [key]: answerText.trim() };
  const nextStep = puzzleId + 1;
  const isCompleted = solvedPuzzleIds({ ...optionOrder, answers: currentAnswers, progress }).length
    >= GAUNTLET_PUZZLES.length;

  const { error } = await db
    .from('screening_attempts')
    .update({
      option_order: {
        ...optionOrder,
        current_step: isCompleted ? GAUNTLET_PUZZLES.length + 1 : nextStep,
        answers: currentAnswers,
        progress,
      },
    })
    .eq('id', attempt.id);

  if (error) {
    console.error('Screening Gauntlet answer save failed:', error);
    return { ok: false, status: 500, code: 'SAVE_FAILED' };
  }

  /**
   * The relay mirror, for `/admin/relay-data`.
   *
   * A second copy of the same answer: `option_order.answers` is what the
   * Gauntlet grades from, and `relay_screening_attempts` is the per-puzzle
   * telemetry table the relay console reads. Kept because the timings and the
   * slider move count only exist here — the client measures them and the state
   * blob has nowhere to put them.
   *
   * Written with an upsert rather than a select-then-branch. Two answers landing
   * together both saw no row and both inserted, and the second lost to the
   * `team_id` unique constraint; the same fix `/api/screening/relay` already
   * carries. Columns not named here keep whatever the row already had, so
   * puzzle 3 does not blank out puzzle 1.
   */
  const relayUpdate: Record<string, unknown> = {
    team_id: teamId,
    word_assigned: optionOrder.word_assigned || 'UNKNOWN',
  };

  if (puzzleId === 1) {
    relayUpdate.year1_answer = answerText.trim();
    relayUpdate.year1_status = 'completed';
    if (durationSeconds !== undefined) relayUpdate.year1_duration_seconds = durationSeconds;
  }
  if (puzzleId === 2) {
    relayUpdate.year2_answer = answerText.trim();
    relayUpdate.year2_status = 'completed';
    if (durationSeconds !== undefined) relayUpdate.year2_duration_seconds = durationSeconds;
    if (moves !== undefined) relayUpdate.year2_moves = moves;
  }
  if (puzzleId === 3) {
    relayUpdate.year3_answer = answerText.trim();
    relayUpdate.year3_status = 'completed';
    if (durationSeconds !== undefined) relayUpdate.year3_duration_seconds = durationSeconds;
  }

  // Completion is derived from the puzzles actually solved, not from "this was
  // puzzle 3". A team that solves 3 before 2 — or that has an older attempt
  // where 1 was never recorded — must not be marked finished by arriving at the
  // last id.
  if (isCompleted) {
    relayUpdate.is_completed = true;
    relayUpdate.submitted_at = new Date().toISOString();
  }

  const { error: relayError } = await db
    .from('relay_screening_attempts')
    .upsert(relayUpdate, { onConflict: 'team_id' });

  // Non-fatal: this table is a reporting mirror, and the answer is already
  // safe in `screening_attempts`. Losing the console row must not cost a team
  // the puzzle it just solved.
  if (relayError) console.error('Relay mirror write failed:', relayError);

  // Finishing hands the paper in through the same function the deadline sweep
  // uses. It used to write `total_score: 100` inline here, which is how a
  // completed attempt ended up skipping the first-year bonus that an expired
  // one received — the two paths disagreed because there were two of them.
  if (isCompleted) await submitAttempt(teamId);

  return {
    ok: true,
    data: {
      success: true,
      current_step: isCompleted ? GAUNTLET_PUZZLES.length + 1 : nextStep,
      message: puzzleConfig.successMessage,
      completed: isCompleted,
      seconds_remaining: Math.max(0, Math.floor((new Date(attempt.deadline_at).getTime() - Date.now()) / 1000)),
    },
  };
}

export async function saveAnswer(
  teamId: string,
  questionId: string,
  selectedSlot: number,
) {
  return saveGauntletAnswer(teamId, Number(questionId) || 1, String(selectedSlot));
}

/* ------------------------------------------------------------------ submit */

export interface SubmitOutcome {
  submitted_at: string;
  auto_submitted: boolean;
}

/**
 * Grades and freezes the attempt. Idempotent — the deadline sweep and a manual
 * submit both land here, and whichever arrives second is a no-op.
 *
 * Nothing about the score is returned: this response reaches a player, and
 * every player is a channel to the teams who have not sat the paper yet.
 */
export async function submitAttempt(
  teamId: string,
  options: { auto?: boolean } = {},
): Promise<Result<SubmitOutcome>> {
  const attempt = await loadAttempt(teamId);
  if (!attempt) return { ok: false, status: 404, code: 'NO_ATTEMPT' };

  if (attempt.status !== 'in_progress') {
    return {
      ok: true,
      data: { submitted_at: attempt.submitted_at ?? new Date().toISOString(), auto_submitted: false },
    };
  }

  // Scored from the puzzles this attempt solved, which live in the attempt's own
  // state blob. It used to be scored against `screening_questions` joined to
  // `screening_answers` — the tables the retired MCQ paper used and the Gauntlet
  // never writes — so every attempt that reached here scored zero regardless of
  // how far it got. A team that solved two puzzles and ran out of time was
  // stored as a team that solved none.
  const solved = solvedPuzzleIds(attempt.option_order);
  const { raw_score: rawScore, correct_count: correctCount } = scoreGauntlet(solved);

  const bonus = (await isFirstYearTeam(teamId)) ? FIRST_YEAR_BONUS : 0;
  const submittedAt = new Date().toISOString();

  /**
   * Whether the clock ended this rather than the team.
   *
   * Derived from the deadline as well as the caller's flag, because the browser
   * posts the same body whether the team pressed the button or the timer hit
   * zero — the client knows which, but a field a player controls is not the
   * place to record it. The deadline is on the server and cannot be argued with.
   */
  const ranOut = Boolean(options.auto) || Date.now() >= new Date(attempt.deadline_at).getTime();
  const finished = solved.length >= GAUNTLET_PUZZLES.length;

  const { error } = await db
    .from('screening_attempts')
    .update({
      submitted_at: submittedAt,
      auto_submitted: ranOut && !finished,
      raw_score: rawScore,
      bonus_points: bonus,
      total_score: rawScore + bonus,
      correct_count: correctCount,
      // A team that solved all three puzzles has submitted, even when it is the
      // deadline sweep that writes the row — "expired" beside a full score
      // reads as a bug to whoever is looking at the console at 11pm.
      status: ranOut && !finished ? 'expired' : 'submitted',
    })
    .eq('id', attempt.id)
    // Guards the race between a manual submit and the deadline sweep: whichever
    // updates first wins, the other matches nothing.
    .eq('status', 'in_progress');

  if (error) {
    console.error('Screening submit failed:', error);
    return { ok: false, status: 500, code: 'SUBMIT_FAILED' };
  }

  return { ok: true, data: { submitted_at: submittedAt, auto_submitted: ranOut && !finished } };
}

/**
 * Grades any attempt whose deadline has passed while nobody was looking.
 *
 * Called from the admin console rather than a cron: a team that closed its
 * laptop at question 20 must still be ranked, and their answers are already on
 * the server.
 */
export async function sweepExpiredAttempts(): Promise<number> {
  const { data: stale } = await db
    .from('screening_attempts')
    .select('team_id')
    .eq('status', 'in_progress')
    .lt('deadline_at', new Date().toISOString());

  let graded = 0;
  for (const row of stale ?? []) {
    const result = await submitAttempt(row.team_id, { auto: true });
    if (result.ok) graded += 1;
  }
  return graded;
}

export { SCREENING_QUESTION_COUNT };
