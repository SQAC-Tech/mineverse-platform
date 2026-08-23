import { NextResponse } from 'next/server';
import { consumeRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';
import { normalizeOutput } from '@/lib/gameplay/code/compare';
import { executeCode, CodeRunnerError } from '@/lib/gameplay/code/runner';
import { contractOf, wrapForExecution, type LanguageId } from '@/lib/gameplay/code/contract';
import { resolveRuntime, runtimesFor } from '@/lib/gameplay/code/runtimes';
import { upsertTeamSubmission } from '@/lib/gameplay/questions/service';

export const dynamic = 'force-dynamic';

const payloadSchema = z.object({
  question_id: z.string().uuid(),
  code: z.string().trim().min(1).max(64_000),
  language: z.string().trim().min(1).max(64),
});

type TestCase = { stdin?: unknown; stdout?: unknown };

/** Public aggregate only. Neither hidden input nor expected output leaves here. */
type EvaluationSummary = {
  kind: 'coding_evaluation';
  status: 'completed' | 'runner_error';
  sample_passed: number;
  sample_total: number;
  hidden_passed: number;
  hidden_total: number;
  total_passed: number;
  total_cases: number;
  evaluated_at: string;
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  let body: z.infer<typeof payloadSchema>;
  try {
    const parsed = payloadSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: { code: 'INVALID_PAYLOAD' } }, { status: 400 });
    body = parsed.data;
  } catch {
    return NextResponse.json({ success: false, error: { code: 'INVALID_PAYLOAD' } }, { status: 400 });
  }

  /**
   * One submission every two minutes, per team.
   *
   * A submission is not one execution but one per test case, so it is the
   * expensive action on a judge the whole hall shares. Two minutes is also long
   * enough that a team reads its result instead of resubmitting blind.
   */
  const submitBudget = consumeRateLimit(`code-submit:${session.team_id}`, 1, 120_000);
  if (!submitBudget.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: `You can submit once every two minutes. Try again in ${submitBudget.retryAfterSeconds}s.`,
        },
        retry_after: submitBudget.retryAfterSeconds,
      },
      { status: 429, headers: { 'Retry-After': String(submitBudget.retryAfterSeconds) } },
    );
  }

  // Rejecting this before the generic upsert prevents a crafted request from
  // creating a code-shaped submission against a non-coding question.
  const { data: typeCheck } = await supabaseServer.from('questions').select('type').eq('id', body.question_id).maybeSingle();
  if (!typeCheck || typeCheck.type !== 'coding') {
    return NextResponse.json({ success: false, error: { code: 'CODING_QUESTION_REQUIRED' } }, { status: 400 });
  }

  // Upsert is the authorization boundary: it checks round availability and the
  // per-team selected variant before any hidden case is read.
  const saved = await upsertTeamSubmission(session.team_id, {
    question_id: body.question_id,
    code: body.code,
    language: body.language,
    response: {},
  });
  if (!saved.ok) {
    return NextResponse.json({ success: false, error: { code: saved.code, message: saved.message } }, { status: saved.status });
  }

  const { data: question, error } = await supabaseServer
    .from('questions')
    .select('type, language_options, runtime_meta, sample_test_cases, hidden_test_cases')
    .eq('id', body.question_id)
    .single();
  if (error || !question || question.type !== 'coding') {
    return NextResponse.json({ success: false, error: { code: 'CODING_QUESTION_REQUIRED' } }, { status: 400 });
  }

  const runtime = resolveRuntime(body.language);
  if (!runtime || !runtimesFor(question.language_options).some((entry) => entry.id === runtime.id)) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_LANGUAGE' } }, { status: 400 });
  }

  const samples = Array.isArray(question.sample_test_cases) ? question.sample_test_cases as TestCase[] : [];
  const hidden = Array.isArray(question.hidden_test_cases) ? question.hidden_test_cases as TestCase[] : [];
  /**
   * The team's function inside the platform's wrapper.
   *
   * `body.code` is what gets stored as their answer — only this wrapped form is
   * ever executed. A question without a contract is a whole program already.
   */
  const contract = contractOf(question.runtime_meta);
  const executable = contract && runtime ? wrapForExecution(contract, runtime.id as LanguageId, body.code) : body.code;

  const version = (question.runtime_meta as { piston_version?: string } | null)?.piston_version ?? '*';
  const countPassed = async (cases: TestCase[]) => {
    let passed = 0;
    for (const testCase of cases) {
      const result = await executeCode({ code: executable, stdin: String(testCase.stdin ?? ''), runtime, pistonVersion: version });
      if (!result.compile.code && result.run.code === 0 && normalizeOutput(result.run.stdout) === normalizeOutput(String(testCase.stdout ?? ''))) passed += 1;
    }
    return passed;
  };

  let summary: EvaluationSummary;
  try {
    const [samplePassed, hiddenPassed] = await Promise.all([countPassed(samples), countPassed(hidden)]);
    summary = {
      kind: 'coding_evaluation', status: 'completed',
      sample_passed: samplePassed, sample_total: samples.length,
      hidden_passed: hiddenPassed, hidden_total: hidden.length,
      total_passed: samplePassed + hiddenPassed, total_cases: samples.length + hidden.length,
      evaluated_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error('Coding submission evaluation failed:', err);
    summary = {
      kind: 'coding_evaluation', status: 'runner_error',
      sample_passed: 0, sample_total: samples.length, hidden_passed: 0, hidden_total: hidden.length,
      total_passed: 0, total_cases: samples.length + hidden.length, evaluated_at: new Date().toISOString(),
    };
    await supabaseServer.from('submissions').update({ response: summary, updated_at: summary.evaluated_at })
      .eq('id', saved.data.submission_id).eq('revision', saved.data.revision);
    const message = err instanceof CodeRunnerError ? err.message : 'Could not reach the runner.';
    return NextResponse.json({ success: false, error: { code: 'RUNNER_ERROR', message }, data: summary }, { status: 503 });
  }

  const { error: persistError } = await supabaseServer.from('submissions')
    .update({ response: summary, updated_at: summary.evaluated_at })
    .eq('id', saved.data.submission_id)
    .eq('revision', saved.data.revision);
  if (persistError) {
    console.error('Could not persist coding evaluation:', persistError);
    return NextResponse.json({ success: false, error: { code: 'PERSIST_FAILED', message: 'Your code was saved, but its result could not be saved.' } }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: { ...saved.data, evaluation: summary } });
}
