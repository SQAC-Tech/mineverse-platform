/**
 * Screening rules as plain data, with no database import.
 *
 * Client components need the question count and the duration to render the
 * instructions screen, so this file has to stay importable from the browser.
 * Same split as `gameplay/guardians/config.ts` — nothing here may touch
 * `supabaseServer`, which carries the service-role key.
 *
 * WHAT A PLAYER MAY SEE: `SCREENING_DURATION_MINUTES`, `SCREENING_QUESTION_COUNT`.
 * WHAT A PLAYER MUST NOT SEE: the difficulty weights, the draw mix, and the
 * first-year bonus. A team that knows hard questions pay double will farm the
 * five hard ones and skip the rest; a team that knows about the bonus reads it
 * as a quota. None of the organiser-only values below are ever serialized into
 * a player-facing response — see `serializeScreeningQuestion`.
 */

export const SCREENING_ROUND_ID = 0;

export const SCREENING_DURATION_MINUTES = 30;
export const SCREENING_DURATION_MS = SCREENING_DURATION_MINUTES * 60_000;
export const SCREENING_QUESTION_COUNT = 25;

export type Difficulty = 'easy' | 'medium' | 'hard';

/** Organiser-only. */
export const DIFFICULTY_POINTS: Record<Difficulty, number> = {
  easy: 1.5,
  medium: 2,
  hard: 3,
};

/**
 * Organiser-only. Every team draws the same mix, so one paper cannot be luckier
 * than another — only differently worded. 10(1.5) + 10(2) + 5(3) = 50.
 */
export const DRAW_MIX: Record<Difficulty, number> = {
  easy: 10,
  medium: 10,
  hard: 5,
};

export const MAX_RAW_SCORE = (Object.keys(DRAW_MIX) as Difficulty[]).reduce(
  (total, key) => total + DRAW_MIX[key] * DIFFICULTY_POINTS[key],
  0,
);

/**
 * Organiser-only. Awarded when *every* member of the team is a first year.
 *
 * A team is the unit here and teams can be mixed. Paying any team that contains
 * one first year would let a single junior carry two seniors past an
 * all-first-year team, which inverts the intent of favouring first years.
 */
export const FIRST_YEAR_BONUS = 10;

/**
 * Extra resources granted on top of what a team already starts with.
 *
 * Empty, and that is the correct value — not a placeholder.
 *
 * Every team already opens with wood 25, stone 10, emerald 5. That bundle is not
 * granted by any code path: it is the DEFAULT on the `resources` columns, so the
 * row `ensureTeamResources` upserts arrives already carrying it. (`docs/event
 * details/PITCHES.md` still says teams "start with an empty inventory" — the
 * doc is out of date against the schema. Trust the column defaults.)
 *
 * The brief was that qualifiers get the same opening resources as before, and
 * that the screening is what makes those resources make sense. Adding anything
 * here would change the Round 1 economy rather than explain it: the Wooden
 * Pickaxe gate is 60 wood, so even a small top-up moves how hard Round 1 is.
 *
 * If a screening-specific bonus is ever wanted, putting it here is enough — the
 * grant path is already idempotent per team.
 */
export const SCREENING_GRANT: Record<string, number> = {};

/** Only fully paid teams may sit the paper. */
export const REQUIRE_PAYMENT_VERIFIED = true;

/**
 * Inside this much of the window closing, the UI warns that starting now still
 * buys the full 30 minutes. Nobody should start believing they'll be cut off.
 */
export const LATE_START_WARNING_MS = SCREENING_DURATION_MS;

export interface ScreeningWindow {
  startsAt: string | null;
  endsAt: string | null;
}

export type WindowState = 'before' | 'open' | 'closed' | 'unset';

export function windowState(window: ScreeningWindow, now: number = Date.now()): WindowState {
  if (!window.startsAt || !window.endsAt) return 'unset';
  if (now < new Date(window.startsAt).getTime()) return 'before';
  if (now >= new Date(window.endsAt).getTime()) return 'closed';
  return 'open';
}

/**
 * The window gates STARTING and nothing else.
 *
 * A team that starts at 23:58 keeps its full half hour and submits at 00:28.
 * Every route except `start` reads the attempt's own `deadline_at` and ignores
 * the window — deliberately not the `ends_at` lock the game round shells use,
 * which would strand exactly that team.
 */
export function canStart(window: ScreeningWindow, now: number = Date.now()): boolean {
  return windowState(window, now) === 'open';
}

export function deadlineFrom(startedAt: string | number | Date): Date {
  return new Date(new Date(startedAt).getTime() + SCREENING_DURATION_MS);
}

/**
 * Dev-only: treat the window as open whatever the date says.
 *
 * Reuses the existing `NEXT_PUBLIC_DEV_UNLOCK_ALL_ROUNDS` flag rather than
 * inventing a second one, and rather than moving the real window on the shared
 * database — the round is live for 41 teams, and a date edited for a local walk
 * through would open the qualifier for all of them.
 *
 * Deliberately kept out of `windowState` and `canStart`, which stay pure and
 * are asserted against the exact IST boundaries. The bypass is applied at the
 * two call sites that need it, where it is visible.
 *
 * NEVER set that flag in production.
 */
export const DEV_OPEN_SCREENING = process.env.NEXT_PUBLIC_DEV_UNLOCK_ALL_ROUNDS === 'true';
