import { supabaseServer } from '@/lib/supabase/server';
import { ResourceDelta } from '@/lib/gameplay/marketplace/resource-client';
import { MARKETPLACE_CATALOG, type MarketplaceItem } from '@/lib/gameplay/marketplace/catalog';

/*
 * Prices, names and payouts now live in `catalog.ts`, which has no database
 * import so the store and the rulebook can read the same numbers this route
 * charges. These re-exports keep the existing importers working.
 */
export type { MarketplaceItem } from '@/lib/gameplay/marketplace/catalog';
export { CONSUMABLE_ITEMS, isConsumableItem } from '@/lib/gameplay/marketplace/catalog';

export interface MarketplaceConfig {
  item: MarketplaceItem;
  costEmerald: number;
  resourceReward?: ResourceDelta;
}

export const MARKETPLACE_ITEMS: Record<MarketplaceItem, MarketplaceConfig> = MARKETPLACE_CATALOG;

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
