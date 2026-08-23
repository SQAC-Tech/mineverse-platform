import { describe, expect, it } from 'vitest';
import {
  applyOptionOrder, drawPaper, resolveSelectedIndex, shuffleOptions, type DrawableQuestion,
} from '@/lib/screening/draw';
import { DRAW_MIX, MAX_RAW_SCORE, type Difficulty } from '@/lib/screening/config';

function bank(easy = 20, medium = 20, hard = 10): DrawableQuestion[] {
  const rows: DrawableQuestion[] = [];
  const push = (difficulty: Difficulty, count: number) => {
    for (let i = 0; i < count; i += 1) rows.push({ id: `${difficulty}-${i}`, difficulty });
  };
  push('easy', easy);
  push('medium', medium);
  push('hard', hard);
  return rows;
}

const TEAM_A = '986c854b-3228-456a-a6ea-2c9ad25caade';
const TEAM_B = 'e134f8f3-147d-49a6-8140-2d28cba042d3';

describe('the draw', () => {
  it('deals the exact mix every time, so no paper is easier than another', () => {
    const paper = drawPaper(bank(), TEAM_A);
    const counts = { easy: 0, medium: 0, hard: 0 };
    for (const id of paper.questionIds) counts[id.split('-')[0] as Difficulty] += 1;

    expect(counts).toEqual(DRAW_MIX);
    expect(paper.questionIds).toHaveLength(25);
    expect(paper.shortfall).toBeNull();
  });

  it('is deterministic per team — a reload cannot reroll a better paper', () => {
    const first = drawPaper(bank(), TEAM_A);
    const second = drawPaper(bank(), TEAM_A);
    expect(second.questionIds).toEqual(first.questionIds);
    expect(second.optionOrder).toEqual(first.optionOrder);
  });

  it('does not depend on the order the bank came back from the database', () => {
    const straight = drawPaper(bank(), TEAM_A);
    const shuffled = drawPaper([...bank()].reverse(), TEAM_A);
    // Postgres has no guaranteed row order without ORDER BY, so a draw that
    // depended on it would silently differ between two identical requests.
    expect(shuffled.questionIds).toEqual(straight.questionIds);
  });

  it('gives different teams different papers', () => {
    const a = drawPaper(bank(), TEAM_A);
    const b = drawPaper(bank(), TEAM_B);
    expect(a.questionIds).not.toEqual(b.questionIds);
  });

  it('does not run easy-then-hard, which would leak the difficulty the config hides', () => {
    const paper = drawPaper(bank(), TEAM_A);
    const difficulties = paper.questionIds.map((id) => id.split('-')[0]);
    const firstTen = new Set(difficulties.slice(0, 10));
    expect(firstTen.size).toBeGreaterThan(1);
  });

  it('reports a shortfall rather than dealing a short paper', () => {
    // A short paper would be scored out of a different maximum than everyone
    // else's, which is worse than refusing to start.
    const paper = drawPaper(bank(20, 20, 2), TEAM_A);
    expect(paper.shortfall).toEqual({ hard: 3 });
  });

  it('reaches the whole bank across many teams, so 30 questions are not dead weight', () => {
    const used = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      for (const id of drawPaper(bank(), `team-${i}`).questionIds) used.add(id);
    }
    expect(used.size).toBe(50);
  });
});

describe('option shuffling', () => {
  it('permutes all four options without dropping or duplicating one', () => {
    const order = shuffleOptions('q-1', TEAM_A);
    expect([...order].sort()).toEqual([0, 1, 2, 3]);
  });

  it('shows different teams a different option order', () => {
    // This is what stops a screenshot of one team's paper answering another's.
    const orders = new Set(
      Array.from({ length: 40 }, (_, i) => shuffleOptions('q-1', `team-${i}`).join('')),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  /**
   * Guards the bug this file caught: with a plain FNV-1a hash, keys ending in
   * 0..3 sorted monotonically, so every "shuffle" was one of the four rotations
   * of [0,1,2,3] — a screenshot still gave away three of the four positions.
   */
  it('produces real permutations, not just rotations', () => {
    const ROTATIONS = new Set(['0123', '1230', '2301', '3012']);
    const seen = new Set(
      Array.from({ length: 200 }, (_, i) => shuffleOptions(`q-${i}`, `team-${i}`).join('')),
    );

    const nonRotations = [...seen].filter((order) => !ROTATIONS.has(order));
    expect(nonRotations.length).toBeGreaterThan(0);
    // 4! = 24 possible orders; a healthy hash reaches most of them.
    expect(seen.size).toBeGreaterThan(12);
  });

  it('round-trips a click back to the stored index', () => {
    const stored = ['A', 'B', 'C', 'D'];
    const order = shuffleOptions('q-7', TEAM_A);
    const shown = applyOptionOrder(stored, order);

    // Whatever slot the player clicked, resolving it must name the same option
    // they actually saw — grading compares against the stored index.
    for (let slot = 0; slot < 4; slot += 1) {
      expect(stored[resolveSelectedIndex(slot, order)]).toBe(shown[slot]);
    }
  });

  it('rejects a slot outside the four options', () => {
    expect(resolveSelectedIndex(9, shuffleOptions('q-1', TEAM_A))).toBe(-1);
  });
});

describe('the scoring ceiling', () => {
  it('is 50', () => {
    // 10 x 1.5 + 10 x 2 + 5 x 3. Guards against someone changing the mix or a
    // weight without noticing the maximum moved.
    expect(MAX_RAW_SCORE).toBe(50);
  });
});
