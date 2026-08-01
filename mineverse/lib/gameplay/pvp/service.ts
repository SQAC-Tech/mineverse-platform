import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';

const db = supabaseServer as any;

export const pvpSubmissionSchema = z.object({
  match_question_id: z.string().uuid(),
  answer_text: z.string().trim().min(1).max(20000),
  idempotency_key: z.string().uuid(),
});

export function serializeSafePvpQuestion(question: any) {
  return {
    id: question.id,
    display_order: question.display_order,
    type: question.type,
    prompt: question.prompt,
    content: question.content ?? {},
    language_options: question.language_options ?? [],
    time_limit_seconds: question.time_limit_seconds ?? null,
  };
}

function isMissingTable(error: unknown) {
  const err = error as { code?: string; message?: string } | null;
  return err?.code === '42P01' || err?.message?.includes('does not exist');
}

export async function getCurrentPvpMatch(teamId: string) {
  try {
    const { data: teamRows, error: teamError } = await db
      .from('pvp_match_teams')
      .select('match_id, team_id, status, completion_at, outcome')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (teamError) {
      if (isMissingTable(teamError)) return { ok: true as const, data: { available: false, code: 'PVP_UNAVAILABLE' } };
      throw teamError;
    }

    const matchTeam = teamRows?.[0];
    if (!matchTeam) {
      return { ok: true as const, data: { available: true, match: null, server_time: new Date().toISOString() } };
    }

    const { data: match, error: matchError } = await db
      .from('pvp_matches')
      .select('id, status, started_at, deadline_at, resolved_at, winner_team_id, result_summary')
      .eq('id', matchTeam.match_id)
      .single();

    if (matchError) throw matchError;

    const base = {
      available: true,
      server_time: new Date().toISOString(),
      match: {
        id: match.id,
        status: match.status,
        started_at: match.started_at,
        deadline_at: match.deadline_at,
        resolved_at: match.resolved_at,
        own_outcome: matchTeam.outcome ?? null,
        result: match.status === 'resolved'
          ? { won: match.winner_team_id === teamId, summary: match.result_summary ?? null }
          : null,
        questions: [] as unknown[],
        submissions: [] as unknown[],
      },
    };

    if (match.status !== 'live' && match.status !== 'resolved') return { ok: true as const, data: base };

    const { data: questions, error: questionsError } = await db
      .from('pvp_match_questions')
      .select('id, display_order, type, prompt, content, language_options, time_limit_seconds')
      .eq('match_id', match.id)
      .order('display_order', { ascending: true });

    if (questionsError) throw questionsError;

    const { data: submissions, error: submissionsError } = await db
      .from('pvp_match_submissions')
      .select('id, match_question_id, revision, status, submitted_at')
      .eq('match_id', match.id)
      .eq('team_id', teamId);

    if (submissionsError && !isMissingTable(submissionsError)) throw submissionsError;

    base.match.questions = (questions ?? []).map(serializeSafePvpQuestion);
    base.match.submissions = submissions ?? [];

    return { ok: true as const, data: base };
  } catch (error) {
    if (isMissingTable(error)) return { ok: true as const, data: { available: false, code: 'PVP_UNAVAILABLE' } };
    throw error;
  }
}

export async function submitPvpAnswer(teamId: string, payload: z.infer<typeof pvpSubmissionSchema>) {
  try {
    const current = await getCurrentPvpMatch(teamId);
    if (!current.ok || !current.data.available || !current.data.match) {
      const unavailableCode = 'code' in current.data ? current.data.code : 'NO_ACTIVE_MATCH';
      return { ok: false as const, status: 409, code: unavailableCode ?? 'NO_ACTIVE_MATCH', message: 'No active PvP match is available.' };
    }

    const match = current.data.match as any;
    if (match.status !== 'live') {
      return { ok: false as const, status: 403, code: 'PVP_NOT_LIVE', message: 'This PvP match is not live.' };
    }

    if (!match.deadline_at || new Date(match.deadline_at).getTime() <= Date.now()) {
      return { ok: false as const, status: 403, code: 'PVP_DEADLINE_PASSED', message: 'This PvP match deadline has passed.' };
    }

    const questionVisible = match.questions.some((question: any) => question.id === payload.match_question_id);
    if (!questionVisible) {
      return { ok: false as const, status: 403, code: 'QUESTION_NOT_VISIBLE', message: 'Question is not part of your current match.' };
    }

    const { data: existing, error: existingError } = await db
      .from('pvp_match_submissions')
      .select('id, revision, status, submitted_at')
      .eq('team_id', teamId)
      .eq('idempotency_key', payload.idempotency_key)
      .single();

    if (existingError && existingError.code !== 'PGRST116') throw existingError;
    if (existing) return { ok: true as const, data: { ...existing, idempotent: true } };

    const { data: previous, error: previousError } = await db
      .from('pvp_match_submissions')
      .select('revision')
      .eq('match_id', match.id)
      .eq('team_id', teamId)
      .eq('match_question_id', payload.match_question_id)
      .order('revision', { ascending: false })
      .limit(1)
      .single();

    if (previousError && previousError.code !== 'PGRST116') throw previousError;

    const { data, error } = await db
      .from('pvp_match_submissions')
      .insert({
        match_id: match.id,
        team_id: teamId,
        match_question_id: payload.match_question_id,
        answer_text: payload.answer_text,
        revision: previous ? previous.revision + 1 : 1,
        status: 'submitted',
        idempotency_key: payload.idempotency_key,
      })
      .select('id, match_question_id, revision, status, submitted_at')
      .single();

    if (error) throw error;
    return { ok: true as const, data };
  } catch (error) {
    if (isMissingTable(error)) {
      return { ok: false as const, status: 409, code: 'PVP_UNAVAILABLE', message: 'PvP match operations are not available yet.' };
    }
    throw error;
  }
}