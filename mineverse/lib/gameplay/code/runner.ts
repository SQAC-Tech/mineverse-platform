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

/** Executes one program/input pair. It never persists or exposes test cases. */
export async function executeCode(params: {
  code: string;
  stdin: string;
  runtime: Runtime;
  pistonVersion?: string | null;
}): Promise<ExecutionResult> {
  const endpoint = process.env.PISTON_API_URL;
  if (!endpoint) throw new CodeRunnerError('Running code is not configured for this event.', 503);

  const response = await fetch(endpoint, {
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

  if (!response.ok) throw new CodeRunnerError('The runner is busy. Try again in a moment.', response.status);
  const payload = (await response.json()) as PistonResponse;
  return {
    compile: { stdout: payload.compile?.stdout ?? '', stderr: payload.compile?.stderr ?? '', code: payload.compile?.code ?? null },
    run: {
      stdout: payload.run?.stdout ?? '', stderr: payload.run?.stderr ?? '', code: payload.run?.code ?? null,
      signal: payload.run?.signal ?? null,
    },
  };
}
