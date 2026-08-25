export type ResourceDelta = Partial<Record<'wood' | 'stone' | 'iron' | 'gold' | 'diamond' | 'emerald' | 'obsidian', number>>;

export type CraftItem = 'wooden_pickaxe' | 'stone_pickaxe' | 'iron_armor' | 'diamond_pickaxe';

/**
 * What a team must already hold before a recipe will craft.
 *
 * This is not a display convenience. `craft_team_item` in the database raises
 * `progression requirement missing` for each of these, so a UI that offers a
 * recipe out of order is offering a button that cannot work. Mirrored here only
 * so the UI can grey it out and say why; the database is what enforces it.
 *
 * See supabase/migrations/20260814_01_remove_structures_negative_events_offline.sql.
 */
export interface CraftGate {
  /** The item that must be crafted first, if any. */
  requires: CraftItem | null;
  /** The Day 2 gates the RPC checks on top of `requires`. */
  requiresDay2Qualification: boolean;
  requiresPortalRepair: boolean;
}

export interface CraftRecipe extends CraftGate {
  item: CraftItem;
  label: string;
  base_cost: ResourceDelta;
  /** The round this craft opens, if it opens one. Not a prerequisite. */
  unlock_round_id: number | null;
  marks_pvp_eligible: boolean;
}

export const CRAFT_RECIPES: Record<CraftItem, CraftRecipe> = {
  wooden_pickaxe: {
    item: 'wooden_pickaxe',
    label: 'Wooden Pickaxe',
    base_cost: { wood: 60 },
    unlock_round_id: 2,
    marks_pvp_eligible: false,
    requires: null,
    requiresDay2Qualification: false,
    requiresPortalRepair: false,
  },
  stone_pickaxe: {
    item: 'stone_pickaxe',
    label: 'Stone Pickaxe',
    base_cost: { wood: 10, stone: 45, iron: 25 },
    unlock_round_id: 3,
    marks_pvp_eligible: false,
    requires: 'wooden_pickaxe',
    requiresDay2Qualification: false,
    requiresPortalRepair: false,
  },
  iron_armor: {
    item: 'iron_armor',
    label: 'Iron Armor',
    base_cost: { iron: 40, gold: 25 },
    unlock_round_id: null,
    marks_pvp_eligible: true,
    requires: 'stone_pickaxe',
    requiresDay2Qualification: false,
    requiresPortalRepair: false,
  },
  diamond_pickaxe: {
    item: 'diamond_pickaxe',
    label: 'Diamond Pickaxe',
    /**
     * The diamonds come from repairing the Nether Portal, which is the step
     * immediately before this one — see `app/api/team/portal/repair`, which
     * tops a team up to exactly 100. So the diamond line is paid for by the
     * round rather than saved up across the event; nothing else on the platform
     * pays diamonds at all, and before that grant existed every qualified team
     * held 15 and this craft was unreachable.
     *
     * Iron, gold and emerald are the ones a team has to arrive with, so they
     * sit under the poorest qualified team's balance. `craft_team_item` carries
     * the same numbers and is what actually charges; change them together.
     */
    base_cost: { iron: 10, gold: 15, diamond: 100, emerald: 3 },
    unlock_round_id: null,
    marks_pvp_eligible: false,
    requires: 'iron_armor',
    requiresDay2Qualification: true,
    requiresPortalRepair: true,
  },
};

/** The recipes in progression order, which is the order they unlock in. */
export const CRAFT_ORDER: readonly CraftItem[] = [
  'wooden_pickaxe',
  'stone_pickaxe',
  'iron_armor',
  'diamond_pickaxe',
];

export interface CraftAvailability {
  /** Every gate met and every resource affordable. */
  canCraft: boolean;
  /** Already in the crafting log. */
  crafted: boolean;
  /** A prerequisite or Day 2 gate is unmet — resources are not the problem. */
  locked: boolean;
  /** Why it is locked, in words. Empty when it is not. */
  blockedBy: string[];
  /** How much more of each resource is needed. Empty when affordable. */
  shortfall: Array<{ key: string; short: number }>;
}

export interface CraftContext {
  crafted: ReadonlySet<string> | string[];
  balance: Partial<Record<string, number>> | null | undefined;
  qualifiedForDay2?: boolean;
  portalRepaired?: boolean;
}

/**
 * Whether a recipe is craftable right now, and if not, what is stopping it.
 *
 * Pure, and deliberately the same order of checks the RPC uses: already
 * crafted, then prerequisites, then Day 2 gates, then resources. A team that is
 * short on diamonds *and* has not repaired the portal is told about the portal,
 * because that is the one it would hit first.
 */
export function craftAvailability(item: CraftItem, context: CraftContext): CraftAvailability {
  const recipe = CRAFT_RECIPES[item];
  const owned = context.crafted instanceof Set ? context.crafted : new Set(context.crafted ?? []);

  const crafted = owned.has(item);
  const blockedBy: string[] = [];

  if (recipe.requires && !owned.has(recipe.requires)) {
    blockedBy.push(`Craft the ${CRAFT_RECIPES[recipe.requires].label} first`);
  }
  if (recipe.requiresDay2Qualification && !context.qualifiedForDay2) {
    blockedBy.push('Qualify for Day 2');
  }
  if (recipe.requiresPortalRepair && !context.portalRepaired) {
    blockedBy.push('Repair the Nether Portal');
  }

  const shortfall = Object.entries(recipe.base_cost)
    .map(([key, need]) => ({ key, short: Number(need ?? 0) - Number(context.balance?.[key] ?? 0) }))
    .filter((entry) => entry.short > 0);

  return {
    crafted,
    locked: blockedBy.length > 0,
    blockedBy,
    shortfall,
    canCraft: !crafted && blockedBy.length === 0 && shortfall.length === 0,
  };
}

/**
 * The item a team must already hold to enter a round.
 *
 * The reverse of `unlock_round_id`, which every recipe already declares — so
 * the progression is stated once, in the recipe, rather than duplicated as a
 * second table that can drift from it.
 *
 * Only Rounds 2 and 3 are gated this way today: Iron Armor and the Diamond
 * Pickaxe unlock capabilities rather than biomes, so they open no round and
 * appear here as null.
 */
export function requiredCraftForRound(roundId: number): CraftItem | null {
  for (const item of CRAFT_ORDER) {
    if (CRAFT_RECIPES[item].unlock_round_id === roundId) return item;
  }
  return null;
}
