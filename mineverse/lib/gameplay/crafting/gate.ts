import { supabaseServer } from '@/lib/supabase/server';
import { CRAFT_RECIPES, requiredCraftForRound } from './rules';

/**
 * Crafting as a progression requirement, not a suggestion.
 *
 * A biome is opened by the tool that reaches it: the Wooden Pickaxe opens the
 * Cave, the Stone Pickaxe opens the Mountain. Every recipe has always declared
 * that in `unlock_round_id`, and the crafting prompt has always asked for it —
 * but nothing checked it at the door. A team could skip the prompt and walk
 * straight into Round 2 with an empty inventory, which made the whole earn-and-
 * craft loop optional and the resources that fund it decorative.
 *
 * Checked against `crafting_log`, which is what `craft_team_item` writes and
 * what the dashboard already reads, so there is one answer to "have they
 * crafted it" rather than two that can disagree.
 */
export interface CraftGateResult {
  ok: boolean;
  /** The item they still need, when blocked. */
  item?: string;
  /** Sentence for the participant, naming what to craft. */
  message?: string;
}

export async function craftGate(teamId: string, roundId: number): Promise<CraftGateResult> {
  const required = requiredCraftForRound(roundId);
  if (!required) return { ok: true };

  const { data, error } = await supabaseServer
    .from('crafting_log')
    .select('item')
    .eq('team_id', teamId)
    .eq('item', required)
    .maybeSingle();

  /**
   * A failed lookup opens the gate rather than closing it.
   *
   * This runs on the path into a live round. If the query breaks mid-event, the
   * choice is between letting an ungated team in and locking every team out of
   * the round — and only one of those is recoverable while the clock runs.
   */
  if (error) {
    console.error(`[crafting] gate lookup failed for team ${teamId} round ${roundId}:`, error);
    return { ok: true };
  }

  if (data) return { ok: true };

  const label = CRAFT_RECIPES[required].label;
  return {
    ok: false,
    item: required,
    message: `Craft the ${label} before entering this biome. Open the crafting bench on your dashboard.`,
  };
}
