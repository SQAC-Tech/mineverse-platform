import { supabaseServer } from '@/lib/supabase/server';
import { mutateTeamResource, ResourceDelta } from '@/lib/gameplay/marketplace/resource-client';

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

  // Note: For "ignore", if they don't have enough to pay the penalty, mutateTeamResource might fail with INSUFFICIENT_FUNDS
  // depending on Dev 4's implementation. We'll assume the RPC handles it gracefully or throws 422.
  const res = await mutateTeamResource({
    teamId,
    delta,
    sourceType: 'choice_decision',
    idempotencyKey,
    reason: `Selected ${option} for ${choiceKey}`
  });

  if (!res.success) {
    return res;
  }

  const { data, error } = await supabaseServer
    .from('choice_decisions')
    .insert({
      team_id: teamId,
      choice_key: choiceKey,
      option_selected: option,
      ledger_id: res.ledgerId
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') { // Unique constraint violation
      return { success: false, error: 'ALREADY_DECIDED', message: 'You have already made a decision for this event.' };
    }
    console.error('Failed to record choice decision:', error);
  }

  return { success: true, data };
}
