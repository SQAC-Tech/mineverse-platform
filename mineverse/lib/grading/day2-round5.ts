import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { checkDeterministicAnswer, hasDeterministicKey } from '@/lib/gameplay/grading/deterministic';
// The same comparison the editor shows a team. Sharing it is the only way to
// guarantee a sample that passes in the editor passes when it is marked.
import { normalizeOutput } from '@/lib/gameplay/code/compare';
// The same catalog the editor offers. A language a team could select but the
// grader did not know would fail a correct submission after the round, with
// nothing on screen to explain it.
import { resolveRuntime } from '@/lib/gameplay/code/runtimes';
import { getActiveChorusBonus } from '@/lib/day2/events/service';
import type { Day2ResourceDelta } from '@/lib/day2/events/resources';

const db = supabaseServer as any;

const groqResultSchema = z.object({
  correct: z.boolean(),
  score: z.number().min(0).max(1),
  feedback: z.string().max(2000).optional(),
});

function mergeDelta(base: Day2ResourceDelta, extra: Day2ResourceDelta | null) {
  const merged: Day2ResourceDelta = { ...base };
  if (!extra) return merged;
  for (const [key, value] of Object.entries(extra)) {
    merged[key as keyof Day2ResourceDelta] = (merged[key as keyof Day2ResourceDelta] ?? 0) + Number(value ?? 0);
  }
  return merged;
}

async function mutateResources(params: {
  teamId: string;
  delta: Day2ResourceDelta;
  sourceType: string;
  sourceId: string;
  idempotencyKey: string;
  reason: string;
  adminId: string;
}) {
  const { data, error } = await db.rpc('mutate_team_resources', {
    p_team_id: params.teamId,
    p_delta: params.delta,
    p_source_type: params.sourceType,
    p_source_id: params.sourceId,
    p_idempotency_key: params.idempotencyKey,
    p_reason: params.reason,
    p_actor_type: 'admin',
    p_actor_id: params.adminId,
  });

  if (error) throw error;
  return data as { ledger_id?: string; balance?: Record<string, number>; idempotent?: boolean };
}

async function parkManualReview(params: {
  runId: string;
  submission: any;
  path: 'deterministic' | 'rubric';
  error: string;
  providerMetadata?: Record<string, unknown>;
}) {
  const { error: itemError } = await db.from('grading_items').upsert(
    {
      run_id: params.runId,
      submission_id: params.submission.id,
      revision: params.submission.revision,
      path: params.path,
      state: 'manual_review',
      error: params.error,
      provider_metadata: params.providerMetadata ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'submission_id,revision', ignoreDuplicates: true },
  );
  if (itemError) throw itemError;

  await db.from('submissions').update({ status: 'manual_review' }).eq('id', params.submission.id);
}

async function gradeWithPiston(submission: any, question: any) {
  const endpoint = process.env.PISTON_API_URL;
  if (!endpoint) return { ok: false as const, error: 'PISTON_UNCONFIGURED' };
  if (!submission.code || !submission.language) return { ok: false as const, error: 'CODE_OR_LANGUAGE_MISSING' };

  const runtime = resolveRuntime(submission.language);
  if (!runtime) return { ok: false as const, error: `PISTON_LANGUAGE_UNSUPPORTED: ${submission.language}` };

  const cases = Array.isArray(question.hidden_test_cases) ? question.hidden_test_cases : [];
  if (cases.length === 0) return { ok: false as const, error: 'TEST_CASES_MISSING' };

  const apiKey = process.env.PISTON_API_KEY;

  // One run per test case. Joining every stdin into a single run let a program
  // that reads a fixed number of lines look correct for the cases it never read.
  for (const [index, testCase] of cases.entries()) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // The emkc instance went whitelist-only in Feb 2026 and takes the token
          // raw, with no `Bearer ` prefix — with the prefix it answers 401.
          ...(apiKey ? { Authorization: apiKey } : {}),
        },
        body: JSON.stringify({
          language: runtime.piston,
          version: question.runtime_meta?.piston_version ?? '*',
          files: [{ name: runtime.file, content: submission.code }],
          stdin: (testCase as any).stdin ?? '',
          compile_timeout: 10_000,
          run_timeout: 5_000,
        }),
      });

      // A transport or quota failure is not a wrong answer — it goes to manual review.
      if (!response.ok) return { ok: false as const, error: `PISTON_${response.status}` };
      const payload = await response.json();

      // Code that does not compile or crashes IS a wrong answer, not a provider fault.
      if (payload?.compile?.code) {
        return {
          ok: true as const,
          correct: false,
          providerMetadata: { provider: 'piston', failed_case: index, reason: 'compile_error' },
        };
      }

      if (normalizeOutput(payload?.run?.stdout) !== normalizeOutput((testCase as any).stdout)) {
        return {
          ok: true as const,
          correct: false,
          providerMetadata: { provider: 'piston', failed_case: index, exit_code: payload?.run?.code ?? null },
        };
      }
    } catch (error) {
      return { ok: false as const, error: `PISTON_FAILURE: ${String(error)}` };
    }
  }

  return { ok: true as const, correct: true, providerMetadata: { provider: 'piston', cases: cases.length } };
}

