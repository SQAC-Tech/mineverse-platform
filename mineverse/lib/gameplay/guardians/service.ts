import { supabaseServer } from '@/lib/supabase/server';
import { mutateTeamResource } from '@/lib/gameplay/marketplace/resource-client';
import { checkDeterministicAnswer } from '@/lib/gameplay/grading/deterministic';
import { questionTitle } from '@/lib/gameplay/questions/contracts';
import { Dev3GuardianBattle, Dev3ItemUse } from '@/lib/gameplay/types';

// The rules themselves are plain data in `./config`, so a client component can read
// the reward numbers without importing this file and its database client.
export { GUARDIANS } from './config';
export type { GuardianName, GuardianConfig } from './config';

import { GUARDIANS, type GuardianName } from './config';

export interface GuardianQuestion {
  id: string;
  order_index: number;
  type: string;
  title: string;
  prompt: string;
  content: unknown;
  language_options: string[];
  time_limit_seconds: number | null;
}

/** Public projection. Expected answers stay server-side. */
function serializeGuardianQuestion(question: any): GuardianQuestion {
  return {
    id: question.id,
    order_index: question.order_index,
    type: question.type,
    // Guardian packs are numbered from 101 up so they never collide with the
    // round's own questions, but the arena should show them as Q1, Q2, Q3.
    title: questionTitle(question),
    prompt: question.prompt,
    content: question.content ?? {},
    language_options: question.language_options ?? [],
    time_limit_seconds: question.time_limit_seconds ?? null,
  };
}

async function loadGuardianQuestions(guardianName: GuardianName, roundId: number, includeAnswers: boolean) {
  const columns = includeAnswers
    ? 'id, order_index, type, prompt, content, language_options, time_limit_seconds, expected_answer'
    : 'id, order_index, type, prompt, content, language_options, time_limit_seconds';

  const { data, error } = await supabaseServer
    .from('questions')
    .select(columns)
    .eq('guardian_name', guardianName)
    .eq('round_id', roundId)
    .order('order_index', { ascending: true });

  if (error) throw error;
  return (data ?? []) as any[];
}

/**
 * How many questions the pack holds, without revealing any of them. A team facing
 * a 7-minute all-or-nothing fight should know whether it is 3 questions or 8
 * before deciding to start, and `total_questions` only exists once an attempt has
 * been made.
 */
export async function countGuardianQuestions(guardianName: GuardianName, roundId: number) {
  const { count, error } = await supabaseServer
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('guardian_name', guardianName)
    .eq('round_id', roundId);

  if (error) throw error;
  return count ?? 0;
}

async function findActiveItemUse(teamId: string, itemType: string): Promise<Dev3ItemUse | null> {
  const { data, error } = await supabaseServer
    .from('item_uses')
    .select('*')
    .eq('team_id', teamId)
    .eq('item_type', itemType)
    .is('consumed_at', null)
    .order('used_at', { ascending: true })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return (data as unknown as Dev3ItemUse) || null;
}

async function consumeItemUse(itemUseId: string, guardianBattleId: string) {
  const { error } = await supabaseServer
    .from('item_uses')
    .update({
      consumed_at: new Date().toISOString(),
      guardian_battle_id: guardianBattleId,
    })
    .eq('id', itemUseId)
    .is('consumed_at', null);

  if (error) throw error;
}

