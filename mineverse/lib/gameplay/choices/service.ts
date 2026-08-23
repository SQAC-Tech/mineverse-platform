import { supabaseServer } from '@/lib/supabase/server';
import { ResourceDelta } from '@/lib/gameplay/marketplace/resource-client';

export type ChoiceKey = 'ancient_shrine' | 'piglin_merchant';
export type ChoiceOption = 'option_a' | 'option_b' | 'ignore';

export interface ChoiceConfig {
  key: ChoiceKey;
  options: Record<ChoiceOption, ResourceDelta>;
}

export const CHOICES: Record<ChoiceKey, ChoiceConfig> = {
  ancient_shrine: {
    key: 'ancient_shrine',
    options: {
      option_a: { wood: -10, emerald: 2 },
      option_b: { iron: -5, stone: 15 },
      ignore: { wood: -5, stone: -3 },
    }
  },
  piglin_merchant: {
    key: 'piglin_merchant',
    options: {
      option_a: { gold: -10, emerald: 3 },
      option_b: { emerald: -4, gold: 18 },
      ignore: { gold: -5 },
    }
  }
};

/**
 * The round each choice belongs to.
 *
 * The Ancient Shrine is the Cave Biome's trader, the Piglin Merchant the
 * Mountain's. Kept here rather than in the panel that draws them, because the
 * route deciding whether a trade is allowed needs the same answer.
 */
export const CHOICE_ROUND: Record<ChoiceKey, number> = {
  ancient_shrine: 2,
  piglin_merchant: 3,
};

/**
 * Whether a choice event is open for trading.
 *
 * The brief says the Shrine "appears after completion of the Cave Biome" — it
 * is a between-rounds decision, made with the round's takings in hand. So the
 * test is that its round has *started*, not that it is currently running: once
 * the Cave Biome opens the Shrine stays available for the rest of the event.
 *
 * This matters because the trade now happens from the dashboard. The select
 * route used to require `verifyTeamRoundAccess`, which demands an active round
 * and attendance for it — so the one moment the brief describes, after the
 * round closed, was the one moment a team could not trade.
 */
export async function isChoiceOpen(choiceKey: ChoiceKey): Promise<boolean> {
  const roundId = CHOICE_ROUND[choiceKey];
  if (!roundId) return false;

  const { data } = await supabaseServer
    .from('rounds')
    .select('status')
    .eq('id', roundId)
    .maybeSingle();

  return data?.status === 'active' || data?.status === 'completed';
}

export async function makeChoiceDecision(teamId: string, choiceKey: ChoiceKey, option: ChoiceOption, idempotencyKey: string) {
  const config = CHOICES[choiceKey];
  if (!config) return { success: false, error: 'INVALID_CHOICE', message: 'Invalid choice event.' };

  const delta = config.options[option];
  if (!delta) return { success: false, error: 'INVALID_OPTION', message: 'Invalid option selected.' };

  // The RPC checks the one-decision-per-choice rule inside the same transaction as
  // the ledger write, so a repeat attempt under a new idempotency key cannot charge
  // the team a second time.
  const { data, error } = await supabaseServer.rpc('dev3_make_choice_decision', {
    p_team_id: teamId,
    p_choice_key: choiceKey,
    p_option_selected: option,
    p_delta: delta as never,
    p_idempotency_key: idempotencyKey,
    p_reason: `Selected ${option} for ${choiceKey}`,
  });

  if (error) {
    if (error.message?.includes('insufficient')) {
      return { success: false, error: 'INSUFFICIENT_FUNDS', message: 'Not enough resources.' };
    }
    if (error.message?.includes('idempotency') || error.code === '23505') {
      return { success: false, error: 'CONFLICT', message: 'Action already performed.' };
    }
    console.error('Failed to record choice decision:', error);
    return { success: false, error: 'SERVER_ERROR', message: 'Failed to record decision.' };
  }

  const result = data as unknown as { idempotent?: boolean } | null;

  if (result?.idempotent) {
    return { success: false, error: 'ALREADY_DECIDED', message: 'You have already made a decision for this event.' };
  }

  return { success: true, data: result };
}
