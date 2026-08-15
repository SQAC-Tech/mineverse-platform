import { supabaseServer } from '@/lib/supabase/server';
import { registrationYears } from '@/lib/registration-no';
import { noteDevUnlockBypass } from '@/lib/gameplay/dev-mode';
import {
  DEV_OPEN_SCREENING,
  DIFFICULTY_POINTS,
  FIRST_YEAR_BONUS,
  REQUIRE_PAYMENT_VERIFIED,
  SCREENING_QUESTION_COUNT,
  SCREENING_ROUND_ID,
  canStart,
  deadlineFrom,
  type Difficulty,
} from './config';
import { applyOptionOrder, drawPaper, resolveSelectedIndex } from './draw';

const db = supabaseServer as any;

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
export async function startAttempt(teamId: string): Promise<Result<StartedAttempt>> {
  const round = await getScreeningRound();
  if (!round) {
    return { ok: false, status: 500, code: 'SCREENING_NOT_CONFIGURED' };
  }

  const existing = await loadAttempt(teamId);
  if (existing) {
    // A reload, a second tab, or a double-click. Hand back the same paper
    // rather than refusing — the unique constraint would refuse anyway, and a
    // team staring at an error mid-clock is worse than an idempotent start.
    return getAttemptForPlayer(teamId);
  }

  if (!canStart({ startsAt: round.starts_at, endsAt: round.ends_at })) {
    if (!DEV_OPEN_SCREENING) {
      return { ok: false, status: 403, code: 'WINDOW_CLOSED', message: 'The screening round is not open.' };
    }
    // Only the date check is skipped. Payment verification, the one-attempt
    // rule, the draw, the 30-minute deadline and grading are all untouched
    // below, so a walk through in dev exercises the real thing.
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

  const { data: bank } = await db.from('screening_questions').select('id, difficulty');
  if (!bank?.length) {
    return { ok: false, status: 500, code: 'BANK_EMPTY' };
  }

  const paper = drawPaper(bank as Array<{ id: string; difficulty: Difficulty }>, teamId);
  if (paper.shortfall) {
    // Refusing here beats dealing a short paper that scores out of a different
    // maximum than everyone else's.
    console.error('Screening bank cannot fill the draw:', paper.shortfall);
    return { ok: false, status: 500, code: 'BANK_INCOMPLETE' };
  }

  const startedAt = new Date();
  const { error } = await db.from('screening_attempts').insert({
    team_id: teamId,
    question_ids: paper.questionIds,
    option_order: paper.optionOrder,
    started_at: startedAt.toISOString(),
    deadline_at: deadlineFrom(startedAt).toISOString(),
    status: 'in_progress',
  });

  if (error) {
    // 23505: two tabs raced. The winner's paper is the real one.
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
  option_order: Record<string, number[]>;
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

export interface PlayerAttempt extends StartedAttempt {
  status: 'in_progress' | 'submitted' | 'expired';
  submitted_at: string | null;
}

export async function getAttemptForPlayer(teamId: string): Promise<Result<PlayerAttempt>> {
  const attempt = await loadAttempt(teamId);
  if (!attempt) return { ok: false, status: 404, code: 'NO_ATTEMPT' };

  // A tab left open past the deadline gets graded on the way in rather than
  // being handed a live-looking paper it can no longer answer.
  if (attempt.status === 'in_progress' && Date.now() >= new Date(attempt.deadline_at).getTime()) {
    await submitAttempt(teamId, { auto: true });
    const graded = await loadAttempt(teamId);
    if (graded) attempt.status = graded.status;
  }

  const [{ data: questions }, { data: answers }] = await Promise.all([
    db.from('screening_questions').select('id, prompt, options').in('id', attempt.question_ids),
    db.from('screening_answers').select('question_id, selected_index').eq('attempt_id', attempt.id),
  ]);

  const byId = new Map<string, { id: string; prompt: string; options: string[] }>(
    (questions ?? []).map((q: any) => [q.id as string, q]),
  );
  const answered = new Map<string, number>(
    (answers ?? []).map((a: any) => [a.question_id as string, a.selected_index as number]),
  );

  // `question_ids` is the display order; `in()` returns rows in whatever order
  // Postgres likes, so the paper is rebuilt from the sealed array, not the query.
  const serialized: SafeScreeningQuestion[] = attempt.question_ids.flatMap((id, index) => {
    const question = byId.get(id);
    if (!question) return [];
    const order = attempt.option_order[id] ?? [0, 1, 2, 3];
    const storedIndex = answered.get(id);
    return [{
      id,
      number: index + 1,
      prompt: question.prompt,
      options: applyOptionOrder(question.options, order),
      // Stored answers are in stored-order; the player thinks in slots.
      selected_slot: storedIndex === undefined ? null : order.indexOf(storedIndex),
    }];
  });

  return {
    ok: true,
    data: {
      attempt_id: attempt.id,
      deadline_at: attempt.deadline_at,
      seconds_remaining: Math.max(0, Math.floor((new Date(attempt.deadline_at).getTime() - Date.now()) / 1000)),
      questions: serialized,
      status: attempt.status,
      submitted_at: attempt.submitted_at,
    },
  };
}

/* ------------------------------------------------------------------ answer */

export async function saveAnswer(
  teamId: string,
  questionId: string,
  selectedSlot: number,
): Promise<Result<{ saved: true; seconds_remaining: number }>> {
  const attempt = await loadAttempt(teamId);
  if (!attempt) return { ok: false, status: 404, code: 'NO_ATTEMPT' };
  if (attempt.status !== 'in_progress') {
    return { ok: false, status: 409, code: 'ALREADY_SUBMITTED' };
  }
  if (Date.now() >= new Date(attempt.deadline_at).getTime()) {
    await submitAttempt(teamId, { auto: true });
    return { ok: false, status: 409, code: 'TIME_UP', message: 'Your 30 minutes are over.' };
  }
  if (!attempt.question_ids.includes(questionId)) {
    return { ok: false, status: 403, code: 'NOT_ON_YOUR_PAPER' };
  }

  const order = attempt.option_order[questionId] ?? [0, 1, 2, 3];
  const storedIndex = resolveSelectedIndex(selectedSlot, order);
  if (storedIndex < 0) return { ok: false, status: 400, code: 'BAD_OPTION' };

  const { error } = await db.from('screening_answers').upsert(
    {
      attempt_id: attempt.id,
      question_id: questionId,
      // Stored in the bank's order, so grading never has to know about shuffles.
      selected_index: storedIndex,
      answered_at: new Date().toISOString(),
    },
    { onConflict: 'attempt_id,question_id' },
  );

  if (error) {
    console.error('Screening answer save failed:', error);
    return { ok: false, status: 500, code: 'SAVE_FAILED' };
  }

  return {
    ok: true,
    data: {
      saved: true,
      seconds_remaining: Math.max(0, Math.floor((new Date(attempt.deadline_at).getTime() - Date.now()) / 1000)),
    },
  };
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
