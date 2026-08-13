import type { Day2ResourceDelta } from '@/lib/day2/events/resources';

/**
 * The Chorus Fruit Blessing is the only Day 2 world event. Enderman Ambush and
 * Dragon's Fury were removed with the rest of the negative events — nothing an
 * organizer triggers can take resources off a team any more.
 */
export type Day2EventKey = 'chorus_fruit_blessing';

export interface Day2EventConfig {
  key: Day2EventKey;
  label: string;
  kind: 'window_bonus';
  durationSeconds: number;
  bonus: Day2ResourceDelta;
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
};

export const DAY2_EVENT_KEYS = Object.keys(DAY2_EVENTS) as Day2EventKey[];

export function isDay2EventKey(value: string): value is Day2EventKey {
  return DAY2_EVENT_KEYS.includes(value as Day2EventKey);
}
