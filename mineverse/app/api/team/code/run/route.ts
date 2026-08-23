import { NextResponse } from 'next/server';
import { contractOf, wrapForExecution, type LanguageId } from '@/lib/gameplay/code/contract';
import { getSession } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';
import { consumeRateLimit, retryHint, tooManyRequests } from '@/lib/rate-limit';
import { resolveRuntime, runtimesFor } from '@/lib/gameplay/code/runtimes';
import { normalizeOutput } from '@/lib/gameplay/code/compare';

export const dynamic = 'force-dynamic';

/** What Piston hands back. Every field is optional — a run that never started
 *  has no `run`, and an interpreted language has no `compile`. */
interface PistonResponse {
  compile?: { stdout?: string; stderr?: string; code?: number | null };
  run?: { stdout?: string; stderr?: string; code?: number | null; signal?: string | null };
}

/** Separates "Piston refused" from "we could not reach Piston". */
class PistonError extends Error {
  constructor(readonly status: number) {
    super(`piston ${status}`);
  }
}

/** Piston's own ceilings are separate; these stop us shipping junk to it. */
const MAX_CODE = 64_000;
const MAX_STDIN = 8_000;

/**
 * Run a team's code against input the team typed, and hand back what it printed.
 *
 * This is not grading. It never touches `hidden_test_cases`, never reports a
 * verdict and never records anything — a team gets a compiler and a scratchpad,
 * which is what the "Run" button on any judge actually is. Marking still happens
 * in lib/grading, against cases this endpoint cannot see.
 *
 * The language is checked against the question's own `language_options` rather
 * than a global list, so Run can never execute something the submission would be
 * rejected for.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  /**
   * Three runs a minute, per team.
   *
   * Every run is a real execution on a judge the whole hall shares, and the
   * judge limits us by address — so one team hammering Run spends everyone's
   * budget and the rest see "the runner is busy" for code that never ran.
   *
   * Keyed on the team, never the IP: the venue is behind one campus NAT, so an
   * address budget here would be a single queue for every team at once.
   */
  const limit = consumeRateLimit(`code-run:${session.team_id}`, 3, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: `You can run three times a minute. Try again in ${retryHint(limit.retryAfterSeconds)}.`,
        retry_after: limit.retryAfterSeconds,
      },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const endpoint = process.env.PISTON_API_URL;
  if (!endpoint) {
    return NextResponse.json(
      { success: false, error: 'Running code is not configured for this event.' },
      { status: 503 },
    );
  }

  let body: { question_id?: string; language?: string; code?: string; stdin?: string; sample_index?: number; mode?: 'samples' | 'custom' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Malformed request' }, { status: 400 });
  }

  const code = String(body.code ?? '');
  const stdin = String(body.stdin ?? '');
  if (!code.trim()) return NextResponse.json({ success: false, error: 'Write some code first.' }, { status: 400 });
  if (code.length > MAX_CODE) return NextResponse.json({ success: false, error: 'That program is too long to run.' }, { status: 413 });
  if (stdin.length > MAX_STDIN) return NextResponse.json({ success: false, error: 'That input is too long.' }, { status: 413 });

  // The question decides which languages exist. Selecting only
  // `language_options` keeps the hidden cases and the answer key out of reach.
  const { data: question, error } = await supabaseServer
    .from('questions')
    // `sample_test_cases` is the visible half. `hidden_test_cases` is not
    // selected here and must never be: this endpoint answers to the team.
    .select('id, language_options, runtime_meta, sample_test_cases')
    .eq('id', String(body.question_id ?? ''))
    .maybeSingle();

  if (error) console.error('Code run: question lookup failed:', error);
  if (!question) return NextResponse.json({ success: false, error: 'Question not found' }, { status: 404 });

  const allowed = runtimesFor(question.language_options);
  const runtime = resolveRuntime(body.language);
  if (!runtime || !allowed.some((entry) => entry.id === runtime.id)) {
    return NextResponse.json({ success: false, error: 'That language is not available for this question.' }, { status: 400 });
  }

  const apiKey = process.env.PISTON_API_KEY;
  const version = (question.runtime_meta as { piston_version?: string } | null)?.piston_version ?? '*';

  /**
   * What actually runs is the team's function inside the platform's wrapper.
   *
   * The team writes only the solution; the wrapper reads stdin, calls it and
   * prints the result. A question with no contract is still a whole program, so
   * it runs exactly as written.
   */
  const contract = contractOf(question.runtime_meta);
  const executable = contract ? wrapForExecution(contract, runtime.id as LanguageId, code) : code;

  const execute = async (input: string) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The emkc instance takes the token raw — with a `Bearer ` prefix it 401s.
        ...(apiKey ? { Authorization: apiKey } : {}),
      },
      body: JSON.stringify({
        language: runtime.piston,
        version,
        files: [{ name: runtime.file, content: executable }],
        stdin: input,
        compile_timeout: 10_000,
        run_timeout: 5_000,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new PistonError(response.status);
    return (await response.json()) as PistonResponse;
  };

  const shape = (payload: PistonResponse) => ({
    compile: {
      stdout: payload?.compile?.stdout ?? '',
      stderr: payload?.compile?.stderr ?? '',
      code: payload?.compile?.code ?? null,
    },
    run: {
      stdout: payload?.run?.stdout ?? '',
      stderr: payload?.run?.stderr ?? '',
      code: payload?.run?.code ?? null,
      signal: payload?.run?.signal ?? null,
    },
  });

  try {
    // Custom input is one run and no verdict — a scratchpad.
    if (body.mode === 'custom') {
      return NextResponse.json({ success: true, mode: 'custom', language: runtime.id, ...shape(await execute(stdin)) });
    }

    const samples = Array.isArray(question.sample_test_cases) ? question.sample_test_cases : [];
    if (samples.length === 0) {
      return NextResponse.json(
        { success: false, error: 'This question has no sample cases yet. Use custom input instead.' },
        { status: 409 },
      );
    }

    // One run per case. Feeding every input to a single run would let a program
    // that reads a fixed number of lines pass cases it never actually read.
    const requestedIndex = Number.isInteger(body.sample_index) ? Number(body.sample_index) : null;
    if (requestedIndex !== null && (requestedIndex < 0 || requestedIndex >= samples.length)) {
      return NextResponse.json({ success: false, error: 'That sample case does not exist.' }, { status: 400 });
    }
    const selectedSamples = requestedIndex === null ? [...samples.entries()] : [[requestedIndex, samples[requestedIndex]] as const];
    const results = [];
    for (const [index, sample] of selectedSamples) {
      const entry = sample as { stdin?: string; stdout?: string };
      const shaped = shape(await execute(String(entry.stdin ?? '')));
      const expected = String(entry.stdout ?? '');
      const compileFailed = Boolean(shaped.compile.code);

      results.push({
        index,
        stdin: String(entry.stdin ?? ''),
        expected,
        actual: shaped.run.stdout,
        passed: !compileFailed && normalizeOutput(shaped.run.stdout) === normalizeOutput(expected),
        stderr: shaped.run.stderr,
        compile: shaped.compile,
        exit_code: shaped.run.code,
      });

      // Code that does not compile fails every case identically; stop rather
      // than spending four more runs to learn the same thing.
      if (compileFailed) break;
    }

    return NextResponse.json({
      success: true,
      mode: 'samples',
      language: runtime.id,
      results,
      passed: results.length === samples.length && results.every((entry) => entry.passed),
    });
  } catch (err) {
    if (err instanceof PistonError) {
      // A quota or transport failure is ours, not the team's, so it does not get
      // printed into their console as a status code.
      console.error('Code run: piston returned', err.status);
      return NextResponse.json({ success: false, error: 'The runner is busy. Try again in a moment.' }, { status: 502 });
    }
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    console.error('Code run failed:', err);
    return NextResponse.json(
      { success: false, error: timedOut ? 'The run took too long and was stopped.' : 'Could not reach the runner.' },
      { status: 504 },
    );
  }
}
