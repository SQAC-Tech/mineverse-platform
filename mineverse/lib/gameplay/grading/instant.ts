/**
 * Automatic grading and payout, run the moment a team hands work in.
 *
 * The event used to mark everything in an admin batch after the round. That had
 * one fatal property nobody noticed until the live database was checked: the
 * batch had never been run, so `resource_ledger` held zero `question_grade` rows
 * and every team would have finished Round 1 with nothing to craft with. Paying
 * at hand-in removes the step that can be forgotten.
 *
 * ## Where this runs
 *
 * On the section lock in `lockTeamSection`, and again as a sweep when a team
 * finishes the round. Never on a plain answer write — `useAnswerAutosave` posts
 * every 25 seconds, and grading those would freeze a team's answer at whatever
 * they had typed part-way through and mark it wrong. Hand-in is a deliberate
 * act; autosave is not. That distinction is the whole reason this module sat
 * unused for so long, and it is now honoured by calling it from the lock alone.
 *
 * ## How each answer is marked
 *
 *   coding, all hidden tests passed  -> full reward, no second guessing
 *   coding, some tests failed        -> the model grades the logic, partial pay
 *   answer key matches               -> full reward
 *   answer key misses, numeric key   -> wrong, no model call
 *   answer key misses, worded key    -> the model checks for a near-miss
 *   no answer key at all             -> the model grades against the rubric
 *
 * ## What partial credit pays
 *
 *   >= 75%  full reward
 *   50-75%  70% of the reward
 *   < 50%   nothing
 *
 * ## Paying twice
 *
 * Every award is keyed on the submission and its revision (see `awardKeyFor`)
 * and `resource_ledger` is unique on `(team_id, idempotency_key)`, so the sweep
 * re-examining a submission the section lock already paid cannot pay it again.
 * That is what makes the finish-round check safe to run over the whole round.
 */

import { createHash } from 'node:crypto';
import { supabaseServer } from '@/lib/supabase/server';
import { checkDeterministicAnswer, hasDeterministicKey } from './deterministic';
import {
  acceptedAnswers,
  gradeCode,
  gradeOpenEnded,
  isFixedAnswerKey,
  isLlmConfigured,
  rescueFreeText,
} from './llm';
import { mutateTeamResource, type ResourceDelta } from '@/lib/gameplay/marketplace/resource-client';
import { getActiveModifiers, applyModifiers } from '@/lib/gameplay/events/service';

const db = supabaseServer as any;

/** Score at or above this is a full payout. */
export const FULL_CREDIT = 0.75;
/** Score at or above this earns the partial rate; below it earns nothing. */
export const PARTIAL_CREDIT = 0.5;
/** What a partial pass is worth. */
export const PARTIAL_RATE = 0.7;

export type GradePath = 'deterministic' | 'coding_tests' | 'coding_llm' | 'llm_rescue' | 'llm_rubric';

export interface GradedAnswer {
  submission_id: string;
  question_id: string;
  score: number;
  /** What fraction of the question's reward was actually paid. */
  payout: number;
  path: GradePath;
  awarded: ResourceDelta;
  manual_review: boolean;
  note: string;
}

export interface GradeSummary {
  graded: number;
  correct: number;
  partial: number;
  manual_review: number;
  awarded: ResourceDelta;
  answers: GradedAnswer[];
}

/** The public half of a coding evaluation, as the submit route stores it. */
interface CodingEvaluation {
  kind?: string;
  status?: string;
  hidden_passed?: number;
  hidden_total?: number;
  total_passed?: number;
  total_cases?: number;
}

function emptySummary(): GradeSummary {
  return { graded: 0, correct: 0, partial: 0, manual_review: 0, awarded: {}, answers: [] };
}

/** What a score is worth, as a fraction of the question's reward. */
export function payoutFor(score: number): number {
  if (score >= FULL_CREDIT) return 1;
  if (score >= PARTIAL_CREDIT) return PARTIAL_RATE;
  return 0;
}