async function gradeWithGroq(submission: any, question: any) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { ok: false as const, error: 'GROQ_UNCONFIGURED' };

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
        // Two graders running the same answer must not disagree.
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: 'Grade this MINEVERSE Round 5 answer. Return JSON: {"correct":boolean,"score":0..1,"feedback":"short"}.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              prompt: question.prompt,
              rubric: question.rubric,
              answer: submission.answer_text ?? submission.code ?? '',
            }),
          },
        ],
      }),
    });

    if (!response.ok) return { ok: false as const, error: `GROQ_${response.status}` };
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    const parsed = groqResultSchema.safeParse(JSON.parse(content));
    if (!parsed.success) return { ok: false as const, error: 'GROQ_SCHEMA_INVALID' };
    return { ok: true as const, result: parsed.data, providerMetadata: { provider: 'groq', model: payload?.model } };
  } catch (error) {
    return { ok: false as const, error: `GROQ_FAILURE: ${String(error)}` };
  }
}

export async function createDay2Round5GradingRun(adminId: string, roundId = 5) {
  const { data: round, error: roundError } = await db
    .from('rounds')
    .select('id, status')
    .eq('id', roundId)
    .maybeSingle();

  if (roundError) throw roundError;
  if (!round) return { ok: false as const, status: 404, code: 'ROUND_NOT_FOUND', message: 'Round 5 is not configured.' };
  if (round.status === 'active') {
    return {
      ok: false as const,
      status: 409,
      code: 'ROUND_NOT_LOCKED',
      message: 'Lock Round 5 in admin round control before grading.',
    };
  }

  const { data: existing, error: existingError } = await db
    .from('grading_runs')
    .select('*')
    .eq('round_id', roundId)
    .in('state', ['queued', 'running'])
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return { ok: true as const, data: { ...existing, resumed: true } };

  const { count, error: countError } = await db
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('round_id', roundId)
    .in('status', ['submitted', 'locked']);

  if (countError) throw countError;

  const { data, error } = await db
    .from('grading_runs')
    .insert({
      round_id: roundId,
      state: 'queued',
      initiated_by: adminId,
      total_count: count ?? 0,
      provider: 'piston/groq/manual',
    })
    .select()
    .single();

  if (error) throw error;
  return { ok: true as const, data: { ...data, resumed: false } };
}

