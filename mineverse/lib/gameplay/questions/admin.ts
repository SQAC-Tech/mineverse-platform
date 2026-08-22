import { supabaseServer } from '@/lib/supabase/server';
import { questionTitle, type QuestionRow } from './contracts';
import { pickVariants } from './variants';

/**
 * Every team's answers to a round, for the organiser console.
 *
 * There was no way to read these at all before this: `submissions` was written
 * by the round shells and read only by the grader and by the manual-review
 * queue, which by definition shows the handful the grader could not decide. So
 * a team asking "we answered that, why is it zero" could be answered only by
 * opening the database.
 *
 * The unanswered questions matter as much as the answered ones, which is why a
 * team's row is built from the questions it was *served* rather than from the
 * rows it happens to have in `submissions`. A blank against question 7 is the
 * finding; an absent question 7 is nothing.
 */

export interface TeamAnswer {
  question_id: string;
  /** Slot position on the paper, not the variant's own order_index. */
  order_index: number;
  title: string;
  type: string;
  variant_group: string | null;
  /** Which version of the slot this team was served, 1-based. */
  variant_number: number;
  /**
   * False for an answer against a question this team's current paper does not
   * contain — written before the bank grew variants, most likely. Shown, but
   * labelled: it is a real answer to a real question, and it is not part of the
   * paper the team would be served today.
   */
  on_paper: boolean;
  answer_text: string | null;
  code: string | null;
  language: string | null;
  status: string | null;
  revision: number | null;
  final_score: number | null;
  feedback: string | null;
  submitted_at: string | null;
  locked_at: string | null;
}

export interface TeamGuardian {
  guardian_name: string;
  status: string;
  correct_count: number | null;
  total_questions: number | null;
  attempt_number: number;
  completed_at: string | null;
  /** What was typed in the fight. Empty for battles resolved before it was recorded. */
  answers: Array<{ question_id: string; order_index: number; answer_text: string | null; correct: boolean }>;
}

export interface TeamRoundRow {
  team_id: string;
  team_code: string;
  team_name: string;
  answered: number;
  locked: number;
  graded: number;
  score: number;
  /**
   * Answers to questions this team's current paper does not contain. Normally
   * zero — it is non-zero only where the bank changed after the answer was
   * written. Counted separately so the four numbers above all measure the same
   * paper, and so these can never be quietly dropped either.
   */
  off_paper: number;
  last_activity: string | null;
  answers: TeamAnswer[];
  guardians: TeamGuardian[];
}

export interface RoundSubmissions {
  round: { id: number; name: string; status: string; starts_at: string | null; ends_at: string | null };
  question_count: number;
  teams: TeamRoundRow[];
  totals: { teams: number; started: number; answered: number; locked: number; graded: number; expected: number };
}