/**
 * Scales a reward by a payout fraction.
 *
 * Rounds rather than floors, and never rounds a paid resource down to nothing:
 * a 70% payout on a reward of 1 emerald is still an emerald. Floor division
 * would hand a team a "partially correct" verdict and an empty inventory, which
 * reads as a bug to whoever is playing.
 */
export function scaleReward(reward: ResourceDelta, payout: number): ResourceDelta {
  if (payout >= 1) return { ...reward };
  if (payout <= 0) return {};

  const scaled: ResourceDelta = {};
  for (const [key, value] of Object.entries(reward)) {
    const amount = Number(value ?? 0);
    if (amount <= 0) continue;
    scaled[key as keyof ResourceDelta] = Math.max(1, Math.round(amount * payout));
  }
  return scaled;
}

/**
 * The idempotency key for one submission revision's award.
 *
 * `resource_ledger.idempotency_key` is a `uuid` column and `mutate_team_resources`
 * takes a `uuid` parameter, so the obvious readable key — `grade:<id>:rev:<n>` —
 * is rejected by Postgres outright, and every award would have been lost to a
 * cast error and parked in manual review. Hashing the readable key into a
 * version-5 UUID keeps the property that matters: the same submission at the
 * same revision always produces the same key, so the finish-round sweep cannot
 * pay for what the section hand-in already paid.
 */