export async function getGuardianStatus(
  teamId: string,
  guardianName: GuardianName,
  options: { includeQuestions?: boolean } = {},
) {
  const { data, error } = await supabaseServer
    .from('guardian_battles')
    .select('*')
    .eq('team_id', teamId)
    .eq('guardian_name', guardianName)
    .order('attempt_number', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  const battle = (data as unknown as Dev3GuardianBattle) || null;

  // Reload during a live battle used to lose the pack: only `start` ever returned
  // the questions, so a refresh or a dropped connection left the team staring at a
  // running clock with nothing to answer, and the attempt could only be thrown
  // away. The pack is already revealed to this team, and expected answers are
  // still never selected, so returning it here reveals nothing new.
  if (options.includeQuestions && battle?.status === 'started') {
    const questions = await loadGuardianQuestions(guardianName, battle.round_id, false);
    return { ...battle, questions: questions.map(serializeGuardianQuestion) };
  }

  return battle;
}

export async function startGuardianBattle(teamId: string, guardianName: GuardianName, roundId: number) {
  const guardian = GUARDIANS[guardianName];
  if (!guardian) throw new Error('Invalid guardian');
  if (guardian.round_id !== roundId) throw new Error('Guardian not in this round');

  const latestAttempt = await getGuardianStatus(teamId, guardianName);

  let bypassCooldownWith: string | null = null;

  if (latestAttempt) {
    if (latestAttempt.status === 'won') {
      return { success: false, error: 'ALREADY_WON', message: 'You have already defeated this guardian.' };
    }
    if (latestAttempt.status === 'started' && !latestAttempt.completed_at) {
       return { success: false, error: 'IN_PROGRESS', message: 'You are currently battling this guardian.' };
    }
    if (latestAttempt.retry_after && new Date(latestAttempt.retry_after) > new Date()) {
      // A retry token bypasses only a valid cooldown, and is consumed only when it does.
      const retryToken = await findActiveItemUse(teamId, 'guardian_retry_token');
      if (!retryToken) {
        return { success: false, error: 'COOLDOWN', message: 'Cooldown is active.', retry_after: latestAttempt.retry_after };
      }
      bypassCooldownWith = retryToken.id;
    }
  }

  const questions = await loadGuardianQuestions(guardianName, guardian.round_id, false);
  if (questions.length === 0) {
    return {
      success: false,
      error: 'NO_QUESTIONS',
      message: 'This guardian has no approved question pack yet.',
    };
  }

  const attemptNumber = latestAttempt ? latestAttempt.attempt_number + 1 : 1;
  const startedAt = new Date();
  const deadlineAt = guardian.timeLimitSeconds
    ? new Date(startedAt.getTime() + guardian.timeLimitSeconds * 1000)
    : null;

  const { data, error } = await supabaseServer
    .from('guardian_battles')
    .insert({
      team_id: teamId,
      round_id: guardian.round_id,
      guardian_name: guardianName,
      attempt_number: attemptNumber,
      status: 'started',
      question_set_version: 'v1',
      started_at: startedAt.toISOString(),
      deadline_at: deadlineAt?.toISOString() ?? null,
      total_questions: questions.length,
    })
    .select()
    .single();

  if (error) throw error;

  if (bypassCooldownWith) {
    await consumeItemUse(bypassCooldownWith, data.id);
  }

  return {
    success: true,
    data: {
      ...(data as unknown as Dev3GuardianBattle),
      questions: questions.map(serializeGuardianQuestion),
      server_time: startedAt.toISOString(),
    },
  };
}

export interface GuardianAnswer {
  question_id: string;
  answer_text: string;
}

export async function resolveGuardianBattle(
  teamId: string,
  guardianName: GuardianName,
  idempotencyKey: string,
  answers: GuardianAnswer[],
) {
  const guardian = GUARDIANS[guardianName];
  if (!guardian) throw new Error('Invalid guardian');

  const latestAttempt = await getGuardianStatus(teamId, guardianName);

  if (!latestAttempt || latestAttempt.status !== 'started') {
    return { success: false, error: 'INVALID_STATE', message: 'No active battle to resolve.' };
  }

  const now = new Date();

  // Grade against the sealed pack. A win requires every question correct and the
  // submission to land inside the server-recorded deadline; a late or short
  // answer set is a loss, never a win.
  const questions = await loadGuardianQuestions(guardianName, guardian.round_id, true);
  const answerByQuestion = new Map(answers.map((entry) => [entry.question_id, entry.answer_text]));

  let correctCount = 0;
  for (const question of questions) {
    const result = checkDeterministicAnswer(answerByQuestion.get(question.id), question.expected_answer);
    if (result === true) correctCount += 1;
  }

  const withinDeadline =
    !latestAttempt.deadline_at || new Date(latestAttempt.deadline_at).getTime() >= now.getTime();

  const won = questions.length > 0 && correctCount === questions.length && withinDeadline;
  const retryAfter = won ? null : new Date(now.getTime() + 3 * 60 * 1000); // 3 min cooldown

  let ledgerId: string | null = null;
  let appliedTotem = false;
  let appliedStrength = false;

  if (won) {
    // A strength potion affects one valid victory only and is consumed by that victory.
    const strengthUse = await findActiveItemUse(teamId, 'strength_potion');
    appliedStrength = !!strengthUse;
    const finalReward = { ...guardian.victoryReward };

    if (appliedStrength) {
      for (const [k, v] of Object.entries(finalReward)) {
        finalReward[k as keyof typeof finalReward] = Math.floor((v as number) * 1.2);
      }
    }

    const res = await mutateTeamResource({
      teamId,
      delta: finalReward,
      sourceType: 'guardian_victory',
      sourceId: latestAttempt.id,
      idempotencyKey,
      reason: `Defeated ${guardianName}`
    });
    if (!res.success) throw new Error(res.message);
    ledgerId = res.ledgerId ?? null;

    if (strengthUse) await consumeItemUse(strengthUse.id, latestAttempt.id);

  } else {
    // A totem prevents one defeat penalty and is consumed when it does.
    const totemUse = await findActiveItemUse(teamId, 'totem_of_undying');
    appliedTotem = !!totemUse;

    if (totemUse) {
      await consumeItemUse(totemUse.id, latestAttempt.id);
    } else {
      const res = await mutateTeamResource({
        teamId,
        delta: guardian.defeatPenalty,
        sourceType: 'guardian_defeat',
        sourceId: latestAttempt.id,
        idempotencyKey,
        reason: `Lost to ${guardianName}`
      });
      if (!res.success) {
        if (res.error !== 'INSUFFICIENT_FUNDS') throw new Error(res.message);
      } else {
        ledgerId = res.ledgerId ?? null;
      }
    }
  }

  // Finalize attempt
  const { data, error } = await supabaseServer
    .from('guardian_battles')
    .update({
      status: won ? 'won' : 'lost',
      completed_at: now.toISOString(),
      retry_after: retryAfter?.toISOString() ?? null,
      score: correctCount,
      correct_count: correctCount,
      total_questions: questions.length,
      reward_ledger_id: won ? ledgerId : null,
      penalty_ledger_id: won ? null : ledgerId,
      consumed_items: [
        ...(appliedTotem ? ['totem_of_undying'] : []),
        ...(appliedStrength ? ['strength_potion'] : [])
      ]
    })
    .eq('id', latestAttempt.id)
    .select()
    .single();

  if (error) throw error;
  return { success: true, data: data as unknown as Dev3GuardianBattle };
}
