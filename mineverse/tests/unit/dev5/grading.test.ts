import { describe, expect, it } from 'vitest';
import { checkDeterministicAnswer, hasDeterministicKey } from '../../../lib/gameplay/grading/deterministic';
import { applyModifiers, type ActiveModifier } from '../../../lib/gameplay/events/service';
import { WORLD_EVENTS, WORLD_EVENT_KEYS, isWorldEventKey } from '../../../lib/gameplay/events/catalog';

describe('Dev5 deterministic grading', () => {
  it('matches scalar, value, and any_of answer keys case-insensitively', () => {
    expect(checkDeterministicAnswer('12', '12')).toBe(true);
    expect(checkDeterministicAnswer(' 12 ', { value: '12' })).toBe(true);
    expect(checkDeterministicAnswer('TWELVE', { any_of: ['12', 'twelve'] })).toBe(true);
    expect(checkDeterministicAnswer('13', { value: '12' })).toBe(false);
  });

  it('honours exact mode for case-sensitive answers', () => {
    expect(checkDeterministicAnswer('Abc', { value: 'abc', exact: true })).toBe(false);
    expect(checkDeterministicAnswer('abc', { value: 'abc', exact: true })).toBe(true);
  });

  it('returns null when there is no answer key so nothing is auto-scored wrong', () => {
    expect(checkDeterministicAnswer('anything', null)).toBeNull();
    expect(checkDeterministicAnswer('anything', undefined)).toBeNull();
    expect(checkDeterministicAnswer('anything', {})).toBeNull();
    expect(hasDeterministicKey(null)).toBe(false);
    expect(hasDeterministicKey({ any_of: [] })).toBe(false);
    expect(hasDeterministicKey({ value: 0 })).toBe(true);
  });

  it('treats a missing answer as incorrect rather than unscorable', () => {
    expect(checkDeterministicAnswer(null, { value: '12' })).toBe(false);
    expect(checkDeterministicAnswer(undefined, '12')).toBe(false);
  });
});

describe('Dev5 world event catalog', () => {
  it('exposes exactly the six canonical keys from the API guide', () => {
    expect(WORLD_EVENT_KEYS.sort()).toEqual(
      ['creeper_explosion', 'fertile_marsh', 'ghast_bombardment', 'gold_rush', 'heavy_rain', 'lava_eruption'].sort(),
    );
    expect(isWorldEventKey('heavy_rain')).toBe(true);
    expect(isWorldEventKey('meteor_strike')).toBe(false);
  });

  it('matches the event brief for round, effect, and protection', () => {
    expect(WORLD_EVENTS.heavy_rain).toMatchObject({ round_id: 1, modifier: { wood: 2 }, durationSeconds: 300 });
    expect(WORLD_EVENTS.fertile_marsh).toMatchObject({ round_id: 2, modifier: { iron: 2 } });
    expect(WORLD_EVENTS.gold_rush).toMatchObject({ round_id: 3, modifier: { gold: 2 } });
    // Bat Cave cancels the Creeper resource loss; Bastion cancels Lava Eruption.
    expect(WORLD_EVENTS.creeper_explosion).toMatchObject({
      penalty: { wood: -5, stone: -5 },
      protectedBy: 'bat_cave',
    });
    expect(WORLD_EVENTS.lava_eruption).toMatchObject({
      penalty: { gold: -10, iron: -5 },
      protectedBy: 'bastion',
    });
  });
});

describe('Dev5 modifier application', () => {
  const heavyRain: ActiveModifier = {
    event_key: 'heavy_rain',
    label: 'Heavy Rain',
    modifier: { wood: 2 },
    expires_at: null,
  };

  it('doubles only the named resource and leaves the rest untouched', () => {
    expect(applyModifiers({ wood: 8, stone: 5 }, [heavyRain])).toEqual({ wood: 16, stone: 5 });
  });

  it('is a no-op when no modifier is active', () => {
    expect(applyModifiers({ wood: 8, stone: 5 }, [])).toEqual({ wood: 8, stone: 5 });
  });

  it('never invents a resource the reward did not contain', () => {
    const goldRush: ActiveModifier = {
      event_key: 'gold_rush',
      label: 'Gold Rush',
      modifier: { gold: 2 },
      expires_at: null,
    };
    expect(applyModifiers({ wood: 6 }, [goldRush])).toEqual({ wood: 6 });
  });

  it('floors fractional results so a modifier cannot mint a partial resource', () => {
    const half: ActiveModifier = {
      event_key: 'heavy_rain',
      label: 'Heavy Rain',
      modifier: { wood: 1.5 },
      expires_at: null,
    };
    expect(applyModifiers({ wood: 5 }, [half])).toEqual({ wood: 7 });
  });
});
