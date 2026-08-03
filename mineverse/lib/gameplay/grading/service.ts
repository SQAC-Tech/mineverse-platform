import { supabaseServer } from '@/lib/supabase/server';
import { mutateTeamResource } from '@/lib/gameplay/marketplace/resource-client';
import { checkDeterministicAnswer, hasDeterministicKey } from '@/lib/gameplay/grading/deterministic';
import { getActiveModifiers, applyModifiers } from '@/lib/gameplay/events/service';

const db = supabaseServer as any;

export interface GradingRunSummary {
  id: string;
  round_id: number;
  state: string;
  processed_count: number;
  total_count: number;
  manual_review_count: number;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

/**
 * Creates (or returns) the durable grading run for a round. A run is only allowed
 * once Phase 1 round control has taken the round out of `active`, so a team can no
 * longer revise an answer that is being graded.
 */
export async function createGradingRun(roundId: number, adminId: string) {
  const { data: round, error: roundError } = await db
    .from('rounds')
    .select('id, status')
    .eq('id', roundId)
    .single();

  if (roundError || !round) {
    return { ok: false as const, status: 404, code: 'ROUND_NOT_FOUND', message: 'Round not found.' };
  }

  if (round.status === 'active') {
    return {
      ok: false as const,
      status: 409,
      code: 'ROUND_NOT_LOCKED',
      message: 'Lock the round in round control before grading it.',
    };
  }

  const { data: existing, error: existingError } = await db
    .from('grading_runs')
    .select('*')
    .eq('round_id', roundId)
    .in('state', ['queued', 'running'])
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) {
    return { ok: true as const, data: { ...existing, resumed: true } };
  }

  const { count, error: countError } = await db
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('round_id', roundId)
    .in('status', ['submitted', 'locked']);

  if (countError) throw countError;

  const { data: run, error: runError } = await db
    .from('grading_runs')
    .insert({
      round_id: roundId,
      state: 'queued',
      initiated_by: adminId,
      total_count: count ?? 0,
    })
    .select()
    .single();

  if (runError) {
    if (runError.code === '23505') {
      return {
        ok: false as const,
        status: 409,
        code: 'RUN_ALREADY_ACTIVE',
        message: 'A grading run is already active for this round.',
      };
    }
    throw runError;
  }

  return { ok: true as const, data: { ...run, resumed: false } };
}

/**
 * Grades one batch and returns the updated run. Deterministic answers are scored
 * and paid immediately; anything without an answer key is parked in
 * `manual_review` for an admin decision rather than being scored as wrong.
 *
 * Each submission revision finalizes at most once — `grading_items` has a unique
 * (submission_id, revision), and the award is keyed on the resulting item id.
 */
