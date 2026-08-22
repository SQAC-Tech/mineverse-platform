import { describe, expect, it } from 'vitest';
import {
  GAUNTLET_COMPLETION_BONUS,
  GAUNTLET_PUZZLES,
  GAUNTLET_PUZZLE_POINTS,
  MAX_GAUNTLET_SCORE,
  scoreGauntlet,
} from '@/lib/screening/config';
import { solvedPuzzleIds, totalTries, type GauntletState } from '@/lib/screening/service';
import { sortByRank } from '@/lib/screening/shortlist';

/**
 * How far a team got, and what that is worth.
 *
 * The regression underneath this file: the Gauntlet was scored in exactly one
 * place — the branch that fires when puzzle 3 lands, which wrote a flat 100 —
 * while `submitAttempt`, which every timeout and every deadline sweep goes
 * through, scored the attempt against `screening_questions` joined to
 * `screening_answers`. Those are the tables the retired 25-question MCQ paper
 * used and the Gauntlet writes to neither, so an attempt that ran out of time
 * was graded against an empty answer set: zero, whether it had solved two
 * puzzles or opened the page and walked away.
 */

describe('scoring a Gauntlet attempt', () => {
  it('pays for each puzzle solved, not only for finishing', () => {
    // The whole point. Under the old scoring both of these were 0.
    expect(scoreGauntlet([1]).raw_score).toBe(GAUNTLET_PUZZLE_POINTS);
    expect(scoreGauntlet([1, 2]).raw_score).toBe(GAUNTLET_PUZZLE_POINTS * 2);
  });

  it('keeps a full clear worth exactly 100', () => {
    // The number the old completion branch wrote. Two scales in one column
    // would make a mixed table unreadable, so the bonus is sized to preserve it.
    const all = GAUNTLET_PUZZLES.map((puzzle) => puzzle.id);
    expect(scoreGauntlet(all).raw_score).toBe(100);
    expect(scoreGauntlet(all).raw_score).toBe(MAX_GAUNTLET_SCORE);
    expect(scoreGauntlet(all).completed).toBe(true);
  });

  it('pays the completion bonus only on a full clear', () => {
    const partial = GAUNTLET_PUZZLES.slice(0, -1).map((puzzle) => puzzle.id);
    expect(scoreGauntlet(partial).completed).toBe(false);
    expect(scoreGauntlet(partial).raw_score).toBe(partial.length * GAUNTLET_PUZZLE_POINTS);
    expect(MAX_GAUNTLET_SCORE - scoreGauntlet(partial).raw_score).toBe(
      GAUNTLET_PUZZLE_POINTS + GAUNTLET_COMPLETION_BONUS,
    );
  });

  it('scores an untouched attempt as nothing', () => {
    expect(scoreGauntlet([])).toEqual({ correct_count: 0, raw_score: 0, completed: false });
  });

  it('never pays twice for the same puzzle', () => {
    // A retry that is graded again must not be worth another 25.
    expect(scoreGauntlet([1, 1, 1])).toEqual(scoreGauntlet([1]));
  });

  it('ignores a puzzle id that is not in the Gauntlet', () => {
    // The state blob is written by whatever version of the code was deployed at
    // the time; a scoring function is the wrong place to trust it.
    expect(scoreGauntlet([1, 99, -1, 0]).correct_count).toBe(1);
    expect(scoreGauntlet([99]).raw_score).toBe(0);
  });

  it('is monotonic — solving one more puzzle never scores less', () => {
    const ids = GAUNTLET_PUZZLES.map((puzzle) => puzzle.id);
    for (let count = 0; count < ids.length; count += 1) {
      expect(scoreGauntlet(ids.slice(0, count + 1)).raw_score)
        .toBeGreaterThan(scoreGauntlet(ids.slice(0, count)).raw_score);
    }
  });
});

describe('reading an attempt’s state blob', () => {
  it('counts a puzzle solved when progress records a solve time', () => {
    const state: GauntletState = {
      progress: { 1: { tries: 3, solved_at: '2026-08-24T10:00:00Z' }, 2: { tries: 5, solved_at: null } },
    };
    expect(solvedPuzzleIds(state)).toEqual([1]);
  });

  it('falls back to the answers map for rows written before progress existed', () => {
    // `answers` only ever gains an entry when an answer was accepted, so the
    // two agree; this is what keeps an attempt started on the old code scorable.
    expect(solvedPuzzleIds({ answers: { 1: '2160', 3: 'ZQFTQD' } })).toEqual([1, 3]);
  });

  it('agrees with itself when both are present', () => {
    const state: GauntletState = {
      answers: { 1: '2160' },
      progress: { 1: { tries: 1, solved_at: '2026-08-24T10:00:00Z' } },
    };
    expect(solvedPuzzleIds(state)).toEqual([1]);
  });

  it('treats a missing or empty blob as nothing solved', () => {
    expect(solvedPuzzleIds(null)).toEqual([]);
    expect(solvedPuzzleIds(undefined)).toEqual([]);
    expect(solvedPuzzleIds({})).toEqual([]);
  });

  it('adds up every answer submitted, right or wrong', () => {
    // Wrong answers are logged too — a numeric PIN that took forty guesses is
    // the thing an organiser wants to see beside a shortlist decision.
    const state: GauntletState = {
      progress: {
        1: { tries: 40, solved_at: '2026-08-24T10:00:00Z' },
        2: { tries: 1, solved_at: '2026-08-24T10:05:00Z' },
        3: { tries: 7, solved_at: null },
      },
    };
    expect(totalTries(state)).toBe(48);
    expect(totalTries({})).toBe(0);
    expect(totalTries(null)).toBe(0);
  });
});

describe('what partial credit does to the cut', () => {
  it('ranks a team that solved two puzzles above one that solved none', () => {
    // Under the old scoring both stored 0 and the cut fell to submit time, so a
    // team that got nowhere quickly beat a team that nearly finished.
    const near = scoreGauntlet([1, 2]);
    const nothing = scoreGauntlet([]);

    const ranked = sortByRank([
      { team_code: 'MNV-100', total_score: nothing.raw_score, submitted_at: '2026-08-24T10:10:00Z' },
      { team_code: 'MNV-200', total_score: near.raw_score, submitted_at: '2026-08-24T10:30:00Z' },
    ]);

    expect(ranked.map((team) => team.team_code)).toEqual(['MNV-200', 'MNV-100']);
  });

  it('still separates two equally far teams by who finished first', () => {
    const score = scoreGauntlet([1, 2]).raw_score;
    const ranked = sortByRank([
      { team_code: 'MNV-200', total_score: score, submitted_at: '2026-08-24T10:30:00Z' },
      { team_code: 'MNV-100', total_score: score, submitted_at: '2026-08-24T10:10:00Z' },
    ]);
    expect(ranked.map((team) => team.team_code)).toEqual(['MNV-100', 'MNV-200']);
  });
});
