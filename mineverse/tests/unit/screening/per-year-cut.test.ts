import { describe, expect, it } from 'vitest';
import { cutProblems } from '@/lib/screening/shortlist';

/**
 * PvP pairs first years against first years and second years against second
 * years, so each year has to leave the shortlist with an even number of teams.
 * A merged cut cannot express that: the top 48 splits 29/19, odd on both sides,
 * and no single number fixes it — 46 gives 28/18, 48 gives 29/19.
 */

const AVAILABLE = { year1: 48, year2: 29 };

describe('the per-year cut', () => {
  it('accepts the split the event was planned around', () => {
    expect(cutProblems({ year1: 30, year2: 18 }, AVAILABLE)).toEqual([]);
  });

  it('refuses an odd year, which is the whole point', () => {
    const problems = cutProblems({ year1: 29, year2: 18 }, AVAILABLE);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('no opponent');
  });

  it('catches both years at once rather than one at a time', () => {
    // 29/19 is exactly what a merged top-48 produces.
    expect(cutProblems({ year1: 29, year2: 19 }, AVAILABLE)).toHaveLength(2);
  });

  it('refuses to take more teams than sat the paper', () => {
    expect(cutProblems({ year1: 30, year2: 40 }, AVAILABLE)[0]).toContain('only 29');
  });

  it('lets a year be dropped entirely', () => {
    // Zero is even, and a year with no qualifiers is a real state.
    expect(cutProblems({ year1: 48, year2: 0 }, AVAILABLE)).toEqual([]);
  });
});