export async function listRoundSubmissions(roundId: number): Promise<RoundSubmissions | null> {
  const { data: round } = await supabaseServer
    .from('rounds')
    .select('id, name, status, starts_at, ends_at')
    .eq('id', roundId)
    .maybeSingle();

  if (!round) return null;

  const [bankResult, accessResult, submissionsResult, battlesResult] = await Promise.all([
    supabaseServer
      .from('questions')
      .select('id, round_id, type, prompt, content, order_index, variant_group, reward, language_options, time_limit_seconds')
      .eq('round_id', roundId)
      .is('guardian_name', null)
      .neq('type', 'pvp'),
    // Who was *supposed* to sit this round. A team with access and no rows is
    // the interesting case, and it is invisible if the list is built from
    // `submissions` alone.
    supabaseServer
      .from('team_round_access')
      .select('team_id, teams(team_code, team_name)')
      .eq('round_id', roundId),
    supabaseServer
      .from('submissions')
      .select(
        'team_id, question_id, answer_text, code, language, status, revision, final_score, feedback, submitted_at, locked_at',
      )
      .eq('round_id', roundId),
    supabaseServer
      .from('guardian_battles')
      .select('team_id, guardian_name, status, correct_count, total_questions, attempt_number, completed_at, answers')
      .eq('round_id', roundId),
  ]);

  const access = accessResult.data ?? [];
  const submissions = submissionsResult.data ?? [];
  const battles = battlesResult.data ?? [];
  // `content` and `reward` come back as `Json`, which is wider than the row
  // contract; every consumer below treats them as opaque.
  const bankRows = (bankResult.data ?? []) as unknown as QuestionRow[];

  const teams = new Map<string, { team_code: string; team_name: string }>();
  for (const row of access) {
    teams.set(row.team_id, {
      team_code: row.teams?.team_code ?? '',
      team_name: row.teams?.team_name ?? '',
    });
  }

  // A submission from a team without an access row still has to show up — demo
  // teams bypass the access table entirely, and so does anything left behind by
  // a round that was opened and then closed.
  const orphanIds = [...new Set(submissions.map((row) => row.team_id))].filter((id) => !teams.has(id));
  if (orphanIds.length > 0) {
    const { data: extra } = await supabaseServer
      .from('teams')
      .select('id, team_code, team_name')
      .in('id', orphanIds);
    for (const team of extra ?? []) {
      teams.set(team.id, { team_code: team.team_code ?? '', team_name: team.team_name ?? '' });
    }
  }

  type SubmissionRecord = (typeof submissions)[number];

  const submissionsByTeam = new Map<string, Map<string, SubmissionRecord>>();
  for (const row of submissions) {
    const forTeam = submissionsByTeam.get(row.team_id) ?? new Map<string, SubmissionRecord>();
    forTeam.set(row.question_id, row);
    submissionsByTeam.set(row.team_id, forTeam);
  }

  const battlesByTeam = new Map<string, TeamGuardian[]>();
  for (const row of battles) {
    const forTeam = battlesByTeam.get(row.team_id) ?? [];
    forTeam.push({
      ...row,
      // `answers` is `Json`. Anything that is not the array this column is
      // written with is treated as no record rather than trusted into the UI.
      answers: (Array.isArray(row.answers) ? row.answers : []) as TeamGuardian['answers'],
    });
    battlesByTeam.set(row.team_id, forTeam);
  }

  // Which version of each slot a team was served, so the console shows the paper
  // the team saw rather than the first variant of every slot.
  const variantNumber = new Map<string, number>();
  const bySlot = new Map<string, QuestionRow[]>();
  for (const row of bankRows) {
    const key = row.variant_group?.trim() || row.id;
    const bucket = bySlot.get(key) ?? [];
    bucket.push(row);
    bySlot.set(key, bucket);
  }
  for (const bucket of bySlot.values()) {
    [...bucket]
      .sort((a, b) => a.order_index - b.order_index || a.id.localeCompare(b.id))
      .forEach((row, index) => variantNumber.set(row.id, index + 1));
  }

  const list: TeamRoundRow[] = [...teams.entries()]
    .map(([teamId, team]) => {
      const paper = pickVariants<QuestionRow>(bankRows, team.team_code, roundId);
      const mine = submissionsByTeam.get(teamId) ?? new Map<string, SubmissionRecord>();

      const answers: TeamAnswer[] = paper.map((question) => {
        const submission = mine.get(question.id) ?? null;
        return {
          question_id: question.id,
          order_index: question.order_index,
          title: questionTitle(question),
          type: question.type,
          variant_group: question.variant_group ?? null,
          variant_number: variantNumber.get(question.id) ?? 1,
          on_paper: true,
          answer_text: submission?.answer_text ?? null,
          code: submission?.code ?? null,
          language: submission?.language ?? null,
          status: submission?.status ?? null,
          revision: submission?.revision ?? null,
          final_score: submission?.final_score === null || submission?.final_score === undefined
            ? null
            : Number(submission.final_score),
          feedback: submission?.feedback ?? null,
          submitted_at: submission?.submitted_at ?? null,
          locked_at: submission?.locked_at ?? null,
        };
      });

      // Anything the team wrote against a question this paper does not contain —
      // a variant served before the bank changed, most likely. Never dropped: an
      // answer that exists and is not shown is the failure this screen exists to
      // prevent.
      for (const [questionId, submission] of mine) {
        if (answers.some((answer) => answer.question_id === questionId)) continue;
        const question = bankRows.find((row) => row.id === questionId);
        answers.push({
          question_id: questionId,
          order_index: question?.order_index ?? 9999,
          title: question ? questionTitle(question) : 'Question no longer on this paper',
          type: question?.type ?? 'unknown',
          variant_group: question?.variant_group ?? null,
          variant_number: variantNumber.get(questionId) ?? 0,
          on_paper: false,
          answer_text: submission.answer_text ?? null,
          code: submission.code ?? null,
          language: submission.language ?? null,
          status: submission.status ?? null,
          revision: submission.revision ?? null,
          final_score: submission.final_score === null || submission.final_score === undefined
            ? null
            : Number(submission.final_score),
          feedback: submission.feedback ?? null,
          submitted_at: submission.submitted_at ?? null,
          locked_at: submission.locked_at ?? null,
        });
      }

      // Every count below is scoped to the paper, so "3 of 10 answered, 11
      // locked" cannot happen. Leftovers get their own number.
      const onPaper = answers.filter((answer) => answer.on_paper);
      const answered = onPaper.filter((answer) => answer.status !== null).length;
      const times = answers
        .map((answer) => answer.submitted_at)
        .filter((value): value is string => Boolean(value))
        .sort();

      return {
        team_id: teamId,
        team_code: team.team_code,
        team_name: team.team_name,
        answered,
        locked: onPaper.filter((answer) => answer.locked_at !== null).length,
        graded: onPaper.filter((answer) => answer.status === 'graded').length,
        score: onPaper.reduce((sum, answer) => sum + (answer.final_score ?? 0), 0),
        off_paper: answers.length - onPaper.length,
        last_activity: times.at(-1) ?? null,
        answers: answers.sort((a, b) => a.order_index - b.order_index),
        guardians: battlesByTeam.get(teamId) ?? [],
      };
    })
    // Teams that did something come first — during a live round that is the list
    // an organiser is watching — and the rest stay in code order underneath.
    .sort((a, b) => b.answered - a.answered || a.team_code.localeCompare(b.team_code));

  const questionCount = bySlot.size;

  return {
    round,
    question_count: questionCount,
    teams: list,
    totals: {
      teams: list.length,
      started: list.filter((team) => team.answered > 0).length,
      answered: list.reduce((sum, team) => sum + team.answered, 0),
      locked: list.reduce((sum, team) => sum + team.locked, 0),
      graded: list.reduce((sum, team) => sum + team.graded, 0),
      expected: list.length * questionCount,
    },
  };
}
