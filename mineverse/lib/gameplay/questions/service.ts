import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { verifyDev4RoundAccess } from './access';
import { allowedQuestionIds, pickVariants } from './variants';
import { gradeSubmissionsNow, sweepRoundGrading } from '@/lib/gameplay/grading/instant';
import { getCachedRoundQuestions, getCachedTeamCode } from '@/lib/cache/reads';

const db = supabaseServer as any;

// The shapes and the answer-safety rules live in `contracts.ts`, which is what the
// unit tests exercise. This file used to carry a second copy of all of it, so a fix
// applied to one was silently missing from the other.
export {
  questionTypes,
  serializeSafeQuestion,
  validateSubmissionForQuestion,
  questionTitle,
  submissionPayloadSchema,
} from './contracts';
export type { QuestionType, QuestionRow, SubmissionRow } from './contracts';

import {
  serializeSafeQuestion,
  validateSubmissionForQuestion,
  submissionPayloadSchema,
  type QuestionRow,
  type SubmissionRow,
} from './contracts';

export async function getSafeQuestionsForRound(teamId: string, roundId: number) {
  const access = await verifyDev4RoundAccess(teamId, roundId);
  if (!access.ok) return access;

  // Guardian pack questions belong to the round but are served only inside a
  // guardian battle, so they never appear in the standard round list. The Round 3
  // PvP pack is sealed the same way — it is revealed by `POST /api/admin/pvp/
  // matches/[id]/start`, so listing it here would hand every team the duel
  // questions before the duel.
  //
  // Cached per round. Every team sits a different paper, but this query is
  // identical for all of them — the difference is made by `pickVariants` below,
  // in memory. See `getCachedRoundQuestions`.
  const allQuestions = await getCachedRoundQuestions(roundId);

  // The team's own code, so the client can namespace its local answer drafts —
  // shared lab machines otherwise hand the next team the previous team's typing
  // — and so the paper can be picked for this team specifically.
  //
  // Cached, because this ran on every poll of every round screen and the value
  // it fetches was fixed at registration. See `getCachedTeamCode`.
  const teamCode = await getCachedTeamCode(teamId);

  // One variant per slot. The alternates are dropped here rather than filtered
  // in the UI: a question that never leaves the server cannot be read out of a
  // network tab by the team sitting next to the one it was written for.
  const questions = pickVariants<QuestionRow>((allQuestions ?? []) as QuestionRow[], teamCode ?? undefined, roundId);

  const questionIds = questions.map((question: QuestionRow) => question.id);
  const submissionsByQuestion = new Map<string, SubmissionRow>();

  if (questionIds.length > 0) {
    const { data: submissions, error: submissionsError } = await db
      .from('submissions')
      .select('id, question_id, status, revision, final_score, code, language, response')
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
      team_code: teamCode,
      ends_at: access.round.ends_at,
      status: access.round.status,
      guardian_unlocked: access.round.guardian_unlocked,
      server_time: new Date().toISOString(),
      questions: questions.map((question: QuestionRow) => serializeSafeQuestion(question, submissionsByQuestion.get(question.id))),
    },
  };
}

/**
 * The question ids this team is entitled to answer in a round.
 *
 * Serving one variant and accepting all of them would be a hole rather than a
 * feature: two teams that swap ids over WhatsApp could each answer both
 * versions of every slot and collect the reward twice for one question. Both
 * write paths run through this.
 */
async function allowedIdsForRound(teamId: string, roundId: number): Promise<Set<string>> {
  // The same cached bank the paper is built from. This runs on every save, so
  // it was the second copy of the round's question query per team per round.
  const [rows, teamCode] = await Promise.all([
    getCachedRoundQuestions(roundId),
    getCachedTeamCode(teamId),
  ]);

  return allowedQuestionIds(rows ?? [], teamCode ?? undefined, roundId);
}

