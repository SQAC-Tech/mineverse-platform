export const day2ResourceKeys = ['wood', 'stone', 'iron', 'gold', 'diamond', 'emerald', 'obsidian'] as const;

export type Day2ResourceKey = (typeof day2ResourceKeys)[number];
export type Day2ResourceDelta = Partial<Record<Day2ResourceKey, number>>;

export type Round4ActivityKey =
  | 'memory_challenge'
  | 'spot_the_difference'
  | 'insta_lollipop_soap'
  | 'crack_the_code'
  | 'cup_flip';

export type Round4Outcome = 'completed' | 'win' | 'loss';

export interface Round4Award {
  activityKey: Round4ActivityKey;
  outcome: Round4Outcome;
  label: string;
  award: Day2ResourceDelta | null;
  portalFragmentDelta: 0 | 1;
  requiresConfiguredAward?: boolean;
}

export const ROUND4_AWARDS: Round4Award[] = [
  {
    activityKey: 'memory_challenge',
    outcome: 'completed',
    label: 'Memory Challenge',
    award: { diamond: 10 },
    portalFragmentDelta: 1,
  },
  {
    activityKey: 'spot_the_difference',
    outcome: 'completed',
    label: 'Spot the Difference',
    award: { diamond: 8, emerald: 2 },
    portalFragmentDelta: 0,
  },
  {
    activityKey: 'insta_lollipop_soap',
    outcome: 'completed',
    label: 'Insta lollipop and soap',
    award: null,
    portalFragmentDelta: 0,
    requiresConfiguredAward: true,
  },
  {
    activityKey: 'crack_the_code',
    outcome: 'win',
    label: 'Crack the Code - win',
    award: { diamond: 8, emerald: 1 },
    portalFragmentDelta: 0,
  },
  {
    activityKey: 'crack_the_code',
    outcome: 'loss',
    label: 'Crack the Code - loss',
    award: { diamond: 3 },
    portalFragmentDelta: 0,
  },
  {
    activityKey: 'cup_flip',
    outcome: 'win',
    label: 'Cup Flip - win',
    award: { diamond: 8, emerald: 1 },
    portalFragmentDelta: 0,
  },
  {
    activityKey: 'cup_flip',
    outcome: 'loss',
    label: 'Cup Flip - loss',
    award: { diamond: 3, emerald: 1 },
    portalFragmentDelta: 0,
  },
];

export function findRound4Award(activityKey: Round4ActivityKey, outcome: Round4Outcome) {
  return ROUND4_AWARDS.find((award) => award.activityKey === activityKey && award.outcome === outcome) ?? null;
}

export function normalizeDelta(delta: Day2ResourceDelta) {
  const normalized: Day2ResourceDelta = {};
  for (const key of day2ResourceKeys) {
    const value = delta[key];
    if (typeof value === 'number' && Number.isFinite(value) && value !== 0) {
      normalized[key] = Math.trunc(value);
    }
  }
  return normalized;
}

export function addDelta(balance: Record<Day2ResourceKey, number>, delta: Day2ResourceDelta) {
  const next = { ...balance };
  for (const key of day2ResourceKeys) {
    next[key] = (next[key] ?? 0) + (delta[key] ?? 0);
  }
  return next;
}

export function hasNonZeroDelta(delta: Day2ResourceDelta) {
  return Object.values(delta).some((value) => typeof value === 'number' && value !== 0);
}

