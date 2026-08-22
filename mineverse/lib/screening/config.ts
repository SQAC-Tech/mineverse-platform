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
export const SCREENING_QUESTION_COUNT = 3;

export interface GauntletPuzzleConfig {
  id: number;
  title: string;
  subtitle: string;
  prompt: string;
  errorMessage: string;
  successMessage: string;
  expectedAnswer: string;
}

/**
 * The Enchantment Cipher: shift every letter forward by the number of letters.
 *
 * Lives here rather than in service.ts because Puzzle 3's fallback answer is
 * derived from it. It used to be a hardcoded "FPYI" — the cipher of "BLUE"
 * from an earlier version of the puzzle — while the prompt beside it asked for
 * NETHER BIOME. `gradePuzzle` overrides both with the team's assigned image, so
 * the mismatch only surfaced on an attempt with no image, but a fallback that
 * disagrees with its own prompt is a trap either way.
 */
export function applyCipher(text: string): string {
  const lettersOnly = text.toUpperCase().replace(/[^A-Z]/g, '');
  const shift = lettersOnly.length;
  let result = '';
  for (let i = 0; i < lettersOnly.length; i++) {
    const shifted = (lettersOnly.charCodeAt(i) - 65 + shift) % 26;
    result += String.fromCharCode(shifted + 65);
  }
  return result;
}

export const GAUNTLET_PUZZLES: GauntletPuzzleConfig[] = [
  {
    id: 1,
    title: "PUZZLE 1: Crafting Combinatorics",
    subtitle: "Mathematical Logic & Permutations",
    prompt: "The Iron Golem is guarding the main arena with a combination lock. The numeric PIN is exactly the number of unique ways you can arrange the letters of the word REDSTONE such that all the vowels always remain clustered together in a single unbroken block. What is the PIN to open the iron doors?",
    errorMessage: "The Iron Golem rejects your calculation. Try again.",
    successMessage: "The Golem accepts your PIN! The doors unlock.",
    expectedAnswer: "2160",
  },
  {
    id: 2,
    title: "PUZZLE 2: The Shattered Relic Matrix",
    subtitle: "Spatial Reconstruction Cipher",
    prompt: "The ancient core matrix has been shattered into 8 fragments. Slide the image tiles across the 3x3 grid to align them into their original position and restore the relic picture.",
    errorMessage: "The picture tiles are misaligned. Rearrange the blocks correctly.",
    successMessage: "The matrix aligns perfectly! The mechanism unlocks.",
    expectedAnswer: "SLIDER_SOLVED",
  },
  {
    id: 3,
    title: "PUZZLE 3: The Enchantment Cipher",
    subtitle: "Pattern Recognition & String Manipulation",
    prompt: "You hold a lamp forged in the NETHER BIOME, its eerie light revealing encrypted runes on the gate.\n\nThe Golem's voice echoes heavily:\n\n'The key lies in the origin of your light, but you must discard the physical vessel itself. Take only the two-word name of its home. Shift each letter of those words forward by the total number of characters they contain.'\n\nWhat is the final password?",
    errorMessage: "The cipher remains sealed. Try again.",
    successMessage: "Gate Opened. Server connection established.",
    expectedAnswer: applyCipher('NETHER BIOME'),
  },
];


/* ------------------------------------------------------------ gauntlet scoring */

/**
 * What one solved puzzle is worth, and what finishing all three adds on top.
 *
 * The Gauntlet used to be scored in one place and one place only — the branch in
 * `saveGauntletAnswer` that fires when puzzle 3 lands, which wrote a flat 100.
 * Everything else scored the attempt against `screening_questions`, the table
 * the old 25-question MCQ paper used, which the Gauntlet never writes to. So a
 * team that solved two puzzles and ran out of time was graded against an empty
 * answer set and stored as zero, indistinguishable from a team that opened the
 * page and walked away.
 *
 * Partial credit is the point of splitting it: with 84 teams and one shortlist
 * cut, "how far did they get" has to survive into the ranking or the cut is
 * decided entirely by who happened to finish.
 *
 * The completion bonus keeps a full clear worth exactly 100, which is what the
 * old branch paid, so the two scales cannot be confused when reading a mixed
 * table.
 */
export const GAUNTLET_PUZZLE_POINTS = 25;
export const GAUNTLET_COMPLETION_BONUS = 25;
export const MAX_GAUNTLET_SCORE =
  GAUNTLET_PUZZLES.length * GAUNTLET_PUZZLE_POINTS + GAUNTLET_COMPLETION_BONUS;

export interface GauntletScore {
  /** Puzzles solved, however far apart they were solved. */
  correct_count: number;
  raw_score: number;
  completed: boolean;
}

/**
 * Scores an attempt from the puzzles it actually solved.
 *
 * Takes ids rather than the stored blob so it stays pure and the storage shape
 * can change without touching the scale. Unknown and duplicate ids are dropped:
 * the blob is written by an older version of this code on some rows, and a
 * scoring function is the wrong place to trust its contents.
 */
export function scoreGauntlet(solvedPuzzleIds: Iterable<number>): GauntletScore {
  const valid = new Set<number>();
  for (const id of solvedPuzzleIds) {
    if (GAUNTLET_PUZZLES.some((puzzle) => puzzle.id === id)) valid.add(id);
  }

  const completed = valid.size === GAUNTLET_PUZZLES.length;
  return {
    correct_count: valid.size,
    raw_score: valid.size * GAUNTLET_PUZZLE_POINTS + (completed ? GAUNTLET_COMPLETION_BONUS : 0),
    completed,
  };
}


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
  /**
   * `rounds.status`. Optional so the pure boundary tests can leave it out, but
   * every real caller passes it — see the note in `windowState`.
   */
  status?: string | null;
}

export type WindowState = 'before' | 'open' | 'closed' | 'unset';

export function windowState(window: ScreeningWindow, now: number = Date.now()): WindowState {
  if (!window.startsAt || !window.endsAt) return 'unset';

  /**
   * The round's own switch closes it, whatever the clock says.
   *
   * This checked the timestamps and nothing else, so closing the round from the
   * console did exactly nothing: the admin action writes `status = 'completed'`
   * and leaves `ends_at` alone, and `ends_at` was the only thing anyone read.
   * An organizer who opened the qualifier early to test it could mark it closed,
   * watch the console agree, and still have it open to all 90 teams until the
   * clock happened to run out.
   *
   * Checked before the timestamps because it is the more authoritative of the
   * two: the window is a schedule, and this is a human overriding it.
   */
  if (window.status !== undefined && window.status !== null && window.status !== 'active') return 'closed';

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
