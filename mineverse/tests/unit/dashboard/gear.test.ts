import { describe, expect, it } from 'vitest';
import { STEVE_FRAMES, loadoutFrom } from '../../../features/dashboard/gear';

/**
 * The avatar is a claim about what a team owns.
 *
 * Every frame maps to a row in `crafting_log` or to the Day 2 portal repair, so
 * the thing to protect is that it can never show gear the team has not earned,
 * and never demote a team that has earned more.
 */

const craft = (...items: string[]) => [
  { item: 'wooden_pickaxe', crafted: items.includes('wooden_pickaxe') },
  { item: 'stone_pickaxe', crafted: items.includes('stone_pickaxe') },
  { item: 'iron_armor', crafted: items.includes('iron_armor') },
  { item: 'diamond_pickaxe', crafted: items.includes('diamond_pickaxe') },
];

describe('steve loadout', () => {
  it('never claims gear a team has not crafted', () => {
    const loadout = loadoutFrom({ crafted: craft() });
    expect(loadout.frame).toBe(0);
    // Frame 0 draws a wooden pickaxe because there is no empty-handed frame, so
    // the caption is the only place that can tell the truth. It has to.
    expect(loadout.caption).toBe('No gear crafted yet');
    expect(loadout.caption).not.toMatch(/pickaxe/i);
  });

  it('walks up one frame per crafted tier', () => {
    expect(loadoutFrom({ crafted: craft('wooden_pickaxe') }).frame).toBe(1 - 1);
    expect(loadoutFrom({ crafted: craft('wooden_pickaxe', 'stone_pickaxe') }).frame).toBe(1);
    expect(loadoutFrom({ crafted: craft('wooden_pickaxe', 'stone_pickaxe', 'iron_armor') }).frame).toBe(2);
  });

  it('shows the nether-forged frame once the portal is repaired', () => {
    const before = loadoutFrom({ crafted: craft('stone_pickaxe', 'iron_armor'), portalRepaired: false });
    const after = loadoutFrom({ crafted: craft('stone_pickaxe', 'iron_armor'), portalRepaired: true });
    expect(before.frame).toBe(2);
    expect(after.frame).toBe(3);
  });

  it('puts the diamond pickaxe above everything, portal included', () => {
    const loadout = loadoutFrom({ crafted: craft('diamond_pickaxe'), portalRepaired: true });
    expect(loadout.frame).toBe(4);
    expect(loadout.caption).toMatch(/diamond/i);
  });

  it('never goes backwards for a tier that was skipped', () => {
    // A team can be granted the Diamond Pickaxe without the Stone one — an
    // organizer credit, or a recovered account. It must not drop to frame 0.
    const loadout = loadoutFrom({ crafted: craft('diamond_pickaxe') });
    expect(loadout.frame).toBe(4);
  });

  it('stays inside the sheet', () => {
    const inputs = [
      craft(),
      craft('wooden_pickaxe'),
      craft('stone_pickaxe'),
      craft('iron_armor'),
      craft('diamond_pickaxe'),
      craft('wooden_pickaxe', 'stone_pickaxe', 'iron_armor', 'diamond_pickaxe'),
    ];
    for (const crafted of inputs) {
      for (const portalRepaired of [false, true]) {
        const { frame } = loadoutFrom({ crafted, portalRepaired });
        expect(frame).toBeGreaterThanOrEqual(0);
        expect(frame).toBeLessThan(STEVE_FRAMES);
      }
    }
  });

  it('survives a missing or empty crafting log', () => {
    expect(loadoutFrom({ crafted: null }).frame).toBe(0);
    expect(loadoutFrom({ crafted: undefined }).frame).toBe(0);
    expect(loadoutFrom({ crafted: [] }).caption).toBe('No gear crafted yet');
  });

  it('ignores entries flagged as not crafted', () => {
    const loadout = loadoutFrom({ crafted: [{ item: 'diamond_pickaxe', crafted: false }] });
    expect(loadout.frame).toBe(0);
  });
});
