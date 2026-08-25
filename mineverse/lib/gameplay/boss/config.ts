/**
 * The Ender Dragon, as it is actually run.
 *
 * Plain data with no database import, the same split as
 * `lib/gameplay/guardians/config.ts`: the arena needs these numbers to draw a
 * clock, and the arena is a client component.
 */

/** Questions in the pack. Drawn from `screening_questions`, which holds 50. */
export const BOSS_QUESTION_COUNT = 25;

/**
 * How long a team has once it opens the fight.
 *
 * Thirty minutes inside Round 5's ninety, not beside them — a team that spends
 * the whole window on the dragon has an hour left for the seven questions, and
 * one that finishes in ten has eighty. The round clock does not stop for this.
 */
export const BOSS_DURATION_SECONDS = 30 * 60;

/** The whole of Round 5, the dragon included. */
export const ROUND5_DURATION_SECONDS = 90 * 60;

/**
 * Correct answers needed for the attempt to read as a win.
 *
 * The label is for the team and the console; it is not what the standings use.
 * Round 5 is ranked on total correct answers with the dragon and the seven
 * questions in one pile, so a team that answers eighteen here is ahead of one
 * that answers twelve whether or not either is called a winner.
 */
export const BOSS_PASS_MARK = Math.ceil(BOSS_QUESTION_COUNT / 2);

/**
 * One attempt, ever.
 *
 * There is no cooldown and no second try: the fight is mandatory, so every team
 * takes it, and letting a team re-enter after seeing the paper would hand the
 * twenty-five answers to whoever failed first on purpose.
 */
export const BOSS_ATTEMPTS_ALLOWED = 1;
