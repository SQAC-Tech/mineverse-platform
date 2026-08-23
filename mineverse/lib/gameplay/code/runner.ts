import 'server-only';

import type { Runtime } from './runtimes';

export interface ExecutionResult {
  compile: { stdout: string; stderr: string; code: number | null };
  run: { stdout: string; stderr: string; code: number | null; signal: string | null };
}

interface PistonResponse {
  compile?: { stdout?: string; stderr?: string; code?: number | null };
  run?: { stdout?: string; stderr?: string; code?: number | null; signal?: string | null };
}

export class CodeRunnerError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

/**
 * One in-flight request at a time, with a wait after a 429.
 *
 * Piston rate limits per source address, and grading a submission is not one
 * request but one per test case — five for a question with two samples and
 * three hidden cases. A hall of teams submitting at once therefore trips the
 * limit immediately, and the team sees "the runner is busy" for code that was
 * never actually run.
 *
 * The queue serialises every execution this server makes so the burst is spread
 * out, and a 429 is retried rather than surfaced: the limit is a throttle, not a
 * refusal, and it clears in a second or two. Only a limit that survives three
 * waits reaches the team.
 */
let chain: Promise<unknown> = Promise.resolve();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postWithBackoff(endpoint: string, init: RequestInit): Promise<Response> {
  const run = async () => {
    let wait = 700;
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetch(endpoint, init);
      if (response.status !== 429) return response;
      if (attempt === 3) return response;
      await sleep(wait);
      wait *= 2;
    }
    throw new CodeRunnerError('The code runner is unavailable.', 503);
  };

  // Tack onto the chain so two submissions never fire at the same instant.
  const next = chain.then(run, run);
  chain = next.then(() => undefined, () => undefined);
  return next as Promise<Response>;
}

/** Executes one program/input pair. It never persists or exposes test cases. */
export async function executeCode(params: {
  code: string;
  stdin: string;
  runtime: Runtime;
  pistonVersion?: string | null;
}): Promise<ExecutionResult> {
  const endpoint = process.env.PISTON_API_URL;
  if (!endpoint) throw new CodeRunnerError('Running code is not configured for this event.', 503);

  const response = await postWithBackoff(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.PISTON_API_KEY ? { Authorization: process.env.PISTON_API_KEY } : {}),
    },
    body: JSON.stringify({
      language: params.runtime.piston,
      version: params.pistonVersion ?? '*',
      files: [{ name: params.runtime.file, content: params.code }],
      stdin: params.stdin,
      compile_timeout: 10_000,
      run_timeout: 5_000,
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    throw new CodeRunnerError(
      response.status === 429
        ? 'The code runner is rate limiting us. Your code was saved — try again in a few seconds.'
        : 'The runner is busy. Try again in a moment.',
      response.status,
    );
  }
  const payload = (await response.json()) as PistonResponse;
  return {
    compile: { stdout: payload.compile?.stdout ?? '', stderr: payload.compile?.stderr ?? '', code: payload.compile?.code ?? null },
    run: {
      stdout: payload.run?.stdout ?? '', stderr: payload.run?.stderr ?? '', code: payload.run?.code ?? null,
      signal: payload.run?.signal ?? null,
    },
  };
}
