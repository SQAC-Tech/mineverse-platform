/**
 * Drawing a team's paper.
 *
 * Deterministic from the team id, so a reload rebuilds the identical paper and
 * there is no reroll to farm — the alternative, storing a random draw, is only
 * safe until someone finds a way to make `start` run twice. Both are stored
 * anyway (`question_ids`, `option_order`), because the bank can change and a
 * graded attempt must stay reproducible against the paper it actually saw.
 *
 * Pure: no database, no env, no `Math.random`. That is what makes it testable.
 */

import { DRAW_MIX, type Difficulty } from './config';

export interface DrawableQuestion {
  id: string;
  difficulty: Difficulty;
}

/**
 * FNV-1a with a MurmurHash3 finaliser.
 *
 * The avalanche step is not decoration. Plain FNV-1a ends by multiplying by the
 * prime, so two keys differing only in their last character hash to values
 * differing by almost exactly that prime — and every key here ends in a digit
 * that varies (`opt:<id>:0..3`, `order:<id>`). Sorting on the raw hash therefore
 * produced a *monotonic* sequence: the paper came out grouped easy-then-hard,
 * and the option "shuffle" was only ever a rotation of [0,1,2,3].
 *
 * fmix32 spreads a one-bit input change across the whole output, which is what
 * the seeded sorts below assume.
 */
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 3266489909);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function score(seed: string, key: string): number {
  return hashString(`${seed}::${key}`);
}

/**
 * Sorts by a seeded hash rather than shuffling in place, so the result depends
 * only on the seed and the input set — not on the order rows came back from
 * Postgres, which has no guaranteed order without an ORDER BY.
 */
function seededPick<T extends { id: string }>(items: T[], seed: string, scope: string, count: number): T[] {
  return [...items]
    .sort((a, b) => score(seed, `${scope}:${a.id}`) - score(seed, `${scope}:${b.id}`))
    .slice(0, count);
}

export interface DrawResult {
  /** The sealed paper, in display order. */
  questionIds: string[];
  /**
   * Per question, the permutation shown to this team: `optionOrder[qid][slot]`
   * is the index in the *stored* options array that appears at that slot.
   * A screenshot of one team's paper therefore does not answer another's.
   */
  optionOrder: Record<string, number[]>;
  /** Set when the bank could not fill the mix — the caller must refuse to start. */
  shortfall: Partial<Record<Difficulty, number>> | null;
}

export function drawPaper(bank: DrawableQuestion[], teamId: string): DrawResult {
  const picked: DrawableQuestion[] = [];
  const shortfall: Partial<Record<Difficulty, number>> = {};

  for (const difficulty of Object.keys(DRAW_MIX) as Difficulty[]) {
    const want = DRAW_MIX[difficulty];
    const pool = bank.filter((question) => question.difficulty === difficulty);
    const got = seededPick(pool, teamId, difficulty, want);
    if (got.length < want) shortfall[difficulty] = want - got.length;
    picked.push(...got);
  }

  // Interleaved by a final seeded sort so the paper does not run easy-then-hard,
  // which would tell a player the difficulty the config deliberately hides.
  const ordered = picked.sort((a, b) => score(teamId, `order:${a.id}`) - score(teamId, `order:${b.id}`));

  const optionOrder: Record<string, number[]> = {};
  for (const question of ordered) {
    optionOrder[question.id] = shuffleOptions(question.id, teamId);
  }

  return {
    questionIds: ordered.map((question) => question.id),
    optionOrder,
    shortfall: Object.keys(shortfall).length > 0 ? shortfall : null,
  };
}

/** A seeded permutation of [0,1,2,3]. */
export function shuffleOptions(questionId: string, teamId: string): number[] {
  return [0, 1, 2, 3].sort(
    (a, b) => score(teamId, `opt:${questionId}:${a}`) - score(teamId, `opt:${questionId}:${b}`),
  );
}

/** The options as this team sees them. */
export function applyOptionOrder(options: string[], order: number[]): string[] {
  return order.map((index) => options[index]);
}

/**
 * Turns the slot a player clicked back into an index into the stored options.
 *
 * Grading compares against `correct_index`, which is stored-order, so skipping
 * this step would mark the shuffle itself as the answer.
 */
export function resolveSelectedIndex(selectedSlot: number, order: number[]): number {
  return order[selectedSlot] ?? -1;
}
