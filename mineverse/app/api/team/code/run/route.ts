import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';
import { consumeRateLimit, retryHint, tooManyRequests } from '@/lib/rate-limit';
import { resolveRuntime, runtimesFor } from '@/lib/gameplay/code/runtimes';

export const dynamic = 'force-dynamic';

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

  // Keyed on the team, never the IP: the whole hall shares one campus NAT
  // address, so an IP budget here would be one queue for every team at once.
  const limit = consumeRateLimit(`code-run:${session.team_id}`, 30, 60_000);
  if (!limit.allowed) {
    return tooManyRequests(
      `Too many runs. Try again in ${retryHint(limit.retryAfterSeconds)}.`,
      limit.retryAfterSeconds,
    );
  }

  const endpoint = process.env.PISTON_API_URL;
  if (!endpoint) {
    return NextResponse.json(
      { success: false, error: 'Running code is not configured for this event.' },
      { status: 503 },
    );
  }

  let body: { question_id?: string; language?: string; code?: string; stdin?: string };
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
    .select('id, language_options, runtime_meta')
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

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The emkc instance takes the token raw — with a `Bearer ` prefix it 401s.
        ...(apiKey ? { Authorization: apiKey } : {}),
      },
      body: JSON.stringify({
        language: runtime.piston,
        version: (question.runtime_meta as { piston_version?: string } | null)?.piston_version ?? '*',
        files: [{ name: runtime.file, content: code }],
        stdin,
        compile_timeout: 10_000,
        run_timeout: 5_000,
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      // Quota and transport failures are ours, not the team's, so say so rather
      // than printing a status code into their console.
      console.error('Code run: piston returned', response.status);
      return NextResponse.json(
        { success: false, error: 'The runner is busy. Try again in a moment.' },
        { status: 502 },
      );
    }

    const payload = await response.json();
    return NextResponse.json({
      success: true,
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
      language: runtime.id,
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    console.error('Code run failed:', err);
    return NextResponse.json(
      { success: false, error: timedOut ? 'The run took too long and was stopped.' : 'Could not reach the runner.' },
      { status: 504 },
    );
  }
}
