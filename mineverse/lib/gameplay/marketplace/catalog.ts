/**
 * The Villager Merchant's stock, as plain data with no database import.
 *
 * There were two copies of these prices: `MARKETPLACE_ITEMS` in service.ts, which
 * charges the team, and a private `ITEMS` array in MarketplaceStore.tsx, which
 * told the team what it would be charged. Nothing kept them equal, so a price
 * change in one place would have quoted one number and taken another — the same
 * class of drift as the editor and the grader disagreeing about a test case.
 *
 * This file is the one table. It must stay free of anything that touches the
 * database: the store and the rulebook are client components and pulling
 * `service.ts` in would drag the service-role key into the browser bundle.
 */

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

export interface MarketplaceEntry {
  item: MarketplaceItem;
  label: string;
  description: string;
  costEmerald: number;
  /** Resources credited on purchase. Absent for the consumables. */
  resourceReward?: { wood?: number; stone?: number; iron?: number; gold?: number; diamond?: number };
}

export const MARKETPLACE_CATALOG: Record<MarketplaceItem, MarketplaceEntry> = {
  hint: {
    item: 'hint',
    label: 'Hint',
    description: 'Explains the approach for a question — never the answer.',
    costEmerald: 8,
  },
  wood_bundle: {
    item: 'wood_bundle',
    label: 'Wood Bundle',
    description: '+15 Wood',
    costEmerald: 5,
    resourceReward: { wood: 15 },
  },
  stone_bundle: {
    item: 'stone_bundle',
    label: 'Stone Bundle',
    description: '+15 Stone',
    costEmerald: 6,
    resourceReward: { stone: 15 },
  },
  iron_bundle: {
    item: 'iron_bundle',
    label: 'Iron Bundle',
    description: '+10 Iron',
    costEmerald: 10,
    resourceReward: { iron: 10 },
  },
  gold_bundle: {
    item: 'gold_bundle',
    label: 'Gold Bundle',
    description: '+8 Gold',
    costEmerald: 12,
    resourceReward: { gold: 8 },
  },
  diamond_bundle: {
    item: 'diamond_bundle',
    label: 'Diamond Bundle',
    description: '+15 Diamond',
    costEmerald: 20,
    resourceReward: { diamond: 15 },
  },
  totem_of_undying: {
    item: 'totem_of_undying',
    label: 'Totem of Undying',
    description: 'Absorbs one guardian defeat penalty.',
    costEmerald: 15,
  },
  guardian_retry_token: {
    item: 'guardian_retry_token',
    label: 'Guardian Retry Token',
    description: 'Skips a guardian cooldown once.',
    costEmerald: 12,
  },
  revival_potion: {
    item: 'revival_potion',
    label: 'Revival Potion',
    description: 'Recovers 50% of the last guardian loss.',
    costEmerald: 10,
  },
  strength_potion: {
    item: 'strength_potion',
    label: 'Strength Potion',
    description: '+20% on your next guardian victory.',
    costEmerald: 10,
  },
};

/** Display order for the store and the rulebook: bundles first, then consumables. */
export const MARKETPLACE_ORDER: readonly MarketplaceItem[] = [
  'wood_bundle',
  'stone_bundle',
  'iron_bundle',
  'gold_bundle',
  'diamond_bundle',
  'hint',
  'totem_of_undying',
  'guardian_retry_token',
  'revival_potion',
  'strength_potion',
];

/** Items that are held in inventory and spent later, rather than paying out at once. */
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

/** The catalog in display order, for anything that renders a list. */
export function marketplaceList(): MarketplaceEntry[] {
  return MARKETPLACE_ORDER.map((item) => MARKETPLACE_CATALOG[item]);
}
