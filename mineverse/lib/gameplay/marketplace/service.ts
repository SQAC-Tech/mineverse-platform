import { supabaseServer } from '@/lib/supabase/server';
import { ResourceDelta } from '@/lib/gameplay/marketplace/resource-client';

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

  // The ledger write and the transaction record share one database transaction, so a
  // failed insert can never leave the team charged for an item it does not own.
  const { data, error } = await supabaseServer.rpc('dev3_buy_marketplace_item', {
    p_team_id: teamId,
    p_item_type: itemType,
    p_cost_emerald: config.costEmerald,
    p_delta: delta as never,
    p_idempotency_key: idempotencyKey,
    p_reason: `Purchased ${itemType}`,
  });

  if (error) {
    if (error.message?.includes('insufficient')) {
      return { success: false, error: 'INSUFFICIENT_FUNDS', message: 'Not enough resources.' };
    }
    if (error.message?.includes('idempotency') || error.code === '23505') {
      return { success: false, error: 'CONFLICT', message: 'Action already performed.' };
    }
    console.error('Failed to purchase marketplace item:', error);
    return { success: false, error: 'SERVER_ERROR', message: 'Failed to complete purchase.' };
  }

  return { success: true, data };
}
