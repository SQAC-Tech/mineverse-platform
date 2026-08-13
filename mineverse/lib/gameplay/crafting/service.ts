import { supabaseServer } from '@/lib/supabase/server';
import type { ResourceDelta } from '@/lib/gameplay/resources/service';

const db = supabaseServer as any;

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

/**
 * Base cost is the cost. The Forge and Master Forge structures used to discount
 * it by 10% and 20%; structures are gone, so nothing modifies a recipe any
 * more. `actual_cost` is still reported so the API shape holds.
 */
export async function listCraftRecipes(teamId: string) {
  const { data: craftedRows, error } = await db
    .from('crafting_log')
    .select('item')
    .eq('team_id', teamId);

  if (error && error.code !== '42P01') throw error;
  const crafted = new Set((craftedRows ?? []).map((row: { item: CraftItem }) => row.item));

  return {
    recipes: Object.values(CRAFT_RECIPES).map((recipe) => ({
      ...recipe,
      actual_cost: recipe.base_cost,
      crafted: crafted.has(recipe.item),
    })),
    server_time: new Date().toISOString(),
  };
}

export async function craftTeamItem(teamId: string, item: CraftItem, idempotencyKey: string) {
  if (!CRAFT_RECIPES[item]) {
    return { ok: false as const, status: 400, code: 'INVALID_ITEM', message: 'Invalid crafting item.' };
  }

  const { data, error } = await db.rpc('craft_team_item', {
    p_team_id: teamId,
    p_item: item,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    const message = String(error.message ?? 'Crafting failed.');
    if (message.includes('insufficient')) {
      return { ok: false as const, status: 422, code: 'INSUFFICIENT_RESOURCES', message: 'Not enough resources.' };
    }
    if (message.includes('already crafted')) {
      return { ok: false as const, status: 409, code: 'ALREADY_CRAFTED', message: 'This item has already been crafted.' };
    }
    if (message.includes('progression requirement')) {
      return { ok: false as const, status: 422, code: 'PROGRESSION_REQUIRED', message: 'Craft the previous progression item first.' };
    }
    if (message.includes('day2 qualification')) {
      return { ok: false as const, status: 403, code: 'DAY2_NOT_QUALIFIED', message: 'Your team has not qualified for Day 2.' };
    }
    if (message.includes('portal repair')) {
      return { ok: false as const, status: 403, code: 'PORTAL_NOT_REPAIRED', message: 'Your team must repair the Nether Portal first.' };
    }
    throw error;
  }

  return { ok: true as const, data };
}