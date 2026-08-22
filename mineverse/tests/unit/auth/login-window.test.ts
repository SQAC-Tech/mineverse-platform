import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { istDateString, isEventDay, isScreeningDay } from '@/lib/auth/otp';
import { loginOpenDefault, nextLoginOpening, type LoginState } from '@/lib/platform/settings';

/**
 * Teams have to be able to log in on the evening of their own qualifier.
 *
 * The gate was one line — `isEventDay()`, or a 403 reading "Login is only
 * available on event day." The screening runs two days before the event, so on
 * its own evening every real team would have been turned away. Demo teams skip
 * the gate, which is exactly why it survived every walk-through.
 */

const ORIGINAL = { event: process.env.EVENT_DATE, screening: process.env.SCREENING_DATE };

// 22 Aug 2026, 6:30 PM IST — inside the screening window. In UTC this is still
// the 22nd, but 11 PM IST would be the 22nd in IST and the 21st in UTC, which
// is the case the naive check gets wrong.
const SCREENING_EVENING = new Date('2026-08-22T18:30:00+05:30');
const LATE_SCREENING_NIGHT = new Date('2026-08-22T23:30:00+05:30');
const EVENT_MORNING = new Date('2026-08-24T09:00:00+05:30');
const DAY_BETWEEN = new Date('2026-08-23T12:00:00+05:30');

beforeEach(() => {
  process.env.EVENT_DATE = '2026-08-24';
  process.env.SCREENING_DATE = '2026-08-22';
});

afterEach(() => {
  if (ORIGINAL.event === undefined) delete process.env.EVENT_DATE;
  else process.env.EVENT_DATE = ORIGINAL.event;
  if (ORIGINAL.screening === undefined) delete process.env.SCREENING_DATE;
  else process.env.SCREENING_DATE = ORIGINAL.screening;
});

describe('istDateString', () => {
  it('reports the IST calendar day, not the UTC one', () => {
    // 11:30 PM IST on the 22nd is 6 PM UTC on the 22nd — same day.
    expect(istDateString(LATE_SCREENING_NIGHT)).toBe('2026-08-22');
    // 00:30 IST on the 23rd is 7 PM UTC on the 22nd. The team is in the 23rd.
    expect(istDateString(new Date('2026-08-23T00:30:00+05:30'))).toBe('2026-08-23');
  });
});

describe('the login gate', () => {
  it('is open on the screening evening', () => {
    expect(isScreeningDay(SCREENING_EVENING)).toBe(true);
    expect(loginOpenDefault(SCREENING_EVENING)).toBe(true);
  });

  it('stays open late on the screening night, when the window is still running', () => {
    expect(loginOpenDefault(LATE_SCREENING_NIGHT)).toBe(true);
  });

  it('is open on event day', () => {
    expect(isEventDay(EVENT_MORNING)).toBe(true);
    expect(loginOpenDefault(EVENT_MORNING)).toBe(true);
  });

  it('is shut on the day in between', () => {
    expect(loginOpenDefault(DAY_BETWEEN)).toBe(false);
  });

  it('falls back to event day alone when no screening date is configured', () => {
    // Unset must behave exactly as it did before the qualifier existed, so a
    // deployment that never sets it is not silently opened up.
    delete process.env.SCREENING_DATE;
    expect(isScreeningDay(SCREENING_EVENING)).toBe(false);
    expect(loginOpenDefault(SCREENING_EVENING)).toBe(false);
    expect(loginOpenDefault(EVENT_MORNING)).toBe(true);
  });

  it('does not treat an empty screening date as "every day"', () => {
    process.env.SCREENING_DATE = '';
    expect(isScreeningDay(SCREENING_EVENING)).toBe(false);
    expect(loginOpenDefault(DAY_BETWEEN)).toBe(false);
  });
});

describe('the route that enforces it', () => {
  const route = readFileSync(
    join(__dirname, '..', '..', '..', 'app', 'api', 'auth', 'login', 'request-otp', 'route.ts'),
    'utf8',
  );

  it('asks the resolver rather than checking the date itself', () => {
    expect(route).toMatch(/getLoginState/);
    // Checked at the import rather than by scanning the body: the route cannot
    // call what it does not import, and the body still mentions `isEventDay` in
    // the comment explaining why it stopped using it.
    const imports = route.slice(0, route.indexOf('export async function'));
    expect(imports).not.toMatch(/isEventDay/);
  });

  it('still exempts demo teams', () => {
    expect(route).toMatch(/!isDemoTeam/);
  });

  it('names the day it opens instead of just refusing', () => {
    // A team that turned up on the wrong evening needs to know which one is
    // right; "not today" sends them to the organizers' phones.
    expect(route).toMatch(/Login opens on/);
  });
});


/**
 * The refusal has to name the right day.
 *
 * It listed `SCREENING_DATE` and `EVENT_DATE` straight from the environment, so
 * a deployment that had not set the first one told teams "Login opens on
 * 2026-08-24" on the evening of the screening — the one day it most needed to
 * be right. Round 0's window is the authoritative answer: it is set in the
 * console by whoever schedules the qualifier, so it cannot drift from the day
 * teams were told to turn up.
 */
describe('the screening day, taken from round 0', () => {
  const withWindow = (startsAt: string | null): LoginState => ({
    open: false,
    source: 'schedule',
    scheduled: false,
    event_date: '2026-08-24',
    screening_date: null,
    screening_starts_at: startsAt,
  });

  it('opens login on the day the window starts, with no env var set', () => {
    delete process.env.SCREENING_DATE;
    expect(loginOpenDefault(SCREENING_EVENING, '2026-08-22T18:00:00+05:30')).toBe(true);
  });

  it('does not open login on other days', () => {
    delete process.env.SCREENING_DATE;
    expect(loginOpenDefault(DAY_BETWEEN, '2026-08-22T18:00:00+05:30')).toBe(false);
  });

  it('names the screening time, not event day, while the screening is still ahead', () => {
    const noon = new Date('2026-08-22T12:00:00+05:30');
    const label = nextLoginOpening(withWindow('2026-08-22T18:00:00+05:30'), noon);
    expect(label).toMatch(/22 Aug/);
    expect(label).toMatch(/6:00 pm/i);
    expect(label).toMatch(/screening/i);
  });

  it('moves on to event day once the screening has started', () => {
    const evening = new Date('2026-08-22T19:00:00+05:30');
    expect(nextLoginOpening(withWindow('2026-08-22T18:00:00+05:30'), evening)).toBe('24 Aug');
  });

  it('falls back to event day when no window is set', () => {
    const noon = new Date('2026-08-22T12:00:00+05:30');
    expect(nextLoginOpening(withWindow(null), noon)).toBe('24 Aug');
  });

  it('says nothing rather than something wrong once every date is past', () => {
    const after = new Date('2026-09-01T12:00:00+05:30');
    expect(nextLoginOpening(withWindow('2026-08-22T18:00:00+05:30'), after)).toBeNull();
  });
});
