/**
 * Server-only canonical world-event catalog. The database logs a triggered
 * instance; it never stores a mutable rule template, and an admin request may
 * only name a key from this catalog (never supply its own effect).
 *
 * Values come from `docs/event details/Mineverse_Full_Event_Details.md`, which
 * the Phase 2 master plan makes authoritative over older Phase 2 copy.
 *
 * Every event here is a reward modifier. Negative events — Creeper Explosion,
 * Lava Eruption, Ghast Bombardment — were removed along with the structures
 * that used to absorb them; a world event can no longer take resources off a
 * team or damage anything it owns.
 */
export type WorldEventKey = 'heavy_rain' | 'fertile_marsh' | 'gold_rush';

export type WorldEventKind = 'modifier';

export interface WorldEventConfig {
  key: WorldEventKey;
  round_id: number;
  kind: WorldEventKind;
  label: string;
  announcement: string;
  /** Reward multipliers applied to question awards while the window is open. */
  modifier: Record<string, number>;
  durationSeconds: number;
}

export const WORLD_EVENTS: Record<WorldEventKey, WorldEventConfig> = {
  heavy_rain: {
    key: 'heavy_rain',
    round_id: 1,
    kind: 'modifier',
    label: 'Heavy Rain',
    announcement:
      'Heavy Rain has begun! Trees flourish across the Forest. Wood rewards are doubled for the next 5 minutes!',
    modifier: { wood: 2 },
    durationSeconds: 300,
  },
  fertile_marsh: {
    key: 'fertile_marsh',
    round_id: 2,
    kind: 'modifier',
    label: 'Fertile Marsh',
    announcement: 'The marsh turns fertile — Iron rewards are doubled for the next 5 minutes!',
    modifier: { iron: 2 },
    durationSeconds: 300,
  },
  gold_rush: {
    key: 'gold_rush',
    round_id: 3,
    kind: 'modifier',
    label: 'Gold Rush',
    announcement: 'A Gold Rush sweeps the mountain — Gold rewards are doubled for the next 5 minutes!',
    modifier: { gold: 2 },
    durationSeconds: 300,
  },
};

export const WORLD_EVENT_KEYS = Object.keys(WORLD_EVENTS) as WorldEventKey[];

export function isWorldEventKey(value: string): value is WorldEventKey {
  return value in WORLD_EVENTS;
}
