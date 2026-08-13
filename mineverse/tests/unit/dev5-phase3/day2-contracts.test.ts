import { describe, expect, it } from 'vitest';
import {
  addDelta,
  hasNonZeroDelta,
  normalizeDelta,
} from '@/lib/day2/events/resources';
import { DAY2_EVENTS, DAY2_EVENT_KEYS, isDay2EventKey } from '@/lib/day2/events/catalog';

describe('Dev5 Phase 3 Day 2 events', () => {
  it('exposes only supported operator events', () => {
    expect(DAY2_EVENT_KEYS).toEqual(['chorus_fruit_blessing']);
    expect(isDay2EventKey('end_merchant')).toBe(false);
  });

  it('no longer exposes the removed negative events', () => {
    expect(isDay2EventKey('enderman_ambush')).toBe(false);
    expect(isDay2EventKey('dragons_fury')).toBe(false);
  });

  it('matches the event brief for the surviving bonus window', () => {
    expect(DAY2_EVENTS.chorus_fruit_blessing).toMatchObject({
      kind: 'window_bonus',
      durationSeconds: 300,
      bonus: { emerald: 2 },
    });
  });

  it('has no Day 2 event that can take resources away', () => {
    for (const config of Object.values(DAY2_EVENTS)) {
      for (const value of Object.values(config.bonus)) {
        expect(value).toBeGreaterThan(0);
      }
    }
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