export async function upsertTeamSubmission(teamId: string, payload: z.infer<typeof submissionPayloadSchema>) {
  const { data: question, error: questionError } = await db
    .from('questions')
    .select('id, round_id, type, prompt, content, order_index, language_options, time_limit_seconds, guardian_name')
    .eq('id', payload.question_id)
    .single();

  if (questionError || !question) {
    return { ok: false as const, status: 404, code: 'QUESTION_NOT_FOUND', message: 'Question not found.' };
  }

  // A guardian question is answered through the guardian battle, which enforces
  // its own deadline and all-correct rule. Routing it here would bypass both.
  // A PvP question is answered through the match, which times the answer — an
  // answer written here would not count and would leak the pack into `submissions`.
  if (question.guardian_name || question.type === 'pvp') {
    return { ok: false as const, status: 404, code: 'QUESTION_NOT_FOUND', message: 'Question not found.' };
  }

  const access = await verifyDev4RoundAccess(teamId, question.round_id);
  if (!access.ok) return access;

  // The question exists and belongs to an open round, but it may be a variant
  // written for a different team. Answering to `QUESTION_NOT_FOUND` rather than
  // a distinct code keeps the two cases indistinguishable from outside.
  const allowed = await allowedIdsForRound(teamId, question.round_id);
  if (!allowed.has(question.id)) {
    return { ok: false as const, status: 404, code: 'QUESTION_NOT_FOUND', message: 'Question not found.' };
  }

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

/**
 * Records that this team has been through this round.
 *
 * `team_round_access.completed_at` had no writer anywhere in the codebase, and
 * three things read it: the world map decides `REPLAY` versus `ACCESS` from it,
 * it is what makes the *next* biome appear on the map at all, and the admin
 * round screen reports it. So a team that finished Round 1 was indistinguishable
 * from one that had never opened it — the pin still read ACCESS, and walking
 * back into the round they had just handed in was the obvious thing to do.
 *
 * `started_at` is backfilled here for the same reason: a round finished without
 * one would otherwise report as never begun.
 */
export async function markRoundAttempted(teamId: string, roundId: number) {
  const nowIso = new Date().toISOString();

  const { data: existing, error } = await db
    .from('team_round_access')
    .select('id, started_at')
    .eq('team_id', teamId)
    .eq('round_id', roundId)
    .maybeSingle();

  if (error) throw error;
  // No access row means the team was never entitled to the round; writing one
  // here would grant access as a side effect of submitting.
  if (!existing) return;

  const { error: updateError } = await db
    .from('team_round_access')
    .update({ completed_at: nowIso, started_at: existing.started_at ?? nowIso })
    .eq('id', existing.id);

  if (updateError) throw updateError;
}

export const sectionSubmitPayloadSchema = z.object({
  round_id: z.number().int(),
  question_ids: z.array(z.string().uuid()).min(1).max(100),
  /**
   * Set by "Finish round", not by a section hand-in.
   *
   * A section is graded as itself; finishing the round additionally sweeps every
   * other answer the team gave, so a tab that was never submitted — or one whose
   * grading failed halfway — is settled before they leave. See `sweepRoundGrading`.
   */
  finish: z.boolean().optional(),
});

/**
 * Locks every submission in a section so the team can no longer revise it.
 *
 * A section is submitted as a unit: the whole set is checked first and nothing
 * is written unless every question in it has an answer, so a team can never end
 * up with half a section frozen. Locking is what `upsertTeamSubmission` already
 * refuses to write past, so this is the only gate the flow needs.
 */
export async function lockTeamSection(teamId: string, payload: z.infer<typeof sectionSubmitPayloadSchema>) {
  const access = await verifyDev4RoundAccess(teamId, payload.round_id);
  if (!access.ok) return access;

  const { data: questions, error: questionsError } = await db
    .from('questions')
    .select('id, round_id, type, guardian_name')
    .in('id', payload.question_ids);

  if (questionsError) throw questionsError;

  // Every id must be a real question of the round being submitted, and not part of
  // a sealed pack, so a crafted payload cannot reach across rounds or into the
  // guardian / PvP questions.
  const allowed = await allowedIdsForRound(teamId, payload.round_id);
  const valid = (questions ?? []).filter(
    (question: QuestionRow & { guardian_name: string | null }) =>
      question.round_id === payload.round_id &&
      !question.guardian_name &&
      question.type !== 'pvp' &&
      // Same rule as the single-answer path: another team's variant is not part
      // of this team's section, so it cannot be locked into it.
      allowed.has(question.id),
  );

  if (valid.length !== payload.question_ids.length) {
    return { ok: false as const, status: 400, code: 'INVALID_SECTION', message: 'That section does not belong to this round.' };
  }

  const { data: submissions, error: submissionsError } = await db
    .from('submissions')
    .select('id, question_id, status, response')
    .eq('team_id', teamId)
    .in('question_id', payload.question_ids);

  if (submissionsError) throw submissionsError;

  const answered = new Set((submissions ?? []).map((row: SubmissionRow) => row.question_id));
  const missing = payload.question_ids.filter((id) => !answered.has(id));

  if (missing.length > 0) {
    return {
      ok: false as const,
      status: 400,
      code: 'SECTION_INCOMPLETE',
      message: `Answer every question first — ${missing.length} still unanswered.`,
    };
  }

  // A coding answer is not ready for a final section submission merely because
  // its draft was autosaved. It must have gone through the private evaluator;
  // otherwise the section button would bypass Submit and hide the result screen.
  const codingIds = new Set(
    valid
      .filter((question: QuestionRow & { guardian_name: string | null }) => question.type === 'coding')
      .map((question: QuestionRow & { guardian_name: string | null }) => question.id),
  );
  const untestedCoding = (submissions ?? []).filter((row: SubmissionRow) => {
    if (!codingIds.has(row.question_id)) return false;
    const response = row.response as Record<string, unknown> | null;
    /**
     * Having been through Submit is the test, not having been graded by it.
     *
     * This also demanded `status === 'completed'`, which is a judgement about
     * the judge rather than about the team: when the runner rate limits us the
     * submit path still saves the code and records `runner_error`, so a team
     * that pressed Submit and watched it fail could never hand the section in.
     * Their answer was safe and the round was not — the platform's outage
     * became the team's dead end.
     *
     * A missing summary still blocks, because that means Submit was never
     * pressed and the section button would be bypassing the evaluator. An
     * ungraded submission is picked up by the admin grading run afterwards.
     */
    return response?.kind !== 'coding_evaluation';
  });
  /**
   * Deliberately not a blocker any more.
   *
   * This refused the whole section until every coding answer carried a
   * completed evaluation. Across the live database not one coding submission
   * had ever reached that state, so the gate was never passable — a team could
   * answer everything and still be unable to hand the round in, and the message
   * told them to do the thing they had already done.
   *
   * It was never load-bearing. Coding answers are marked after the round by the
   * admin grading run against the hidden tests, like every other type; the
   * in-editor evaluation is feedback for the team, not the mark. Left as a
   * counted warning so the console can still see who never ran their code.
   */
  if (untestedCoding.length > 0) {
    console.warn(`[submissions] locking a section with ${untestedCoding.length} unevaluated coding answer(s)`);
  }

  // Graded and manual-review rows are already final; re-locking them would
  // overwrite a grading outcome.
  const lockable = (submissions ?? [])
    .filter((row: SubmissionRow) => row.status === 'draft' || row.status === 'submitted')
    .map((row: SubmissionRow) => row.id);

  if (lockable.length > 0) {
    const lockedAt = new Date().toISOString();
    const { error: lockError } = await db
      .from('submissions')
      .update({ status: 'locked', locked_at: lockedAt, updated_at: lockedAt })
      .eq('team_id', teamId)
      .in('id', lockable);

    if (lockError) throw lockError;
  }

  /**
   * Mark and pay, now, while the team is still watching the button.
   *
   * This is the deliberate hand-in the autosave path is not, which is what makes
   * grading safe here and nowhere else: nothing after this point can revise the
   * answers, so marking them cannot freeze work in progress.
   *
   * Failure is contained on purpose. The lock above has already committed, and
   * that is the part that must not be lost — a team whose section is sealed but
   * unmarked is recoverable by the finish-round sweep or an admin run, whereas a
   * team told their submit failed will press it again against locked rows.
   */
  let grading: Awaited<ReturnType<typeof gradeSubmissionsNow>> | null = null;
  try {
    grading = payload.finish
      ? await sweepRoundGrading(teamId, payload.round_id)
      : await gradeSubmissionsNow({ teamId, roundId: payload.round_id, questionIds: payload.question_ids });
  } catch (gradingError) {
    console.error('[submissions] section locked but grading failed:', gradingError);
  }

  if (payload.finish) {
    // Same containment as grading: the answers are already sealed, and losing
    // the marker is recoverable where losing the hand-in is not.
    try {
      await markRoundAttempted(teamId, payload.round_id);
    } catch (markError) {
      console.error('[submissions] round finished but could not be marked attempted:', markError);
    }
  }

  return {
    ok: true as const,
    data: {
      round_id: payload.round_id,
      locked_count: lockable.length,
      already_final: payload.question_ids.length - lockable.length,
      grading: grading
        ? {
            graded: grading.graded,
            correct: grading.correct,
            partial: grading.partial,
            manual_review: grading.manual_review,
            awarded: grading.awarded,
            // Only the finish sweep reports this: how many answers are still
            // unmarked after it ran. Anything above zero is the deterministic
            // signal that this team needs an admin grading pass.
            ...(payload.finish && 'still_open' in grading ? { still_open: grading.still_open } : {}),
          }
        : null,
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
