import { supabaseServer } from '@/lib/supabase/server';
import { buildEligibilitySnapshot } from '@/lib/gameplay/qualification/service';
import { checkDeterministicAnswer } from '@/lib/gameplay/grading/deterministic';

const db = supabaseServer as any;

export const PVP_ROUND_ID = 3;

export interface CreatePvpMatchParams {
  teamIds: [string, string];
  packId: string;
  adminId: string;
  durationSeconds?: number;
  replayOfMatchId?: string | null;
}

/**
 * Creates a private Round 3 duel between two organizer-selected teams and seals a
 * question-pack snapshot onto the match. This is a durable match record, not a
 * bracket node: there is no queue, no auto-pairing, and no public join route.
 */
export async function createPvpMatch(params: CreatePvpMatchParams) {
  const [teamA, teamB] = params.teamIds;

  if (teamA === teamB) {
    return { ok: false as const, status: 400, code: 'DUPLICATE_TEAM', message: 'Select two different teams.' };
  }

  const { data: round, error: roundError } = await db
    .from('rounds')
    .select('id, status')
    .eq('id', PVP_ROUND_ID)
    .single();

  if (roundError || !round) {
    return { ok: false as const, status: 404, code: 'ROUND_NOT_FOUND', message: 'Round 3 not found.' };
  }

  if (round.status !== 'active') {
    return { ok: false as const, status: 409, code: 'ROUND_NOT_ACTIVE', message: 'Round 3 is not active.' };
  }

  // Iron Armor + the mandatory Blaze Guardian gate PvP entry. The PvP-win part of
  // the eligibility snapshot is not required here — that is what this match decides.
  const eligibility = await buildEligibilitySnapshot(params.teamIds, { lenient: true });

  for (const teamId of params.teamIds) {
    const entry = eligibility.get(teamId);
    if (!entry?.hasIronArmor) {
      return { ok: false as const, status: 422, code: 'MISSING_IRON_ARMOR', message: `Team ${teamId} has not crafted Iron Armor.` };
    }
    if (!entry?.hasBlazeGuardian) {
      return { ok: false as const, status: 422, code: 'MISSING_BLAZE_GUARDIAN', message: `Team ${teamId} has not defeated the Blaze Guardian.` };
    }
  }

  // A team already holding a final result cannot fight again.
  const { data: settled, error: settledError } = await db
    .from('pvp_results')
    .select('winner_team_id, loser_team_id')
    .or(
      `winner_team_id.in.(${params.teamIds.join(',')}),loser_team_id.in.(${params.teamIds.join(',')})`,
    );

  if (settledError) throw settledError;
  if ((settled ?? []).length > 0) {
    return { ok: false as const, status: 409, code: 'ALREADY_RESOLVED', message: 'A selected team already has a final PvP result.' };
  }

  const { data: pack, error: packError } = await db
    .from('questions')
    .select('id, type, prompt, content, language_options, time_limit_seconds, expected_answer, order_index')
    .eq('round_id', PVP_ROUND_ID)
    .eq('type', 'pvp')
    .order('order_index', { ascending: true });

  if (packError) throw packError;
  if ((pack ?? []).length === 0) {
    return { ok: false as const, status: 422, code: 'PACK_NOT_APPROVED', message: 'No approved PvP question pack is seeded.' };
  }

  const { data: match, error: matchError } = await db
    .from('pvp_matches')
    .insert({
      round_id: PVP_ROUND_ID,
      pack_id: params.packId,
      status: 'draft',
      duration_seconds: params.durationSeconds ?? 600,
      created_by: params.adminId,
      replay_of_match_id: params.replayOfMatchId ?? null,
    })
    .select()
    .single();

  if (matchError) throw matchError;

  try {
    for (const teamId of params.teamIds) {
      const entry = eligibility.get(teamId)!;
      const { error: teamError } = await db.from('pvp_match_teams').insert({
        match_id: match.id,
        team_id: teamId,
        status: 'pending',
        eligibility_snapshot: {
          iron_armor: entry.hasIronArmor,
          blaze_guardian: entry.hasBlazeGuardian,
          captured_at: new Date().toISOString(),
        },
      });

      if (teamError) {
        if (teamError.code === '23505') {
          throw Object.assign(new Error('TEAM_IN_ACTIVE_MATCH'), { code: 'TEAM_IN_ACTIVE_MATCH' });
        }
        throw teamError;
      }
    }

    // Sealed snapshot: expected answers are copied server-side and never served.
    const snapshot = (pack ?? []).map((question: any, index: number) => ({
      match_id: match.id,
      source_question_id: question.id,
      display_order: index + 1,
      type: question.type,
      prompt: question.prompt,
      content: question.content ?? {},
      language_options: question.language_options ?? [],
      time_limit_seconds: question.time_limit_seconds,
      expected_answer: question.expected_answer,
    }));

    const { error: snapshotError } = await db.from('pvp_match_questions').insert(snapshot);
    if (snapshotError) throw snapshotError;
  } catch (error: any) {
    // Roll the draft back so a half-built match cannot be started.
    await db.from('pvp_matches').delete().eq('id', match.id);

    if (error?.code === 'TEAM_IN_ACTIVE_MATCH') {
      return {
        ok: false as const,
        status: 409,
        code: 'TEAM_IN_ACTIVE_MATCH',
        message: 'A selected team is already in an unresolved match.',
      };
    }
    throw error;
  }

  return { ok: true as const, data: { match_id: match.id, status: 'draft', teams: params.teamIds, questions: (pack ?? []).length } };
}

