import { supabaseServer } from '@/lib/supabase/server';
import { mutateTeamResource, ResourceDelta } from '@/lib/gameplay/marketplace/resource-client';

export type MarketplaceItem = 
  | 'hint' 
  | 'wood_bundle' 
  | 'stone_bundle' 
  | 'iron_bundle' 
  | 'gold_bundle' 
  | 'diamond_bundle' 
  | 'totem_of_undying' 
  | 'guardian_retry_token' 
  | 'revival_potion' 
  | 'strength_potion';

export interface MarketplaceConfig {
  item: MarketplaceItem;
  costEmerald: number;
  resourceReward?: ResourceDelta;
}

export const MARKETPLACE_ITEMS: Record<MarketplaceItem, MarketplaceConfig> = {
  hint: { item: 'hint', costEmerald: 8 },
  wood_bundle: { item: 'wood_bundle', costEmerald: 5, resourceReward: { wood: 15 } },
  stone_bundle: { item: 'stone_bundle', costEmerald: 6, resourceReward: { stone: 15 } },
  iron_bundle: { item: 'iron_bundle', costEmerald: 10, resourceReward: { iron: 10 } },
  gold_bundle: { item: 'gold_bundle', costEmerald: 12, resourceReward: { gold: 8 } },
  diamond_bundle: { item: 'diamond_bundle', costEmerald: 20, resourceReward: { diamond: 15 } },
  totem_of_undying: { item: 'totem_of_undying', costEmerald: 15 },
  guardian_retry_token: { item: 'guardian_retry_token', costEmerald: 12 },
  revival_potion: { item: 'revival_potion', costEmerald: 10 },
  strength_potion: { item: 'strength_potion', costEmerald: 10 },
};

export const CONSUMABLE_ITEMS: readonly MarketplaceItem[] = [
  'hint',
  'totem_of_undying',
  'guardian_retry_token',
  'revival_potion',
  'strength_potion',
];

export function isConsumableItem(itemType: string): itemType is MarketplaceItem {
  return (CONSUMABLE_ITEMS as readonly string[]).includes(itemType);
}

export async function purchaseMarketplaceItem(teamId: string, itemType: MarketplaceItem, idempotencyKey: string) {
  const config = MARKETPLACE_ITEMS[itemType];
  if (!config) return { success: false, error: 'INVALID_ITEM', message: 'Invalid marketplace item.' };

  // Calculate net delta
  const delta: ResourceDelta = { emerald: -config.costEmerald };
  if (config.resourceReward) {
    if (config.resourceReward.wood) delta.wood = config.resourceReward.wood;
    if (config.resourceReward.stone) delta.stone = config.resourceReward.stone;
    if (config.resourceReward.iron) delta.iron = config.resourceReward.iron;
    if (config.resourceReward.gold) delta.gold = config.resourceReward.gold;
    if (config.resourceReward.diamond) delta.diamond = config.resourceReward.diamond;
  }

  // Deduct emeralds and add rewards atomically via Dev 4 RPC wrapper
  const res = await mutateTeamResource({
    teamId,
    delta,
    sourceType: 'marketplace_purchase',
    idempotencyKey,
    reason: `Purchased ${itemType}`
  });

  if (!res.success) {
    return res;
  }

  // Record transaction
  const { data, error } = await supabaseServer
    .from('transactions')
    .insert({
      team_id: teamId,
      item_type: itemType,
      cost_emerald: config.costEmerald,
      ledger_id: res.ledgerId
    })
    .select()
    .single();

  if (error) {
    // If inserting transaction fails but ledger succeeded, it's an edge case. 
    // Ideally they share the transaction, but we are separated by the RPC.
    console.error('Failed to record transaction after resource mutation:', error);
  }

  return { success: true, data };
}
