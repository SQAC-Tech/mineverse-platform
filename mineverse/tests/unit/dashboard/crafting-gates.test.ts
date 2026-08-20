import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CRAFT_ORDER, CRAFT_RECIPES, craftAvailability } from '../../../lib/gameplay/crafting/rules';

/**
 * The crafting table offers buttons. A button that cannot work is worse than no
 * button, so the gates it greys out have to be the gates the database enforces.
 *
 * `craft_team_item` raises `progression requirement missing`, `day2
 * qualification required` and `portal repair required`. Those three, plus the
 * cost, are mirrored in `rules.ts` for display only — the RPC is still what
 * decides. These tests hold the mirror straight.
 */

const root = join(__dirname, '..', '..', '..');
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');

const base = { balance: {}, crafted: [] as string[] };
const rich = {
  wood: 999, stone: 999, iron: 999, gold: 999, diamond: 999, emerald: 999, obsidian: 999,
};

describe('craft gates', () => {
  it('lets a team with resources craft the first item', () => {
    const state = craftAvailability('wooden_pickaxe', { ...base, balance: rich });
    expect(state.canCraft).toBe(true);
    expect(state.blockedBy).toEqual([]);
  });

  it('will not offer a recipe whose prerequisite is missing, however rich the team', () => {
    for (const item of ['stone_pickaxe', 'iron_armor', 'diamond_pickaxe'] as const) {
      const state = craftAvailability(item, { ...base, balance: rich });
      expect(state.canCraft, item).toBe(false);
      expect(state.locked, item).toBe(true);
      expect(state.blockedBy.join(' '), item).toMatch(/Craft the/);
    }
  });

  it('walks the chain one step at a time', () => {
    const owned: string[] = [];
    for (const item of CRAFT_ORDER) {
      const state = craftAvailability(item, {
        balance: rich,
        crafted: owned,
        qualifiedForDay2: true,
        portalRepaired: true,
      });
      expect(state.canCraft, `${item} after ${owned.join(',') || 'nothing'}`).toBe(true);
      owned.push(item);
    }
  });

  it('holds the diamond pickaxe behind Day 2 and the portal, not just the armour', () => {
    const crafted = ['wooden_pickaxe', 'stone_pickaxe', 'iron_armor'];

    const noDay2 = craftAvailability('diamond_pickaxe', { balance: rich, crafted, qualifiedForDay2: false, portalRepaired: true });
    expect(noDay2.canCraft).toBe(false);
    expect(noDay2.blockedBy).toContain('Qualify for Day 2');

    const noPortal = craftAvailability('diamond_pickaxe', { balance: rich, crafted, qualifiedForDay2: true, portalRepaired: false });
    expect(noPortal.canCraft).toBe(false);
    expect(noPortal.blockedBy).toContain('Repair the Nether Portal');

    const ready = craftAvailability('diamond_pickaxe', { balance: rich, crafted, qualifiedForDay2: true, portalRepaired: true });
    expect(ready.canCraft).toBe(true);
  });

  it('reports the shortfall rather than just refusing', () => {
    const state = craftAvailability('wooden_pickaxe', { ...base, balance: { wood: 25 } });
    expect(state.canCraft).toBe(false);
    expect(state.locked).toBe(false);
    expect(state.shortfall).toEqual([{ key: 'wood', short: 35 }]);
  });

  it('treats a missing balance as zero, never as affordable', () => {
    expect(craftAvailability('wooden_pickaxe', { crafted: [], balance: null }).canCraft).toBe(false);
    expect(craftAvailability('wooden_pickaxe', { crafted: [], balance: undefined }).canCraft).toBe(false);
  });

  it('never offers a second craft of the same item', () => {
    const state = craftAvailability('wooden_pickaxe', { balance: rich, crafted: ['wooden_pickaxe'] });
    expect(state.crafted).toBe(true);
    expect(state.canCraft).toBe(false);
  });

  it('names a gate before a shortfall, the order the RPC checks them in', () => {
    // Short on everything AND missing the prerequisite: the prerequisite is
    // what the team hits first, so that is what it is told.
    const state = craftAvailability('diamond_pickaxe', { balance: {}, crafted: [] });
    expect(state.locked).toBe(true);
    expect(state.blockedBy[0]).toMatch(/Iron Armor/);
  });

  it('mirrors the chain the database actually enforces', () => {
    const sql = read('supabase', 'migrations', '20260814_01_remove_structures_negative_events_offline.sql');

    // Each prerequisite in the table must appear as a real check in the RPC.
    for (const item of CRAFT_ORDER) {
      const requires = CRAFT_RECIPES[item].requires;
      if (!requires) continue;
      const branch = sql.slice(sql.indexOf(`p_item = '${item}'`));
      expect(branch.slice(0, 400), `${item} requires ${requires}`).toContain(`item = '${requires}'`);
    }

    expect(sql).toContain('day2 qualification required');
    expect(sql).toContain('portal repair required');
  });

  it('keeps one recipe table, so the quoted cost is the charged cost', () => {
    const service = read('lib', 'gameplay', 'crafting', 'service.ts');
    expect(service).toMatch(/from '@\/lib\/gameplay\/crafting\/rules'/);
    // A second literal table here is the drift this collapsed.
    expect(service).not.toMatch(/base_cost:\s*\{\s*wood:/);
  });
});
