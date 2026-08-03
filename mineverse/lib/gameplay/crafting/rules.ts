export type ResourceDelta = Partial<Record<'wood' | 'stone' | 'iron' | 'gold' | 'diamond' | 'emerald' | 'obsidian', number>>;

export type CraftItem = 'wooden_pickaxe' | 'stone_pickaxe' | 'iron_armor';

export interface CraftRecipe {
  item: CraftItem;
  label: string;
  base_cost: ResourceDelta;
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
  },
  stone_pickaxe: {
    item: 'stone_pickaxe',
    label: 'Stone Pickaxe',
    base_cost: { wood: 10, stone: 45, iron: 25 },
    unlock_round_id: 3,
    marks_pvp_eligible: false,
  },
  iron_armor: {
    item: 'iron_armor',
    label: 'Iron Armor',
    base_cost: { iron: 40, gold: 25 },
    unlock_round_id: null,
    marks_pvp_eligible: true,
  },
};

export function discountedCost(baseCost: ResourceDelta, discountPercent: number): ResourceDelta {
  const actual: ResourceDelta = {};
  for (const [key, value] of Object.entries(baseCost)) {
    actual[key as keyof ResourceDelta] = Math.ceil((value ?? 0) * (100 - discountPercent) / 100);
  }
  return actual;
}