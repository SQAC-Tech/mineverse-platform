import { describe, expect, it } from 'vitest';
import {
  ROUND4_AWARDS,
  addDelta,
  findRound4Award,
  hasNonZeroDelta,
  normalizeDelta,
} from '@/lib/day2/events/offline';
import { DAY2_EVENTS, DAY2_EVENT_KEYS, isDay2EventKey } from '@/lib/day2/events/catalog';

describe('Dev5 Phase 3 Round 4 awards', () => {
  it('matches the event brief for canonical offline activities', () => {
    expect(findRound4Award('memory_challenge', 'completed')).toMatchObject({
      award: { diamond: 10 },
      portalFragmentDelta: 1,
    });
    expect(findRound4Award('spot_the_difference', 'completed')).toMatchObject({
      award: { diamond: 8, emerald: 2 },
      portalFragmentDelta: 0,
    });
    expect(findRound4Award('crack_the_code', 'win')).toMatchObject({ award: { diamond: 8, emerald: 1 } });
    expect(findRound4Award('crack_the_code', 'loss')).toMatchObject({ award: { diamond: 3 } });
    expect(findRound4Award('cup_flip', 'win')).toMatchObject({ award: { diamond: 8, emerald: 1 } });
    expect(findRound4Award('cup_flip', 'loss')).toMatchObject({ award: { diamond: 3, emerald: 1 } });
  });

  it('does not invent an Insta lollipop and soap reward', () => {
    expect(findRound4Award('insta_lollipop_soap', 'completed')).toMatchObject({
      award: null,
      requiresConfiguredAward: true,
    });
  });

  it('never grants Nether Core as a Round 4 award', () => {
    for (const award of ROUND4_AWARDS) {
      expect(award.award ?? {}).not.toHaveProperty('nether_core');
      expect(award.award ?? {}).not.toHaveProperty('obsidian');
    }
  });
});

describe('Dev5 Phase 3 Day 2 events', () => {
  it('exposes only supported operator events', () => {
    expect(DAY2_EVENT_KEYS.sort()).toEqual(
      ['chorus_fruit_blessing', 'dragons_fury', 'enderman_ambush'].sort(),
    );
    expect(isDay2EventKey('end_merchant')).toBe(false);
  });

  it('matches event brief effects and protection source', () => {
    expect(DAY2_EVENTS.chorus_fruit_blessing).toMatchObject({
      durationSeconds: 300,
      bonus: { emerald: 2 },
    });
    expect(DAY2_EVENTS.enderman_ambush).toMatchObject({ delta: { diamond: -8 } });
    expect(DAY2_EVENTS.dragons_fury).toMatchObject({
      delta: { diamond: -10 },
      protection: 'final_boss_attempt_started',
    });
  });
});

describe('Dev5 Phase 3 resource helpers', () => {
  it('normalizes non-zero integer resource deltas', () => {
    expect(normalizeDelta({ diamond: 8.9, emerald: 0, wood: -2 })).toEqual({ wood: -2, diamond: 8 });
    expect(hasNonZeroDelta({})).toBe(false);
    expect(hasNonZeroDelta({ emerald: 0 })).toBe(false);
    expect(hasNonZeroDelta({ emerald: 1 })).toBe(true);
  });

  it('computes manual adjustment after-balance confirmation', () => {
    expect(addDelta(
      { wood: 1, stone: 2, iron: 3, gold: 4, diamond: 5, emerald: 6, obsidian: 0 },
      { diamond: -2, emerald: 4 },
    )).toEqual({ wood: 1, stone: 2, iron: 3, gold: 4, diamond: 3, emerald: 10, obsidian: 0 });
  });
});
