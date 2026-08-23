import { z } from 'zod';
import { contractOf } from '@/lib/gameplay/code/contract';

export const questionTypes = ['crossword', 'aptitude', 'output', 'debugging', 'code_completion', 'coding', 'pvp', 'logic_puzzle', 'debug_output'] as const;
export type QuestionType = (typeof questionTypes)[number];

export interface QuestionRow {
  id: string;
  round_id: number;
  type: QuestionType;
  prompt: string;
  content: unknown;
  order_index: number;
  /**
   * Rows sharing this within a round are interchangeable versions of one slot.
   * See `variants.ts` — this is the key the per-team pick is grouped on.
   */
  variant_group?: string | null;
  language_options: string[] | null;
  /** Worked examples, safe to show. Never `hidden_test_cases`. */
  sample_test_cases?: unknown;
  runtime_meta?: unknown;
  time_limit_seconds: number | null;
  /**
   * What a correct answer pays. Public information — the event brief prints the
   * whole table, and the round UI has always shown it. It is the answer key that
   * is secret, not the price.
   */
  reward?: Record<string, number> | null;
}

/**
 * A short label for lists and tabs. Seeded questions carry `content.title`; the
 * prompt itself is usually a code block, so it makes a poor list item.
 */
export function questionTitle(question: Pick<QuestionRow, 'content' | 'prompt' | 'order_index'>): string {
  const content = question.content as { title?: unknown } | null;
  if (content && typeof content === 'object' && typeof content.title === 'string' && content.title.trim()) {
    return content.title.trim();
  }
  const firstLine = String(question.prompt ?? '').split('\n').find((line) => line.trim().length > 0);
  if (!firstLine) return `Question ${question.order_index}`;
  return firstLine.length > 60 ? `${firstLine.slice(0, 57).trimEnd()}…` : firstLine;
}

export interface SubmissionRow {
  id: string;
  team_id: string;
  round_id: number;
  question_id: string;
  answer_text: string | null;
  code: string | null;
  language: string | null;
  response: unknown;
  revision: number;
  status: 'draft' | 'submitted' | 'locked' | 'graded' | 'manual_review';
  submitted_at: string;
  locked_at: string | null;
  final_score: number | null;
  feedback: string | null;
  graded_revision: number | null;
}

export interface CodingEvaluationSummary {
  kind: 'coding_evaluation';
  status: 'completed' | 'runner_error';
  sample_passed: number;
  sample_total: number;
  hidden_passed: number;
  hidden_total: number;
  total_passed: number;
  total_cases: number;
  evaluated_at: string;
}

export const submissionPayloadSchema = z.object({
  question_id: z.string().uuid(),
  answer_text: z.string().trim().max(20000).optional().nullable(),
  code: z.string().max(100000).optional().nullable(),
  language: z.string().trim().max(64).optional().nullable(),
  response: z.record(z.string(), z.unknown()).optional().default({}),
});

export interface SampleCase {
  stdin: string;
  stdout: string;
  explanation?: string;
}

/**
 * Only the three fields a team is allowed to see, coerced to strings.
 *
 * Copying field by field rather than passing the column through means a case
 * later gaining, say, a `weight` or an internal note cannot ride along to the
 * client by accident.
 */
function sampleCases(value: unknown): SampleCase[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const row = entry as Record<string, unknown>;
    const explanation = typeof row.explanation === 'string' ? row.explanation : undefined;
    return [{ stdin: String(row.stdin ?? ''), stdout: String(row.stdout ?? ''), ...(explanation ? { explanation } : {}) }];
  });
}

function codingEvaluation(value: unknown): CodingEvaluationSummary | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const countFields = ['sample_passed', 'sample_total', 'hidden_passed', 'hidden_total', 'total_passed', 'total_cases'];
  if (row.kind !== 'coding_evaluation' || !countFields.every((field) => Number.isInteger(row[field]) && Number(row[field]) >= 0)) return null;
  if (row.status !== 'completed' && row.status !== 'runner_error' || typeof row.evaluated_at !== 'string') return null;
  return {
    kind: 'coding_evaluation', status: row.status,
    sample_passed: Number(row.sample_passed), sample_total: Number(row.sample_total),
    hidden_passed: Number(row.hidden_passed), hidden_total: Number(row.hidden_total),
    total_passed: Number(row.total_passed), total_cases: Number(row.total_cases), evaluated_at: row.evaluated_at,
  };
}

export function serializeSafeQuestion(
  question: QuestionRow,
  submission?: (Pick<SubmissionRow, 'status' | 'revision' | 'final_score'>
    & Partial<Pick<SubmissionRow, 'code' | 'language' | 'response'>>) | null,
) {
  return {
    id: question.id,
    type: question.type,
    title: questionTitle(question),
    prompt: question.prompt,
    content: question.content ?? {},
    order_index: question.order_index,
    language_options: question.language_options ?? [],
    // The visible half of the test cases. `hidden_test_cases` is what grading
    // runs against and is deliberately not selected anywhere a team can reach.
    sample_test_cases: sampleCases(question.sample_test_cases),
    time_limit_seconds: question.time_limit_seconds,
    // Named `pays` rather than `reward` so a future `...question` spread cannot
    // quietly leak the whole row through a key the client already expects.
    pays: (question.reward ?? {}) as Record<string, number>,
    submission_status: submission?.status ?? null,
    submission_revision: submission?.revision ?? null,
    // The function the team implements. The wrapper that calls it stays on the
    // server; this is only enough for the editor to draw the right starter.
    fn_contract: question.type === 'coding' ? contractOf(question.runtime_meta) : null,
    submitted_code: question.type === 'coding' ? submission?.code ?? null : null,
    submitted_language: question.type === 'coding' ? submission?.language ?? null : null,
    coding_evaluation: question.type === 'coding' ? codingEvaluation(submission?.response) : null,
    graded: submission?.final_score !== null && submission?.final_score !== undefined,
  };
}

export function validateSubmissionForQuestion(question: QuestionRow, payload: z.infer<typeof submissionPayloadSchema>) {
  const answerText = payload.answer_text?.trim() ?? '';
  const code = payload.code?.trim() ?? '';

  if (['crossword', 'aptitude', 'output', 'pvp', 'logic_puzzle'].includes(question.type) && answerText.length === 0) {
    return { ok: false as const, code: 'ANSWER_REQUIRED', message: 'An answer is required for this question.' };
  }

  if (['coding', 'code_completion'].includes(question.type) && code.length === 0) {
    return { ok: false as const, code: 'CODE_REQUIRED', message: 'Code is required for this question.' };
  }

  if ((question.type === 'debugging' || question.type === 'debug_output') && answerText.length === 0 && code.length === 0) {
    return { ok: false as const, code: 'ANSWER_REQUIRED', message: 'A debugging response is required.' };
  }

  if (question.language_options?.length && payload.language && !question.language_options.includes(payload.language)) {
    return { ok: false as const, code: 'INVALID_LANGUAGE', message: 'That language is not available for this question.' };
  }

  return { ok: true as const };
}
