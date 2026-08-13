import { z } from 'zod';

export const questionTypes = ['crossword', 'aptitude', 'output', 'debugging', 'code_completion', 'coding', 'pvp', 'logic_puzzle', 'debug_output'] as const;
export type QuestionType = (typeof questionTypes)[number];

export interface QuestionRow {
  id: string;
  round_id: number;
  type: QuestionType;
  prompt: string;
  content: unknown;
  order_index: number;
  language_options: string[] | null;
  time_limit_seconds: number | null;
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

export const submissionPayloadSchema = z.object({
  question_id: z.string().uuid(),
  answer_text: z.string().trim().max(20000).optional().nullable(),
  code: z.string().max(100000).optional().nullable(),
  language: z.string().trim().max(64).optional().nullable(),
  response: z.record(z.string(), z.unknown()).optional().default({}),
});

export function serializeSafeQuestion(question: QuestionRow, submission?: Pick<SubmissionRow, 'status' | 'revision' | 'final_score'> | null) {
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    content: question.content ?? {},
    order_index: question.order_index,
    language_options: question.language_options ?? [],
    time_limit_seconds: question.time_limit_seconds,
    submission_status: submission?.status ?? null,
    submission_revision: submission?.revision ?? null,
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