export async function processDay2Round5Batch(runId: string, adminId: string) {
  const { data: run, error: runError } = await db.from('grading_runs').select('*').eq('id', runId).single();
  if (runError || !run) {
    return { ok: false as const, status: 404, code: 'RUN_NOT_FOUND', message: 'Grading run not found.' };
  }

  if (run.state === 'completed' || run.state === 'cancelled') {
    return { ok: true as const, data: { ...run, processed_in_batch: 0 } };
  }

  await db
    .from('grading_runs')
    .update({ state: 'running', started_at: run.started_at ?? new Date().toISOString() })
    .eq('id', runId);

  const { data: submissions, error: submissionsError } = await db
    .from('submissions')
    .select('id, team_id, round_id, question_id, answer_text, code, language, revision, status, submitted_at')
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

  const { data: questions, error: questionsError } = await db
    .from('questions')
    .select('id, type, prompt, reward, expected_answer, hidden_test_cases, rubric, runtime_meta')
    .in('id', [...new Set(batch.map((submission: any) => submission.question_id))]);
  if (questionsError) throw questionsError;

  const questionsById = new Map((questions ?? []).map((question: any) => [question.id, question]));
  let processed = 0;
  let manualReview = 0;
  let failed = 0;

  for (const submission of batch) {
    const question = questionsById.get(submission.question_id) as any;
    if (!question) continue;

    try {
      let correct: boolean | null = null;
      let score = 0;
      let path: 'deterministic' | 'rubric' = 'deterministic';
      let providerMetadata: Record<string, unknown> | null = null;
      let manualError: string | null = null;
      // Only the rubric path produces a partial score; every other path is 0 or 1.
      let rubricScored = false;

      if (question.type === 'coding') {
        const piston = await gradeWithPiston(submission, question);
        if (piston.ok) {
          correct = piston.correct;
          providerMetadata = piston.providerMetadata;
        } else {
          manualError = piston.error;
        }
      } else if (hasDeterministicKey(question.expected_answer)) {
        // A seeded answer key wins over the language model. The logic puzzles ask
        // for a single number, and sending "15" to an LLM to be told it is 15 only
        // adds a way for it to be wrong.
        correct = checkDeterministicAnswer(submission.answer_text ?? submission.code, question.expected_answer);
      } else if (question.type === 'logic_puzzle' || question.rubric) {
        path = 'rubric';
        const groq = await gradeWithGroq(submission, question);
        if (groq.ok) {
          correct = groq.result.correct;
          score = groq.result.score;
          rubricScored = true;
          providerMetadata = groq.providerMetadata;
        } else {
          manualError = groq.error;
        }
      } else {
        path = 'rubric';
        manualError = 'NO_DETERMINISTIC_KEY';
      }

      if (manualError || correct === null) {
        await parkManualReview({
          runId,
          submission,
          path,
          error: manualError ?? 'UNSCORABLE',
          providerMetadata: providerMetadata ?? { state: 'manual_review' },
        });
        processed += 1;
        manualReview += 1;
        continue;
      }

      if (!rubricScored) score = correct ? 1 : 0;

      const { data: item, error: itemError } = await db
        .from('grading_items')
        .insert({
          run_id: runId,
          submission_id: submission.id,
          revision: submission.revision,
          path,
          state: 'running',
          provider_metadata: providerMetadata,
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
      let chorusEventId: string | null = null;
      let finalReward = correct ? ((question.reward ?? {}) as Day2ResourceDelta) : {};

      if (correct && question.type === 'coding') {
        const chorus = await getActiveChorusBonus(submission.team_id, submission.submitted_at);
        if (chorus) {
          finalReward = mergeDelta(finalReward, chorus.bonus);
          chorusEventId = chorus.eventId;
        }
      }

      if (correct && Object.keys(finalReward).length > 0) {
        const mutation = await mutateResources({
          teamId: submission.team_id,
          delta: finalReward,
          sourceType: 'day2_round5_grade',
          sourceId: submission.id,
          idempotencyKey: item.id,
          reason: chorusEventId ? 'Round 5 grade with Chorus Fruit Blessing bonus' : 'Round 5 grade award',
          adminId,
        });
        ledgerId = mutation.ledger_id ?? null;
      }

      await db
        .from('grading_items')
        .update({
          state: 'completed',
          final_score: score,
          ledger_id: ledgerId,
          validated_result: { correct, score, award: finalReward, chorus_event_id: chorusEventId },
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
      await parkManualReview({
        runId,
        submission,
        path: 'rubric',
        error: String(error),
        providerMetadata: { state: 'provider_failure' },
      });
      manualReview += 1;
      processed += 1;
    }
  }

  const { data: updated, error: updateError } = await db
    .from('grading_runs')
    .update({
      processed_count: (run.processed_count ?? 0) + processed,
      manual_review_count: (run.manual_review_count ?? 0) + manualReview,
      state: 'running',
      error: failed > 0 ? `${failed} submissions moved to manual review after provider failure.` : run.error,
    })
    .eq('id', runId)
    .select()
    .single();
  if (updateError) throw updateError;

  return { ok: true as const, data: { ...updated, processed_in_batch: processed, manual_review_in_batch: manualReview } };
}

export async function getDay2Round5Run(runId: string) {
  const { data: run, error } = await db.from('grading_runs').select('*').eq('id', runId).single();
  if (error || !run) return { ok: false as const, status: 404, code: 'RUN_NOT_FOUND', message: 'Run not found.' };

  const { data: items, error: itemError } = await db.from('grading_items').select('state').eq('run_id', runId);
  if (itemError) throw itemError;

  const itemsByState: Record<string, number> = {};
  for (const item of items ?? []) itemsByState[item.state] = (itemsByState[item.state] ?? 0) + 1;

  return { ok: true as const, data: { ...run, items_by_state: itemsByState } };
}

export async function listDay2ManualReview() {
  const { data, error } = await db
    .from('submissions')
    .select('id, team_id, round_id, question_id, answer_text, code, revision, status, submitted_at')
    .eq('round_id', 5)
    .eq('status', 'manual_review')
    .order('submitted_at', { ascending: true })
    .limit(200);

  if (error) throw error;
  return data ?? [];
}