export function awardKeyFor(submissionId: string, revision: number): string {
  const digest = createHash('sha1').update(`mineverse:grade:${submissionId}:rev:${revision}`).digest();
  // Version 5, RFC 4122 variant.
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function addDelta(into: ResourceDelta, extra: ResourceDelta) {
  for (const [key, value] of Object.entries(extra)) {
    const slot = key as keyof ResourceDelta;
    into[slot] = (into[slot] ?? 0) + Number(value ?? 0);
  }
}

function codingEvaluationOf(response: unknown): CodingEvaluation | null {
  if (!response || typeof response !== 'object') return null;
  const candidate = response as CodingEvaluation;
  return candidate.kind === 'coding_evaluation' ? candidate : null;
}

/**
 * Decides one answer without touching the database.
 *
 * Split out from the writing so the routing rules can be read — and tested —
 * without a live team, a live judge and a live language model.
 */
async function judge(submission: any, question: any): Promise<{
  score: number;
  path: GradePath;
  note: string;
  manualReview: boolean;
}> {
  const answer = submission.answer_text ?? submission.code ?? '';

  if (question.type === 'coding') {
    const evaluation = codingEvaluationOf(submission.response);
    const total = Number(evaluation?.total_cases ?? 0);
    const passed = Number(evaluation?.total_passed ?? 0);

    // Every test green is the end of it. The judge ran the team's real code
    // against the real cases; a model cannot improve on that and could only
    // disagree with it.
    if (evaluation?.status === 'completed' && total > 0 && passed >= total) {
      return { score: 1, path: 'coding_tests', note: `Passed all ${total} tests.`, manualReview: false };
    }

    if (!String(submission.code ?? '').trim()) {
      return { score: 0, path: 'coding_tests', note: 'No code submitted.', manualReview: false };
    }

    // Partial credit for code that ran but did not pass everything, and for code
    // that was saved without ever being submitted to the judge.
    const verdict = await gradeCode({
      prompt: question.prompt ?? '',
      language: submission.language ?? 'unknown',
      code: String(submission.code ?? ''),
      passed,
      total,
    });

    if (!verdict) {
      return {
        score: 0,
        path: 'coding_llm',
        note: isLlmConfigured() ? 'The grader could not be reached.' : 'No grading model is configured.',
        manualReview: true,
      };
    }

    const tested = total > 0 ? ` Passed ${passed}/${total} tests.` : ' Never run against the tests.';
    return { score: verdict.score, path: 'coding_llm', note: `${verdict.reasoning}${tested}`, manualReview: false };
  }

  if (hasDeterministicKey(question.expected_answer)) {
    if (checkDeterministicAnswer(answer, question.expected_answer) === true) {
      return { score: 1, path: 'deterministic', note: 'Matched the answer key.', manualReview: false };
    }

    // A numeric key is the whole truth about a numeric question. Nothing to
    // rescue and nobody to ask.
    if (isFixedAnswerKey(question.expected_answer)) {
      return { score: 0, path: 'deterministic', note: 'Did not match the answer key.', manualReview: false };
    }

    const verdict = await rescueFreeText({
      prompt: question.prompt ?? '',
      accepted: acceptedAnswers(question.expected_answer),
      answer: String(answer),
    });

    // A worded answer the key rejected and the model could not look at is
    // exactly the case that must not be scored zero unseen.
    if (!verdict) {
      return {
        score: 0,
        path: 'llm_rescue',
        note: isLlmConfigured() ? 'The grader could not be reached.' : 'No grading model is configured.',
        manualReview: true,
      };
    }

    return { score: verdict.score, path: 'llm_rescue', note: verdict.reasoning, manualReview: false };
  }

  const verdict = await gradeOpenEnded({
    prompt: question.prompt ?? '',
    rubric: question.rubric,
    answer: String(answer),
  });

  if (!verdict) {
    return {
      score: 0,
      path: 'llm_rubric',
      note: isLlmConfigured() ? 'The grader could not be reached.' : 'No grading model is configured.',
      manualReview: true,
    };
  }

  return { score: verdict.score, path: 'llm_rubric', note: verdict.reasoning, manualReview: false };
}

/**
 * Grades and pays every ungraded submission in `questionIds`, for one team.
 *
 * Answers already `graded` or parked in `manual_review` are left alone: those
 * are final, and re-marking them would either pay twice or overwrite an
 * organiser's decision.
 */
export async function gradeSubmissionsNow(params: {
  teamId: string;
  roundId: number;
  questionIds?: string[];
}): Promise<GradeSummary> {
  const { teamId, roundId } = params;

  let query = db
    .from('submissions')
    .select('id, team_id, round_id, question_id, answer_text, code, language, response, revision, status, locked_at')
    .eq('team_id', teamId)
    .eq('round_id', roundId)
    .in('status', ['draft', 'submitted', 'locked']);

  if (params.questionIds && params.questionIds.length > 0) {
    query = query.in('question_id', params.questionIds);
  }

  const { data: submissions, error } = await query;
  if (error) throw error;

  const pending = submissions ?? [];
  if (pending.length === 0) return emptySummary();

  const { data: questions, error: questionsError } = await db
    .from('questions')
    .select('id, type, prompt, reward, expected_answer, rubric, guardian_name')
    .in('id', [...new Set(pending.map((row: any) => row.question_id))]);
  if (questionsError) throw questionsError;

  const questionById = new Map((questions ?? []).map((row: any) => [row.id, row]));

  // Read once for the whole batch. A world event does not begin or end between
  // two questions of the same hand-in, and asking per answer would multiply the
  // queries by the size of the section.
  const modifiers = await getActiveModifiers(teamId);

  const summary = emptySummary();

  // Guardian and PvP questions are settled by their own systems and pay through
  // their own ledgers; they must not be marked here.
  const markable = pending.filter((submission: any) => {
    const question = questionById.get(submission.question_id) as any;
    return question && !question.guardian_name && question.type !== 'pvp';
  });

  /**
   * Every answer is judged at once, then written one at a time.
   *
   * Judging is network-bound — a section of six coding answers is six model
   * calls, and run in sequence at up to twenty seconds each that is two minutes
   * of a team staring at a disabled Submit button, inside a round that is still
   * counting down. Run together it is one call's worth of waiting.
   *
   * The writes stay sequential on purpose. They all mutate the same team's
   * resource row through `mutate_team_resources`, and concurrent callers there
   * contend on the row version; a lost race would surface as an answer marked
   * graded but never paid.
   */
  const verdicts = await Promise.all(
    markable.map(async (submission: any) => {
      const question = questionById.get(submission.question_id) as any;
      try {
        return { submission, question, verdict: await judge(submission, question), failed: false as const };
      } catch (judgeError) {
        console.error(`[grading] could not judge submission ${submission.id}:`, judgeError);
        return { submission, question, verdict: null, failed: true as const };
      }
    }),
  );

  for (const { submission, question, verdict, failed } of verdicts) {
    try {
      if (failed || !verdict) throw new Error('judging failed');
      const gradedAt = new Date().toISOString();

      if (verdict.manualReview) {
        await db
          .from('submissions')
          .update({ status: 'manual_review', feedback: verdict.note, updated_at: gradedAt })
          .eq('id', submission.id);

        summary.graded += 1;
        summary.manual_review += 1;
        summary.answers.push({
          submission_id: submission.id,
          question_id: submission.question_id,
          score: 0,
          payout: 0,
          path: verdict.path,
          awarded: {},
          manual_review: true,
          note: verdict.note,
        });
        continue;
      }

      const payout = payoutFor(verdict.score);
      const baseReward = (question.reward ?? {}) as ResourceDelta;
      // The event multiplier applies to what the team actually earned, so a
      // partial pass during Heavy Rain is doubled on its 70%, not on the full
      // reward it did not win.
      const award = payout > 0
        ? (applyModifiers(scaleReward(baseReward, payout) as Record<string, number>, modifiers) as ResourceDelta)
        : {};

      let ledgerId: string | null = null;

      if (Object.keys(award).length > 0) {
        const mutation = await mutateTeamResource({
          teamId,
          delta: award,
          sourceType: 'question_grade',
          sourceId: submission.id,
          idempotencyKey: awardKeyFor(submission.id, submission.revision),
          reason: payout >= 1 ? 'Correct answer' : 'Partially correct answer',
        });

        if (mutation.success) {
          ledgerId = mutation.ledgerId ?? null;
          addDelta(summary.awarded, award);
        } else if (mutation.error !== 'CONFLICT') {
          // A real payment failure must not be recorded as a graded answer that
          // was paid, or the team loses the resources with no trace.
          throw new Error(mutation.message ?? 'resource mutation failed');
        }
      }

      await db
        .from('submissions')
        .update({
          status: 'graded',
          final_score: verdict.score,
          graded_by: 'auto',
          graded_revision: submission.revision,
          feedback: verdict.note,
          locked_at: submission.locked_at ?? gradedAt,
          updated_at: gradedAt,
          ...(ledgerId ? { final_award_ledger_id: ledgerId } : {}),
        })
        .eq('id', submission.id);

      summary.graded += 1;
      if (payout >= 1) summary.correct += 1;
      else if (payout > 0) summary.partial += 1;

      summary.answers.push({
        submission_id: submission.id,
        question_id: submission.question_id,
        score: verdict.score,
        payout,
        path: verdict.path,
        awarded: award,
        manual_review: false,
        note: verdict.note,
      });
    } catch (gradeError) {
      // One answer failing must not cost a team the rest of its section.
      console.error(`[grading] could not grade submission ${submission.id}:`, gradeError);
      await db
        .from('submissions')
        .update({ status: 'manual_review', feedback: 'Automatic grading failed — an organiser will review this.' })
        .eq('id', submission.id);
      summary.graded += 1;
      summary.manual_review += 1;
    }
  }

  return summary;
}

/**
 * The end-of-round check: is every answer this team gave actually marked?
 *
 * Grading happens per section, and a section can miss the grader — the round
 * ended mid-request, a provider was down, a team answered a question and never
 * submitted its tab. This re-runs over the whole round and settles whatever is
 * still open. Idempotency makes it safe on everything it has already paid.
 */
export async function sweepRoundGrading(teamId: string, roundId: number): Promise<GradeSummary & {
  ungraded_before: number;
  still_open: number;
}> {
  const { count: before } = await db
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .eq('round_id', roundId)
    .in('status', ['draft', 'submitted', 'locked']);

  const summary = await gradeSubmissionsNow({ teamId, roundId });

  const { count: after } = await db
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .eq('round_id', roundId)
    .in('status', ['draft', 'submitted', 'locked']);

  return { ...summary, ungraded_before: before ?? 0, still_open: after ?? 0 };
}
