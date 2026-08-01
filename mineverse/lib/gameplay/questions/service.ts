import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { verifyDev4RoundAccess } from './access';

const db = supabaseServer as any;

export const questionTypes = ['crossword', 'aptitude', 'output', 'debugging', 'code_completion', 'coding', 'pvp'] as const;
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

  if (['crossword', 'aptitude', 'output', 'pvp'].includes(question.type) && answerText.length === 0) {
    return { ok: false as const, code: 'ANSWER_REQUIRED', message: 'An answer is required for this question.' };
  }

  if (['coding', 'code_completion'].includes(question.type) && code.length === 0) {
    return { ok: false as const, code: 'CODE_REQUIRED', message: 'Code is required for this question.' };
  }

  if (question.type === 'debugging' && answerText.length === 0 && code.length === 0) {
    return { ok: false as const, code: 'ANSWER_REQUIRED', message: 'A debugging response is required.' };
  }

  if (question.language_options?.length && payload.language && !question.language_options.includes(payload.language)) {
    return { ok: false as const, code: 'INVALID_LANGUAGE', message: 'That language is not available for this question.' };
  }

  return { ok: true as const };
}

export async function getSafeQuestionsForRound(teamId: string, roundId: number) {
  const access = await verifyDev4RoundAccess(teamId, roundId);
  if (!access.ok) return access;

  const { data: questions, error: questionsError } = await db
    .from('questions')
    .select('id, round_id, type, prompt, content, order_index, language_options, time_limit_seconds')
    .eq('round_id', roundId)
    .order('order_index', { ascending: true });

  if (questionsError) throw questionsError;

  const questionIds = (questions ?? []).map((question: QuestionRow) => question.id);
  const submissionsByQuestion = new Map<string, SubmissionRow>();

  if (questionIds.length > 0) {
    const { data: submissions, error: submissionsError } = await db
      .from('submissions')
      .select('id, question_id, status, revision, final_score')
      .eq('team_id', teamId)
      .in('question_id', questionIds);

    if (submissionsError) throw submissionsError;
    for (const submission of submissions ?? []) submissionsByQuestion.set(submission.question_id, submission);
  }

  return {
    ok: true as const,
    data: {
      round_id: roundId,
      round_name: access.round.name,
      ends_at: access.round.ends_at,
      server_time: new Date().toISOString(),
      questions: (questions ?? []).map((question: QuestionRow) => serializeSafeQuestion(question, submissionsByQuestion.get(question.id))),
    },
  };
}

export async function upsertTeamSubmission(teamId: string, payload: z.infer<typeof submissionPayloadSchema>) {
  const { data: question, error: questionError } = await db
    .from('questions')
    .select('id, round_id, type, prompt, content, order_index, language_options, time_limit_seconds')
    .eq('id', payload.question_id)
    .single();

  if (questionError || !question) {
    return { ok: false as const, status: 404, code: 'QUESTION_NOT_FOUND', message: 'Question not found.' };
  }

  const access = await verifyDev4RoundAccess(teamId, question.round_id);
  if (!access.ok) return access;

  const validation = validateSubmissionForQuestion(question, payload);
  if (!validation.ok) return { ok: false as const, status: 400, code: validation.code, message: validation.message };

  const { data: existing, error: existingError } = await db
    .from('submissions')
    .select('*')
    .eq('team_id', teamId)
    .eq('question_id', payload.question_id)
    .single();

  if (existingError && existingError.code !== 'PGRST116') throw existingError;

  if (existing && ['locked', 'graded', 'manual_review'].includes(existing.status)) {
    return { ok: false as const, status: 403, code: 'SUBMISSION_LOCKED', message: 'This submission can no longer be revised.' };
  }

  const submittedAt = new Date().toISOString();
  const submissionData = {
    team_id: teamId,
    round_id: question.round_id,
    question_id: payload.question_id,
    answer_text: payload.answer_text ?? null,
    code: payload.code ?? null,
    language: payload.language ?? null,
    response: payload.response ?? {},
    revision: existing ? existing.revision + 1 : 1,
    status: 'submitted',
    submitted_at: submittedAt,
    updated_at: submittedAt,
  };

  const { data: saved, error: saveError } = await db
    .from('submissions')
    .upsert(submissionData, { onConflict: 'team_id,question_id' })
    .select('id, revision, status, submitted_at')
    .single();

  if (saveError) throw saveError;

  return {
    ok: true as const,
    data: {
      submission_id: saved.id,
      revision: saved.revision,
      status: saved.status,
      submitted_at: saved.submitted_at,
    },
  };
}

export async function getMySubmissions(teamId: string, roundId: number) {
  const access = await verifyDev4RoundAccess(teamId, roundId);
  if (!access.ok) return access;

  const { data, error } = await db
    .from('submissions')
    .select('id, question_id, answer_text, code, language, response, revision, status, submitted_at, locked_at, final_score, feedback, graded_revision')
    .eq('team_id', teamId)
    .eq('round_id', roundId)
    .order('submitted_at', { ascending: false });

  if (error) throw error;

  return {
    ok: true as const,
    data: {
      round_id: roundId,
      ends_at: access.round.ends_at,
      server_time: new Date().toISOString(),
      submissions: data ?? [],
    },
  };
}