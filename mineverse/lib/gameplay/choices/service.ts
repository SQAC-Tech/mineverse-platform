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
