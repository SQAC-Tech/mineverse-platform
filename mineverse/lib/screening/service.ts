import { supabaseServer } from '@/lib/supabase/server';
import { registrationYears } from '@/lib/registration-no';
import { noteDevUnlockBypass } from '@/lib/gameplay/dev-mode';
import {
  DEV_OPEN_SCREENING,
  DIFFICULTY_POINTS,
  FIRST_YEAR_BONUS,
  GAUNTLET_PUZZLES,
  REQUIRE_PAYMENT_VERIFIED,
  SCREENING_QUESTION_COUNT,
  SCREENING_ROUND_ID,
  canStart,
  deadlineFrom,
  type Difficulty,
} from './config';
import { applyOptionOrder, drawPaper, resolveSelectedIndex } from './draw';
import { RELAY_WORDS, calculateCombinatorics, generateCodeSnippets } from './relayLogic';

const db = supabaseServer as any;

const PUZZLE_PHOTOS = [
  'Cave Biome.jpg',
  'Cherry Grove.webp',
  'Forest Biome.jpg',
  'Mountain Biome.jpg',
  'Nether Biome.jpg'
];

function applyCipher(text: string): string {
  const lettersOnly = text.toUpperCase().replace(/[^A-Z]/g, '');
  const shift = lettersOnly.length;
  let result = '';
  for (let i = 0; i < lettersOnly.length; i++) {
    const charCode = lettersOnly.charCodeAt(i) - 65;
    const shifted = (charCode + shift) % 26;
    result += String.fromCharCode(shifted + 65);
  }
  return result;
}

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
 * True when every member of the team is a first year.
 *
 * A team is the unit, so paying any team that merely contains a first year
 * would let one junior carry two seniors past an all-first-year team — the
 * opposite of favouring first years. See FIRST_YEAR_BONUS.
 */
export async function isFirstYearTeam(teamId: string, now: Date = new Date()): Promise<boolean> {
  const { data: members } = await db
    .from('members')
    .select('registration_no')
    .eq('team_id', teamId);

  if (!members?.length) return false;

  const firstYearPrefix = registrationYears(now)[0].prefix;
  return members.every((member: { registration_no: string | null }) =>
    (member.registration_no ?? '').toUpperCase().startsWith(firstYearPrefix),
  );
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
  options: { forceReset?: boolean; year?: number } = {},
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
  const teamYear = options.year || 1;
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

interface AttemptRow {
  id: string;
  team_id: string;
  question_ids: string[];
  option_order: { current_step?: number; answers?: Record<number, string> } | any;
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

  if (cleanAnswer !== expected) {
    return {
      ok: false,
      status: 400,
      code: 'WRONG_ANSWER',
      message: puzzleConfig.errorMessage,
    };
  }

  // Correct answer provided for this puzzle!
  const currentAnswers = optionOrder.answers || {};
  currentAnswers[puzzleId] = answerText.trim();
  const nextStep = puzzleId + 1;
  const isCompleted = puzzleId >= GAUNTLET_PUZZLES.length;

  const newOptionOrder = {
    ...optionOrder,
    current_step: isCompleted ? 4 : nextStep,
    answers: currentAnswers,
  };

  const updateFields: any = {
    option_order: newOptionOrder,
  };

  if (isCompleted) {
    const now = new Date().toISOString();
    updateFields.status = 'submitted';
    updateFields.submitted_at = now;
    updateFields.total_score = 100;
    updateFields.correct_count = 3;
    updateFields.raw_score = 100;
  }

  const { error } = await db
    .from('screening_attempts')
    .update(updateFields)
    .eq('id', attempt.id);

  if (error) {
    console.error('Screening Gauntlet answer save failed:', error);
    return { ok: false, status: 500, code: 'SAVE_FAILED' };
  }

  return {
    ok: true,
    data: {
      success: true,
      current_step: isCompleted ? 4 : nextStep,
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

  const [{ data: questions }, { data: answers }] = await Promise.all([
    db.from('screening_questions').select('id, difficulty, correct_index').in('id', attempt.question_ids),
    db.from('screening_answers').select('question_id, selected_index').eq('attempt_id', attempt.id),
  ]);

  const byId = new Map<string, { difficulty: Difficulty; correct_index: number }>(
    (questions ?? []).map((q: any) => [q.id as string, q]),
  );
  let rawScore = 0;
  let correctCount = 0;

  for (const answer of answers ?? []) {
    const question = byId.get(answer.question_id);
    if (!question) continue;
    if (answer.selected_index === question.correct_index) {
      correctCount += 1;
      rawScore += DIFFICULTY_POINTS[question.difficulty as Difficulty] ?? 0;
    }
  }

  const bonus = (await isFirstYearTeam(teamId)) ? FIRST_YEAR_BONUS : 0;
  const submittedAt = new Date().toISOString();

  const { error } = await db
    .from('screening_attempts')
    .update({
      submitted_at: submittedAt,
      auto_submitted: Boolean(options.auto),
      raw_score: rawScore,
      bonus_points: bonus,
      total_score: rawScore + bonus,
      correct_count: correctCount,
      status: options.auto ? 'expired' : 'submitted',
    })
    .eq('id', attempt.id)
    // Guards the race between a manual submit and the deadline sweep: whichever
    // updates first wins, the other matches nothing.
    .eq('status', 'in_progress');

  if (error) {
    console.error('Screening submit failed:', error);
    return { ok: false, status: 500, code: 'SUBMIT_FAILED' };
  }

  return { ok: true, data: { submitted_at: submittedAt, auto_submitted: Boolean(options.auto) } };
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
