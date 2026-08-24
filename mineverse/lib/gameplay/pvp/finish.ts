import { supabaseServer } from '@/lib/supabase/server';
import { checkDeterministicAnswer } from '@/lib/gameplay/grading/deterministic';

const db = supabaseServer as any;

/**
 * Ending a duel, from the arena rather than the admin panel.
 *
 * The duel is a race, and this is what stops the clock: the first team to press
 * SUBMIT ends it for both sides. Whatever the opponent had saved at that
 * instant is what they are marked on, which is the whole reason SAVE & NEXT
 * writes to the server on every question instead of holding a local draft — a
 * team that is mid-thought when the other side finishes still gets credit for
 * everything it had already put down.
 *
 * ## Why both teams are graded here
 *
 * Grading only the submitter and leaving the opponent for later would mean the
 * result depends on when a second request happens to arrive. Both sides are
 * marked inside the same call, from the same sealed pack, and the verdict is
 * written in one transaction by `finish_pvp_match`.
 *
 * ## Where the answer keys stay
 *
 * `pvp_match_questions.expected_answer` is read here on the server and never
 * leaves it. `serializeSafePvpQuestion` is what the arena receives, and it has
 * no answer field at all — so a team cannot read the pack out of its own
 * network tab while the duel is running.
 */

export interface TeamScore {
  team_id: string;
  correct: number;
  total: number;
  /** Milliseconds from the match starting to this team's last correct answer. */
  elapsed_ms: number | null;
}

export type FinishResult =
  | { ok: true; data: { match_id: string; winner_team_id: string; loser_team_id: string; idempotent: boolean } }
  | { ok: false; status: number; code: string; message: string };

/**
 * Marks one team's saved answers and returns what they scored.
 *
 * Deliberately not `evaluatePvpCompletion`: that one only records a result when
 * a team swept the whole pack, because it existed to feed a winner rule keyed
 * on `completion_at`. Here a partial score is the normal case and has to be
 * carried through.
 */
async function scoreTeam(
  matchId: string,
  teamId: string,
  startedAt: string | null,
  questions: Array<{ id: string; expected_answer: unknown }>,
): Promise<TeamScore> {
  const { data: submissions, error } = await db
    .from('pvp_match_submissions')
    .select('id, match_question_id, answer_text, revision, submitted_at')
    .eq('match_id', matchId)
    .eq('team_id', teamId)
    .order('revision', { ascending: true });

  if (error) throw error;

  // Latest revision per question is the one that counts — a team may have
  // saved a question several times on its way through.
  const latest = new Map<string, any>();
  for (const submission of submissions ?? []) latest.set(submission.match_question_id, submission);

  let correct = 0;
  let lastCorrectAt: string | null = null;

  for (const question of questions) {
    const submission = latest.get(question.id);
    if (!submission) continue;

    const isCorrect = checkDeterministicAnswer(submission.answer_text, question.expected_answer as never) === true;

    await db
      .from('pvp_match_submissions')
      .update({
        status: isCorrect ? 'correct' : 'incorrect',
        is_correct: isCorrect,
        validated_at: new Date().toISOString(),
      })
      .eq('id', submission.id);

    if (isCorrect) {
      correct += 1;
      if (!lastCorrectAt || submission.submitted_at > lastCorrectAt) lastCorrectAt = submission.submitted_at;
    }
  }

  // Timed to the last *correct* answer, not the last answer: otherwise a team
  // that finished early and then sat re-editing a wrong one would be recorded
  // as slower than it was.
  const elapsed_ms =
    startedAt && lastCorrectAt
      ? new Date(lastCorrectAt).getTime() - new Date(startedAt).getTime()
      : null;

  return { team_id: teamId, correct, total: questions.length, elapsed_ms };
}

/**
 * `teamId` is the team that pressed SUBMIT, and it breaks a dead-level tie in
 * their favour — they are the one who ended it.
 */
export async function finishPvpMatch(matchId: string, teamId: string): Promise<FinishResult> {
  const { data: match, error: matchError } = await db
    .from('pvp_matches')
    .select('id, status, started_at, deadline_at')
    .eq('id', matchId)
    .single();

  if (matchError || !match) {
    return { ok: false, status: 404, code: 'MATCH_NOT_FOUND', message: 'Match not found.' };
  }

  const { data: teams, error: teamsError } = await db
    .from('pvp_match_teams')
    .select('team_id')
    .eq('match_id', matchId);

  if (teamsError) throw teamsError;

  const teamIds = (teams ?? []).map((row: { team_id: string }) => row.team_id);
  if (!teamIds.includes(teamId)) {
    return { ok: false, status: 403, code: 'NOT_YOUR_MATCH', message: 'This is not your duel.' };
  }

  // The opponent's browser calls this too, a moment after being told the match
  // is over. Answering with the standing result beats answering with an error.
  if (match.status === 'resolved') {
    const { data: result } = await db
      .from('pvp_results')
      .select('match_id, winner_team_id, loser_team_id')
      .eq('match_id', matchId)
      .maybeSingle();

    if (result) return { ok: true, data: { ...result, idempotent: true } };
    return { ok: false, status: 409, code: 'ALREADY_RESOLVED', message: 'This duel is already over.' };
  }

  if (match.status !== 'live') {
    return { ok: false, status: 409, code: 'MATCH_NOT_LIVE', message: 'This duel is not running.' };
  }

  const { data: questions, error: questionsError } = await db
    .from('pvp_match_questions')
    .select('id, expected_answer')
    .eq('match_id', matchId);

  if (questionsError) throw questionsError;

  const scores: TeamScore[] = [];
  for (const id of teamIds) {
    scores.push(await scoreTeam(matchId, id, match.started_at, questions ?? []));
  }

  const { data, error } = await db.rpc('finish_pvp_match', {
    p_match_id: matchId,
    p_submitter_team_id: teamId,
    p_scores: scores,
    p_actor: `team:${teamId}`,
  });

  if (error) {
    console.error('[pvp] finish failed:', error);
    return { ok: false, status: 409, code: 'FINISH_FAILED', message: error.message ?? 'Could not end the duel.' };
  }

  return { ok: true, data };
}
