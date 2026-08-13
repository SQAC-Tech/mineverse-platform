export type ResourceDelta = Partial<Record<'wood' | 'stone' | 'iron' | 'gold' | 'diamond' | 'emerald' | 'obsidian', number>>;

export type CraftItem = 'wooden_pickaxe' | 'stone_pickaxe' | 'iron_armor' | 'diamond_pickaxe';

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
  diamond_pickaxe: {
    item: 'diamond_pickaxe',
    label: 'Diamond Pickaxe',
    base_cost: { iron: 25, gold: 20, diamond: 100, emerald: 10 },
    unlock_round_id: null,
    marks_pvp_eligible: false,
  },
};
