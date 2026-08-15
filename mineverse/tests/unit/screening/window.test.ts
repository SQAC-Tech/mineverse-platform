import { describe, expect, it } from 'vitest';
import {
  DIFFICULTY_POINTS, FIRST_YEAR_BONUS, SCREENING_DURATION_MS, SCREENING_GRANT,
  canStart, deadlineFrom, windowState,
} from '@/lib/screening/config';

/** 22 Aug 2026, 00:00 IST → 23 Aug 2026, 00:00 IST. */
const WINDOW = { startsAt: '2026-08-21T18:30:00Z', endsAt: '2026-08-22T18:30:00Z' };
const at = (iso: string) => new Date(iso).getTime();

describe('the window', () => {
  it('opens at midnight IST on the 22nd, not at midnight UTC', () => {
    // The event is in India; getting this wrong opens the round 5.5 hours early.
    expect(windowState(WINDOW, at('2026-08-21T18:29:59Z'))).toBe('before');
    expect(windowState(WINDOW, at('2026-08-21T18:30:00Z'))).toBe('open');
  });

  it('closes at midnight IST on the 23rd', () => {
    expect(windowState(WINDOW, at('2026-08-22T18:29:59Z'))).toBe('open');
    expect(windowState(WINDOW, at('2026-08-22T18:30:00Z'))).toBe('closed');
  });

  it('reports itself unset rather than open when the round has no dates', () => {
    expect(windowState({ startsAt: null, endsAt: null })).toBe('unset');
    expect(canStart({ startsAt: null, endsAt: null })).toBe(false);
  });
});

describe('starting late', () => {
  it('allows a start with two minutes left in the window', () => {
    expect(canStart(WINDOW, at('2026-08-22T18:28:00Z'))).toBe(true);
  });

  it('refuses a start one second after the window closes', () => {
    expect(canStart(WINDOW, at('2026-08-22T18:30:01Z'))).toBe(false);
  });

  /**
   * The rule that matters most here: the window gates starting and nothing else.
   * A deadline clamped to `ends_at` would strand a 23:58 starter two minutes in,
   * which is exactly the behaviour the game round shells have and this must not.
   */
  it('gives a 23:58 starter the full 30 minutes, past the close of the window', () => {
    const startedAt = '2026-08-22T18:28:00Z'; // 23:58 IST
    const deadline = deadlineFrom(startedAt);

    expect(deadline.getTime() - at(startedAt)).toBe(SCREENING_DURATION_MS);
    // 00:28 IST the next day — 28 minutes after the window shut.
    expect(deadline.toISOString()).toBe('2026-08-22T18:58:00.000Z');
    expect(deadline.getTime()).toBeGreaterThan(at(WINDOW.endsAt));
  });
});

describe('scoring constants', () => {
  it('weights harder questions more', () => {
    expect(DIFFICULTY_POINTS.easy).toBeLessThan(DIFFICULTY_POINTS.medium);
    expect(DIFFICULTY_POINTS.medium).toBeLessThan(DIFFICULTY_POINTS.hard);
  });

  it('keeps the first-year bonus meaningful but not decisive', () => {
    // 10 of a 50-point paper: enough to matter, not enough to carry a team that
    // answered nothing past one that did well.
    expect(FIRST_YEAR_BONUS).toBe(10);
    expect(FIRST_YEAR_BONUS).toBeLessThan(50);
  });

  it('adds nothing on top of the resources every team already starts with', () => {
    // Teams already open with wood 25 / stone 10 / emerald 5, which comes from
    // the DEFAULT on the `resources` columns rather than from any grant. The
    // brief was that qualifiers get the same opening resources as before and
    // the screening is what makes them make sense — so this stays empty. Adding
    // anything here changes the Round 1 economy instead of explaining it.
    expect(Object.keys(SCREENING_GRANT)).toHaveLength(0);
  });

  it('keeps the grant a flat per-team bundle if one is ever added', () => {
    // Fixed numbers by construction, so a future value cannot be score-scaled:
    // the screening decides who plays, never who starts ahead.
    for (const value of Object.values(SCREENING_GRANT)) {
      expect(typeof value).toBe('number');
    }
  });
});