export async function startPvpMatch(matchId: string, adminId: string) {
  const { data, error } = await db.rpc('start_pvp_match', { p_match_id: matchId, p_admin_id: adminId });

  if (error) {
    if (error.message?.includes('not found')) {
      return { ok: false as const, status: 404, code: 'MATCH_NOT_FOUND', message: 'Match not found.' };
    }
    return { ok: false as const, status: 409, code: 'INVALID_STATE', message: error.message };
  }

  return { ok: true as const, data };
}

export async function voidPvpMatch(matchId: string, adminId: string, reason: string) {
  const { data, error } = await db.rpc('void_pvp_match', {
    p_match_id: matchId,
    p_admin_id: adminId,
    p_reason: reason,
  });

  if (error) {
    if (error.message?.includes('not found')) {
      return { ok: false as const, status: 404, code: 'MATCH_NOT_FOUND', message: 'Match not found.' };
    }
    return { ok: false as const, status: 409, code: 'INVALID_STATE', message: error.message };
  }

  return { ok: true as const, data };
}

/**
 * Validates a team's submitted answers against the sealed pack and, when every
 * required answer is correct, stamps the server-side completion time. Completion
 * is recorded by the server only — a client never reports its own finish time.
 */
export async function evaluatePvpCompletion(matchId: string, teamId: string) {
  const { data: match, error: matchError } = await db
    .from('pvp_matches')
    .select('id, status, started_at, deadline_at')
    .eq('id', matchId)
    .single();

  if (matchError || !match) {
    return { ok: false as const, status: 404, code: 'MATCH_NOT_FOUND', message: 'Match not found.' };
  }

  if (match.status !== 'live') {
    return { ok: false as const, status: 409, code: 'MATCH_NOT_LIVE', message: 'Match is not live.' };
  }

  const { data: questions, error: questionsError } = await db
    .from('pvp_match_questions')
    .select('id, expected_answer')
    .eq('match_id', matchId);

  if (questionsError) throw questionsError;

  const { data: submissions, error: submissionsError } = await db
    .from('pvp_match_submissions')
    .select('id, match_question_id, answer_text, revision, submitted_at')
    .eq('match_id', matchId)
    .eq('team_id', teamId)
    .order('revision', { ascending: true });

  if (submissionsError) throw submissionsError;

  // Latest revision per question is the one that counts.
  const latest = new Map<string, any>();
  for (const submission of submissions ?? []) latest.set(submission.match_question_id, submission);

  let correct = 0;
  let lastAnswerAt: string | null = null;

  for (const question of questions ?? []) {
    const submission = latest.get(question.id);
    if (!submission) continue;

    const isCorrect = checkDeterministicAnswer(submission.answer_text, question.expected_answer) === true;

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
      if (!lastAnswerAt || submission.submitted_at > lastAnswerAt) lastAnswerAt = submission.submitted_at;
    }
  }

  const total = (questions ?? []).length;
  const completed = total > 0 && correct === total;

  if (!completed) {
    return { ok: true as const, data: { completed: false, correct, total } };
  }

  const withinDeadline = !match.deadline_at || (lastAnswerAt ?? '') <= match.deadline_at;
  if (!withinDeadline) {
    return { ok: true as const, data: { completed: false, correct, total, late: true } };
  }

  const elapsedMs =
    match.started_at && lastAnswerAt
      ? new Date(lastAnswerAt).getTime() - new Date(match.started_at).getTime()
      : null;

  const { error: updateError } = await db
    .from('pvp_match_teams')
    .update({ completion_at: lastAnswerAt, elapsed_ms: elapsedMs })
    .eq('match_id', matchId)
    .eq('team_id', teamId)
    .is('completion_at', null);

  if (updateError) throw updateError;

  return { ok: true as const, data: { completed: true, correct, total, elapsed_ms: elapsedMs } };
}

export async function resolvePvpMatch(matchId: string, adminId: string) {
  const { data, error } = await db.rpc('resolve_pvp_match', { p_match_id: matchId, p_admin_id: adminId });

  if (error) {
    if (error.message?.includes('not found')) {
      return { ok: false as const, status: 404, code: 'MATCH_NOT_FOUND', message: 'Match not found.' };
    }
    return { ok: false as const, status: 409, code: 'INVALID_STATE', message: error.message };
  }

  return { ok: true as const, data };
}

/** Operational view for admins: both teams' safe status, never answer keys. */
export async function getPvpMatchForAdmin(matchId: string) {
  const { data: match, error } = await db
    .from('pvp_matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (error || !match) {
    return { ok: false as const, status: 404, code: 'MATCH_NOT_FOUND', message: 'Match not found.' };
  }

  const { data: teams, error: teamsError } = await db
    .from('pvp_match_teams')
    .select('team_id, status, completion_at, elapsed_ms, outcome, eligibility_snapshot, teams(team_code, team_name)')
    .eq('match_id', matchId);

  if (teamsError) throw teamsError;

  const { count, error: countError } = await db
    .from('pvp_match_questions')
    .select('id', { count: 'exact', head: true })
    .eq('match_id', matchId);

  if (countError) throw countError;

  return {
    ok: true as const,
    data: {
      ...match,
      question_count: count ?? 0,
      teams: teams ?? [],
      server_time: new Date().toISOString(),
    },
  };
}

export async function listPvpMatches() {
  const { data, error } = await db
    .from('pvp_matches')
    .select('id, status, pack_id, started_at, deadline_at, resolved_at, winner_team_id, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}
