import { describe, expect, it } from 'vitest';
import { ROUND_CONFIGS } from '../../../lib/gameplay/round-config';
import { ROUND_IDS, PANEL_CENTERS_PCT, ACCENTS } from '../../../features/dashboard/round-portals';

/**
 * Regression guard for the missing Round 5 portal.
 *
 * The dashboard built its cards from a literal `Array.from({ length: 4 })` while
 * the event had five rounds, so The End was unreachable from the dashboard —
 * every other surface knew about it, only the way in was missing. Nothing failed:
 * four cards rendered and looked complete.
 */

describe('round portals', () => {
  it('offers one portal per configured round', () => {
    expect(ROUND_IDS).toEqual(Object.keys(ROUND_CONFIGS).map(Number).sort((a, b) => a - b));
  });

  it('includes Round 5 — the case that was missing', () => {
    expect(ROUND_IDS).toContain(5);
  });

  it('has a layout position for every portal', () => {
    expect(PANEL_CENTERS_PCT).toHaveLength(ROUND_IDS.length);
  });

  it('has an accent colour for every portal', () => {
    expect(ACCENTS).toHaveLength(ROUND_IDS.length);
  });

  it('spaces the portals left to right without overlapping', () => {
    const ascending = [...PANEL_CENTERS_PCT].sort((a, b) => a - b);
    expect(PANEL_CENTERS_PCT).toEqual(ascending);
    for (const centre of PANEL_CENTERS_PCT) {
      expect(centre).toBeGreaterThan(0);
      expect(centre).toBeLessThan(100);
    }
  });
});
