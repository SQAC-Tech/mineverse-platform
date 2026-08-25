import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireDay2Access, Day2Session } from '@/lib/day2/access/guard';
import { supabaseServer } from '@/lib/supabase/server';
import { BOSS_QUESTION_COUNT, BOSS_DURATION_SECONDS } from '@/lib/gameplay/boss/config';

/**
 * Opens the Ender Dragon fight, or hands back the one already open.
 *
 * ## Where the questions come from
 *
 * `screening_questions` — the same fifty multiple-choice questions the entry
 * screening was run on. They are read from that table rather than copied into
 * `questions`, so there is one row per question in the database and no second
 * copy to drift.
 *
 * Twenty-five of the fifty, chosen by a hash of the team and the question, so a
 * team gets the same paper on every reload and two teams do not get the same
 * one. `correct_index` is never selected — the payload is handed to the browser,
 * and the answer key must not travel with it.
 *
 * ## One attempt
 *
 * The fight is mandatory, so every qualified team takes it. That is exactly why
 * it cannot be re-entered: a team allowed a second go after seeing the paper
 * would be a team that failed the first on purpose.
 */
export async function POST() {
  const guardResult = await requireDay2Access();
  if (guardResult instanceof NextResponse) return guardResult;
  const session = guardResult as Day2Session;

  const { data: repair } = await supabaseServer
    .from('day2_portal_repair')
    .select('team_id')
    .eq('team_id', session.team_id)
    .maybeSingle();

  if (!repair) {
    return NextResponse.json({ success: false, error: 'PORTAL_NOT_REPAIRED' }, { status: 400 });
  }

  const { data: craftLog } = await supabaseServer
    .from('crafting_log')
    .select('id')
    .eq('team_id', session.team_id)
    .eq('item', 'diamond_pickaxe')
    .maybeSingle();

  if (!craftLog) {
    return NextResponse.json({ success: false, error: 'MISSING_DIAMOND_PICKAXE' }, { status: 400 });
  }

  const { data: access } = await supabaseServer
    .from('team_round_access')
    .select('is_locked')
    .eq('team_id', session.team_id)
    .eq('round_id', 5)
    .maybeSingle();

  if (!access || access.is_locked) {
    return NextResponse.json({ success: false, error: 'ROUND_5_NOT_ACTIVE' }, { status: 400 });
  }

  const { data: lastAttempt } = await supabaseServer
    .from('day2_final_boss_attempts')
    .select('id, status, question_payload')
    .eq('team_id', session.team_id)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastAttempt) {
    // Reload, refresh, second tab: the same fight, with whatever time is left.
    if (lastAttempt.status === 'active') {
      return NextResponse.json({ success: true, payload: lastAttempt.question_payload });
    }
    // Won or lost, it is over. Both are terminal; there is no cooldown to serve.
    return NextResponse.json(
      { success: false, error: 'ALREADY_ATTEMPTED', outcome: lastAttempt.status },
      { status: 400 },
    );
  }

  const { data: pool, error: poolError } = await supabaseServer
    .from('screening_questions')
    // No `correct_index`. This payload is handed to the browser.
    .select('id, prompt, options, topic, difficulty');

  if (poolError || !pool || pool.length < BOSS_QUESTION_COUNT) {
    console.error('Final boss: question pool unusable', poolError?.message, pool?.length);
    return NextResponse.json({ success: false, error: 'NOT_AVAILABLE' }, { status: 503 });
  }

  /**
   * Stable per team, different across teams — the same trick `pvp_matchmake`
   * uses to pick a duel pack. Sorting by a hash of (team, question) is a
   * shuffle that survives a reload without anything being written down.
   */
  const paper = [...pool]
    .sort((a, b) => pick(session.team_id, a.id).localeCompare(pick(session.team_id, b.id)))
    .slice(0, BOSS_QUESTION_COUNT);

  const startedAt = new Date();
  const deadlineAt = new Date(startedAt.getTime() + BOSS_DURATION_SECONDS * 1000);

  const questionPayload = {
    source: 'screening_questions',
    started_at: startedAt.toISOString(),
    deadline_at: deadlineAt.toISOString(),
    duration_seconds: BOSS_DURATION_SECONDS,
    questions: paper.map((q, index) => ({
      id: q.id,
      order: index + 1,
      prompt: q.prompt,
      options: q.options,
      topic: q.topic,
      difficulty: q.difficulty,
    })),
  };

  const { data: attempt, error: attemptError } = await supabaseServer
    .from('day2_final_boss_attempts')
    .insert({
      team_id: session.team_id,
      status: 'active',
      started_at: startedAt.toISOString(),
      question_payload: questionPayload,
    })
    .select('question_payload')
    .single();

  if (attemptError) {
    console.error('Final boss: could not open the fight', attemptError.message);
    return NextResponse.json({ success: false, error: 'START_FAILED' }, { status: 500 });
  }

  return NextResponse.json({ success: true, payload: attempt.question_payload });
}

function pick(teamId: string, questionId: string): string {
  return createHash('md5').update(`${teamId}:${questionId}`).digest('hex');
}