export async function processGradingBatch(runId: string, adminId: string) {
  const { data: run, error: runError } = await db
    .from('grading_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (runError || !run) {
    return { ok: false as const, status: 404, code: 'RUN_NOT_FOUND', message: 'Grading run not found.' };
  }

  if (run.state === 'completed' || run.state === 'cancelled') {
    return { ok: true as const, data: { ...run, processed_in_batch: 0 } };
  }

  await db.from('grading_runs').update({
    state: 'running',
    started_at: run.started_at ?? new Date().toISOString(),
  }).eq('id', runId);

  const { data: submissions, error: submissionsError } = await db
    .from('submissions')
    .select('id, team_id, round_id, question_id, answer_text, code, revision, status')
    .eq('round_id', run.round_id)
    .in('status', ['submitted', 'locked'])
    .limit(run.batch_size ?? 25);

  if (submissionsError) throw submissionsError;

  const batch = submissions ?? [];
  if (batch.length === 0) {
    const { data: finished, error: finishError } = await db
      .from('grading_runs')
      .update({ state: 'completed', completed_at: new Date().toISOString() })
      .eq('id', runId)
      .select()
      .single();

    if (finishError) throw finishError;
    return { ok: true as const, data: { ...finished, processed_in_batch: 0 } };
  }

  const questionIds = [...new Set(batch.map((s: any) => s.question_id))];
  const { data: questions, error: questionsError } = await db
    .from('questions')
    .select('id, type, reward, expected_answer, auto_grade_strategy')
    .in('id', questionIds);

  if (questionsError) throw questionsError;

  const questionById = new Map((questions ?? []).map((q: any) => [q.id, q]));

  let processed = 0;
  let manualReview = 0;
  let failed = 0;

  for (const submission of batch) {
    const question = questionById.get(submission.question_id) as any;
    if (!question) continue;

    const submitted = submission.answer_text ?? submission.code ?? null;
    const deterministic = hasDeterministicKey(question.expected_answer);

    try {
      if (!deterministic) {
        // No answer key: park for an admin decision. Never auto-score as wrong.
        const { error: itemError } = await db.from('grading_items').upsert(
          {
            run_id: runId,
            submission_id: submission.id,
            revision: submission.revision,
            path: 'rubric',
            state: 'manual_review',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'submission_id,revision', ignoreDuplicates: true },
        );
        if (itemError) throw itemError;

        await db.from('submissions').update({ status: 'manual_review' }).eq('id', submission.id);
        manualReview += 1;
        processed += 1;
        continue;
      }

      const isCorrect = checkDeterministicAnswer(submitted, question.expected_answer) === true;

      // Claim this revision first. A duplicate claim means another run already
      // finalized it, so the award is skipped rather than paid twice.
      const { data: item, error: itemError } = await db
        .from('grading_items')
        .insert({
          run_id: runId,
          submission_id: submission.id,
          revision: submission.revision,
          path: 'deterministic',
          state: 'running',
        })
        .select()
        .single();

      if (itemError) {
        if (itemError.code === '23505') {
          processed += 1;
          continue;
        }
        throw itemError;
      }

      let ledgerId: string | null = null;
      const reward = (question.reward ?? {}) as Record<string, number>;

      if (isCorrect && Object.keys(reward).length > 0) {
        const modifiers = await getActiveModifiers(submission.team_id);
        const finalReward = applyModifiers(reward, modifiers);

        const res = await mutateTeamResource({
          teamId: submission.team_id,
          delta: finalReward,
          sourceType: 'question_grade',
          sourceId: submission.id,
          // Keyed on the grading item, so a retry of the same finalization is inert.
          idempotencyKey: item.id,
          reason: `Graded ${question.type} question`,
        });

        if (!res.success && res.error !== 'CONFLICT') {
          throw new Error(res.message ?? 'resource mutation failed');
        }
        ledgerId = res.ledgerId ?? null;
      }

      const score = isCorrect ? 1 : 0;

      await db
        .from('grading_items')
        .update({
          state: 'completed',
          final_score: score,
          ledger_id: ledgerId,
          validated_result: { correct: isCorrect },
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      await db
        .from('submissions')
        .update({
          status: 'graded',
          final_score: score,
          graded_by: adminId,
          graded_revision: submission.revision,
          final_award_ledger_id: ledgerId,
          locked_at: new Date().toISOString(),
        })
        .eq('id', submission.id);

      processed += 1;
    } catch (error) {
      failed += 1;
      await db
        .from('grading_items')
        .update({ state: 'failed', error: String(error), updated_at: new Date().toISOString() })
        .eq('submission_id', submission.id)
        .eq('revision', submission.revision);
    }
  }

  const { data: updated, error: updateError } = await db
    .from('grading_runs')
    .update({
      processed_count: (run.processed_count ?? 0) + processed,
      manual_review_count: (run.manual_review_count ?? 0) + manualReview,
      state: 'running',
    })
    .eq('id', runId)
    .select()
    .single();

  if (updateError) throw updateError;

  return {
    ok: true as const,
    data: { ...updated, processed_in_batch: processed, manual_review_in_batch: manualReview, failed_in_batch: failed },
  };
}

export async function getGradingRun(runId: string) {
  const { data: run, error } = await db.from('grading_runs').select('*').eq('id', runId).single();
  if (error || !run) {
    return { ok: false as const, status: 404, code: 'RUN_NOT_FOUND', message: 'Grading run not found.' };
  }

  const { data: items, error: itemsError } = await db
    .from('grading_items')
    .select('state')
    .eq('run_id', runId);

  if (itemsError) throw itemsError;

  const byState: Record<string, number> = {};
  for (const item of items ?? []) byState[item.state] = (byState[item.state] ?? 0) + 1;

  return { ok: true as const, data: { ...run, items_by_state: byState } };
}

export async function listManualReview(roundId?: number) {
  let query = db
    .from('submissions')
    .select('id, team_id, round_id, question_id, answer_text, code, revision, status, submitted_at')
    .eq('status', 'manual_review')
    .order('submitted_at', { ascending: true })
    .limit(200);

  if (roundId) query = query.eq('round_id', roundId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Audited grader override. Writes only the difference between the existing final
 * score's award and the replacement, so re-grading never double-pays.
 */
export async function applyGradingOverride(params: {
  submissionId: string;
  score: number;
  reason: string;
  adminId: string;
}) {
  if (!params.reason.trim()) {
    return { ok: false as const, status: 400, code: 'REASON_REQUIRED', message: 'A reason is required.' };
  }

  const { data: submission, error } = await db
    .from('submissions')
    .select('id, team_id, question_id, revision, final_score, final_award_ledger_id')
    .eq('id', params.submissionId)
    .single();

  if (error || !submission) {
    return { ok: false as const, status: 404, code: 'SUBMISSION_NOT_FOUND', message: 'Submission not found.' };
  }

  const { data: question, error: questionError } = await db
    .from('questions')
    .select('reward, type')
    .eq('id', submission.question_id)
    .single();

  if (questionError) throw questionError;

  const reward = (question?.reward ?? {}) as Record<string, number>;
  const previousScore = Number(submission.final_score ?? 0);
  const scoreDelta = params.score - previousScore;

  let ledgerId: string | null = null;

  if (scoreDelta !== 0 && Object.keys(reward).length > 0) {
    // Pay only the difference against what this submission already earned.
    const delta: Record<string, number> = {};
    for (const [key, value] of Object.entries(reward)) {
      delta[key] = Math.round(value * scoreDelta);
    }

    const res = await mutateTeamResource({
      teamId: submission.team_id,
      delta,
      sourceType: 'grading_override',
      sourceId: submission.id,
      idempotencyKey: crypto.randomUUID(),
      reason: params.reason.trim(),
    });

    if (!res.success) {
      return {
        ok: false as const,
        status: res.error === 'INSUFFICIENT_FUNDS' ? 422 : 409,
        code: res.error ?? 'CONFLICT',
        message: res.message ?? 'Override could not be applied.',
      };
    }
    ledgerId = res.ledgerId ?? null;
  }

  const { data: updated, error: updateError } = await db
    .from('submissions')
    .update({
      status: 'graded',
      final_score: params.score,
      graded_by: params.adminId,
      graded_revision: submission.revision,
      feedback: params.reason.trim(),
      ...(ledgerId ? { final_award_ledger_id: ledgerId } : {}),
    })
    .eq('id', submission.id)
    .select('id, final_score, status, graded_revision')
    .single();

  if (updateError) throw updateError;

  return { ok: true as const, data: { ...updated, ledger_id: ledgerId, score_delta: scoreDelta } };
}
