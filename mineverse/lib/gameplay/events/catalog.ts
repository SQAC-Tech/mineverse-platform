import { ResourceDelta } from '@/lib/gameplay/marketplace/resource-client';

/**
 * Server-only canonical world-event catalog. The database logs a triggered
 * instance; it never stores a mutable rule template, and an admin request may
 * only name a key from this catalog (never supply its own effect).
 *
 * Values come from `docs/event details/Mineverse_Full_Event_Details.md`, which
 * the Phase 2 master plan makes authoritative over older Phase 2 copy.
 */
export type WorldEventKey =
  | 'heavy_rain'
  | 'fertile_marsh'
  | 'creeper_explosion'
  | 'gold_rush'
  | 'lava_eruption'
  | 'ghast_bombardment';

export type WorldEventKind = 'modifier' | 'penalty' | 'structure_damage';

export interface WorldEventConfig {
  key: WorldEventKey;
  round_id: number;
  kind: WorldEventKind;
  label: string;
  announcement: string;
  /** Reward multipliers applied to question awards while the window is open. */
  modifier?: Record<string, number>;
  durationSeconds?: number;
  /** One-shot resource loss applied at trigger time. */
  penalty?: ResourceDelta;
  /** A built structure of this type cancels the resource loss. */
  protectedBy?: string;
  /** The event also damages a structure. */
  damagesStructure?: 'built' | 'random';
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
  creeper_explosion: {
    key: 'creeper_explosion',
    round_id: 2,
    kind: 'penalty',
    label: 'Creeper Explosion',
    announcement:
      'A group of Creepers has entered your mining camp! Their explosions have damaged your supplies.',
    penalty: { wood: -5, stone: -5 },
    protectedBy: 'bat_cave',
    damagesStructure: 'built',
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
  lava_eruption: {
    key: 'lava_eruption',
    round_id: 3,
    kind: 'penalty',
    label: 'Lava Eruption',
    announcement: 'Lava erupts through the tunnels, consuming part of your stockpile!',
    penalty: { gold: -10, iron: -5 },
    protectedBy: 'bastion',
  },
  ghast_bombardment: {
    key: 'ghast_bombardment',
    round_id: 3,
    kind: 'structure_damage',
    label: 'Ghast Bombardment',
    announcement: 'Ghasts bombard the mountain! One of your structures has been damaged.',
    damagesStructure: 'random',
  },
};

export const WORLD_EVENT_KEYS = Object.keys(WORLD_EVENTS) as WorldEventKey[];

export function isWorldEventKey(value: string): value is WorldEventKey {
  return value in WORLD_EVENTS;
}
