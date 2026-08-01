import { supabaseServer } from '@/lib/supabase/server';
import { mutateTeamResource } from '@/lib/gameplay/marketplace/resource-client';
import { Dev3GuardianBattle, Dev3ItemUse } from '@/lib/gameplay/types';

export type GuardianName = 'forest_guardian' | 'skeleton_archer' | 'blaze_guardian';

export interface GuardianConfig {
  name: GuardianName;
  round_id: number;
  victoryReward: { wood?: number; stone?: number; iron?: number; gold?: number; emerald?: number };
  defeatPenalty: { wood?: number; stone?: number; iron?: number; gold?: number };
}

export const GUARDIANS: Record<GuardianName, GuardianConfig> = {
  forest_guardian: {
    name: 'forest_guardian',
    round_id: 1,
    victoryReward: { wood: 25, stone: 10, emerald: 3 },
    defeatPenalty: { wood: -8, stone: -3 },
  },
  skeleton_archer: {
    name: 'skeleton_archer',
    round_id: 2,
    victoryReward: { iron: 20, stone: 15, emerald: 3 },
    defeatPenalty: { iron: -10, stone: -10 },
  },
  blaze_guardian: {
    name: 'blaze_guardian',
    round_id: 3,
    victoryReward: { iron: 12, gold: 10, emerald: 2 },
    defeatPenalty: { iron: -8, gold: -5 },
  },
};

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

export async function getGuardianStatus(teamId: string, guardianName: GuardianName) {
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
  return (data as unknown as Dev3GuardianBattle) || null;
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

  const attemptNumber = latestAttempt ? latestAttempt.attempt_number + 1 : 1;

  const { data, error } = await supabaseServer
    .from('guardian_battles')
    .insert({
      team_id: teamId,
      round_id: guardian.round_id,
      guardian_name: guardianName,
      attempt_number: attemptNumber,
      status: 'started',
      question_set_version: 'v1', 
    })
    .select()
    .single();

  if (error) throw error;

  if (bypassCooldownWith) {
    await consumeItemUse(bypassCooldownWith, data.id);
  }

  return { success: true, data: data as unknown as Dev3GuardianBattle };
}

export async function resolveGuardianBattle(
  teamId: string, 
  guardianName: GuardianName, 
  idempotencyKey: string
) {
  const guardian = GUARDIANS[guardianName];
  if (!guardian) throw new Error('Invalid guardian');

  const latestAttempt = await getGuardianStatus(teamId, guardianName);
  
  if (!latestAttempt || latestAttempt.status !== 'started') {
    return { success: false, error: 'INVALID_STATE', message: 'No active battle to resolve.' };
  }

  // 1. Determine if won or lost by querying Dev 4 submissions
  // DEPENDENCY: Dev 4 questions schema (e.g., identifying guardian questions)
  // Assuming a hypothetical check for all correct answers within 7 mins:
  // eslint-disable-next-line prefer-const -- reassigned once Dev 4 grading is wired below
  let won = false;
  /* 
  const { data: subs } = await supabaseServer.from('submissions').select('score, submitted_at').eq('team_id', teamId)...
  if (subs && subs.length === 3 && subs.every(s => s.score === 100)) won = true;
  */
  // For now, explicitly throw blocked or mock false
  // raise exception or return mock for testing
  // won = false; // Mocking

  const now = new Date();
  const retryAfter = won ? null : new Date(now.getTime() + 3 * 60 * 1000); // 3 min cooldown

  let ledgerId = null;
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
    ledgerId = res.ledgerId;

    if (strengthUse) await consumeItemUse(strengthUse.id, latestAttempt.id);

  } else {
    // A totem prevents one defeat penalty and is consumed when it does.
    const totemUse = await findActiveItemUse(teamId, 'totem_of_undying');
    appliedTotem = !!totemUse;

    if (!appliedTotem) {
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
        ledgerId = res.ledgerId;
      }
    } else {
      await consumeItemUse(totemUse.id, latestAttempt.id);
    }
  }

  // Finalize attempt
  const { data, error } = await supabaseServer
    .from('guardian_battles')
    .update({
      status: won ? 'won' : 'lost',
      completed_at: now.toISOString(),
      retry_after: retryAfter?.toISOString(),
      [won ? 'reward_ledger_id' : 'penalty_ledger_id']: ledgerId,
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
