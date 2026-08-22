/**
 * Instant auto-grading for deterministic questions (Rounds 1–3).
 *
 * When a player submits an answer for a question that has a known expected_answer
 * and belongs to a round in INSTANT_GRADE_ROUNDS, this module checks the answer
 * immediately and — if correct — awards the resource reward right away without
 * requiring an admin-triggered batch grading run.
 *
 * Round 5 (coding / Piston) is intentionally excluded and continues to use the
 * batch grading flow, since Piston execution is async and may take several seconds.
 */

import { supabaseServer } from '@/lib/supabase/server';
import { checkDeterministicAnswer, hasDeterministicKey } from './deterministic';
import { mutateTeamResource } from '@/lib/gameplay/marketplace/resource-client';
import type { ResourceDelta } from '@/lib/gameplay/marketplace/resource-client';

const db = supabaseServer as any;

/** Rounds that get graded immediately on submission. */
export const INSTANT_GRADE_ROUNDS = new Set([1, 2, 3]);

export interface InstantGradeResult {
  graded: true;
  correct: boolean;
  reward: ResourceDelta;
  ledgerId?: string;
}

/**
 * Attempts to instantly grade a submission.
 *
 * Returns null when instant grading does not apply (wrong round, coding question,
 * no deterministic key, submission already graded/locked, etc.).
 *
 * Idempotency is guaranteed by using the submission's `id` as the idempotency key
 * for the resource mutation, so re-submitting the same answer cannot pay twice.
 */
export async function tryInstantGrade(params: {
  teamId: string;
  submissionId: string;
  submissionRevision: number;
  questionId: string;
  roundId: number;
  answerText: string | null | undefined;
}): Promise<InstantGradeResult | null> {
  const { teamId, submissionId, submissionRevision, questionId, roundId, answerText } = params;

  if (!INSTANT_GRADE_ROUNDS.has(roundId)) return null;

  // Fetch the full question row (including the secret expected_answer and reward).
  const { data: question, error: questionError } = await db
    .from('questions')
    .select('id, round_id, type, expected_answer, reward')
    .eq('id', questionId)
    .single();

  if (questionError || !question) return null;

  // Coding questions need Piston — skip.
  if (question.type === 'coding' || question.type === 'code_completion') return null;

  // No deterministic key — needs manual / LLM grading.
  if (!hasDeterministicKey(question.expected_answer)) return null;

  const correct = checkDeterministicAnswer(answerText, question.expected_answer) === true;
  const reward: ResourceDelta = correct ? ((question.reward ?? {}) as ResourceDelta) : {};
  const hasReward = correct && Object.keys(reward).length > 0;

  // Mark the submission as graded immediately.
  const gradedAt = new Date().toISOString();
  await db
    .from('submissions')
    .update({
      status: 'graded',
      final_score: correct ? 1 : 0,
      graded_by: 'instant',
      graded_revision: submissionRevision,
      locked_at: gradedAt,
      updated_at: gradedAt,
    })
    .eq('id', submissionId);

  let ledgerId: string | undefined;

  if (hasReward) {
    // Use `submission:<id>` as idempotency key so a duplicate POST cannot pay twice.
    const mutation = await mutateTeamResource({
      teamId,
      delta: reward,
      sourceType: 'question_grade',
      sourceId: submissionId,
      idempotencyKey: `submission:${submissionId}:rev:${submissionRevision}`,
      reason: `Instant grade – round ${roundId} question correct`,
    });

    if (mutation.success) {
      ledgerId = mutation.ledgerId;
      // Link the ledger entry back onto the submission for audit purposes.
      await db
        .from('submissions')
        .update({ final_award_ledger_id: ledgerId })
        .eq('id', submissionId);
    }
  }

  return { graded: true, correct, reward, ledgerId };
}
