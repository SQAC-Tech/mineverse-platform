import { describe, expect, it } from 'vitest';
import { discountedCost, CRAFT_RECIPES } from '../../../lib/gameplay/crafting/rules';

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

  it('applies 10% Forge discount with ceil round-up per resource', () => {
    const actual = discountedCost(CRAFT_RECIPES.diamond_pickaxe.base_cost, 10);
    // iron: ceil(25 * 0.9) = ceil(22.5) = 23
    // gold: ceil(20 * 0.9) = ceil(18) = 18
    // diamond: ceil(100 * 0.9) = ceil(90) = 90
    // emerald: ceil(10 * 0.9) = ceil(9) = 9
    expect(actual).toEqual({ iron: 23, gold: 18, diamond: 90, emerald: 9 });
  });

  it('applies 20% Master Forge discount with ceil round-up per resource', () => {
    const actual = discountedCost(CRAFT_RECIPES.diamond_pickaxe.base_cost, 20);
    // iron: ceil(25 * 0.8) = ceil(20) = 20
    // gold: ceil(20 * 0.8) = ceil(16) = 16
    // diamond: ceil(100 * 0.8) = ceil(80) = 80
    // emerald: ceil(10 * 0.8) = ceil(8) = 8
    expect(actual).toEqual({ iron: 20, gold: 16, diamond: 80, emerald: 8 });
  });

  it('no-discount cost equals the base cost', () => {
    const actual = discountedCost(CRAFT_RECIPES.diamond_pickaxe.base_cost, 0);
    expect(actual).toEqual({ iron: 25, gold: 20, diamond: 100, emerald: 10 });
  });

  it('existing Phase 2 recipes remain unchanged', () => {
    expect(CRAFT_RECIPES.wooden_pickaxe.base_cost).toEqual({ wood: 60 });
    expect(CRAFT_RECIPES.stone_pickaxe.base_cost).toEqual({ wood: 10, stone: 45, iron: 25 });
    expect(CRAFT_RECIPES.iron_armor.base_cost).toEqual({ iron: 40, gold: 25 });
  });
});
