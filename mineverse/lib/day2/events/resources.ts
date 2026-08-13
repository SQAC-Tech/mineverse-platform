/**
 * Shared Day 2 resource-delta shape and arithmetic.
 *
 * This used to sit alongside a catalog of Round 4 offline-game awards. The
 * offline games are now played entirely off the platform, so the catalog is
 * gone and only the delta helpers — used by grading, reconciliation and the
 * admin resource grant — remain.
 */
export const day2ResourceKeys = ['wood', 'stone', 'iron', 'gold', 'diamond', 'emerald', 'obsidian'] as const;

export type Day2ResourceKey = (typeof day2ResourceKeys)[number];
export type Day2ResourceDelta = Partial<Record<Day2ResourceKey, number>>;

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
