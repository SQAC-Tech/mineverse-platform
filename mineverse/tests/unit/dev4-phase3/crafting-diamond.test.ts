import { describe, expect, it } from 'vitest';
import { CRAFT_RECIPES } from '../../../lib/gameplay/crafting/rules';

describe('Dev4 Phase 3 — Diamond Pickaxe crafting contract', () => {
  it('has diamond_pickaxe in CRAFT_RECIPES', () => {
    expect(CRAFT_RECIPES.diamond_pickaxe).toBeDefined();
  });

  it('uses the exact canonical base cost: 25 Iron + 20 Gold + 100 Diamonds + 10 Emeralds', () => {
    expect(CRAFT_RECIPES.diamond_pickaxe.base_cost).toEqual({
      iron: 25,
      gold: 20,
      diamond: 100,
      emerald: 10,
    });
  });

  it('has no unlock_round_id (Final Boss gated by craft existence)', () => {
    expect(CRAFT_RECIPES.diamond_pickaxe.unlock_round_id).toBeNull();
  });

  it('does not mark PvP eligible', () => {
    expect(CRAFT_RECIPES.diamond_pickaxe.marks_pvp_eligible).toBe(false);
  });

  it('existing Phase 2 recipes remain unchanged', () => {
    expect(CRAFT_RECIPES.wooden_pickaxe.base_cost).toEqual({ wood: 60 });
    expect(CRAFT_RECIPES.stone_pickaxe.base_cost).toEqual({ wood: 10, stone: 45, iron: 25 });
    expect(CRAFT_RECIPES.iron_armor.base_cost).toEqual({ iron: 40, gold: 25 });
  });
});
