import type { Day2ResourceDelta } from '@/lib/day2/events/offline';

export type Day2EventKey = 'chorus_fruit_blessing' | 'enderman_ambush' | 'dragons_fury';

export interface Day2EventConfig {
  key: Day2EventKey;
  label: string;
  kind: 'window_bonus' | 'instant_penalty';
  durationSeconds: number | null;
  delta?: Day2ResourceDelta;
  bonus?: Day2ResourceDelta;
  protection?: 'final_boss_attempt_started';
  announcement: string;
}

export const DAY2_EVENTS: Record<Day2EventKey, Day2EventConfig> = {
  chorus_fruit_blessing: {
    key: 'chorus_fruit_blessing',
    label: 'Chorus Fruit Blessing',
    kind: 'window_bonus',
    durationSeconds: 300,
    bonus: { emerald: 2 },
    announcement: 'Chorus Fruit Blessing is active for five minutes.',
  },
  enderman_ambush: {
    key: 'enderman_ambush',
    label: 'Enderman Ambush',
    kind: 'instant_penalty',
    durationSeconds: null,
    delta: { diamond: -8 },
    announcement: 'Enderman Ambush struck targeted qualified teams.',
  },
  dragons_fury: {
    key: 'dragons_fury',
    label: "Dragon's Fury",
    kind: 'instant_penalty',
    durationSeconds: null,
    delta: { diamond: -10 },
    protection: 'final_boss_attempt_started',
    announcement: "Dragon's Fury struck teams that have not weakened the Dragon.",
  },
};

export const DAY2_EVENT_KEYS = Object.keys(DAY2_EVENTS) as Day2EventKey[];

export function isDay2EventKey(value: string): value is Day2EventKey {
  return DAY2_EVENT_KEYS.includes(value as Day2EventKey);
}

