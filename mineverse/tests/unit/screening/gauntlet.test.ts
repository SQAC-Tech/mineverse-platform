import { describe, expect, it } from 'vitest';
import { GAUNTLET_PUZZLES, applyCipher } from '@/lib/screening/config';
import { calculateCombinatorics } from '@/lib/screening/relayLogic';

/**
 * The Gauntlet's three puzzles, and the answers they are marked against.
 *
 * This file previously asserted the answers of an earlier design — a resource
 * deficit of 20 and a BLUE lamp — and kept passing right up until the puzzles
 * were rewritten, at which point it failed on `main` rather than catching
 * anything. The lesson is in how it is written now: each answer is derived from
 * the same function the grader uses, so rewording a prompt without moving its
 * answer fails here instead of at a team's desk.
 *
 * Both the combinatorics and the cipher answers are overridden per team in
 * `gradePuzzle` — from `word_assigned` and `image_assigned`. What is checked
 * here is the fallback, which is what a team sees if either is missing.
 */
describe("The Iron Golem's Gauntlet", () => {
  it('is three sequential puzzles', () => {
    expect(GAUNTLET_PUZZLES).toHaveLength(3);
    expect(GAUNTLET_PUZZLES.map((puzzle) => puzzle.id)).toEqual([1, 2, 3]);
  });

  it('gives every puzzle the copy the UI needs', () => {
    for (const puzzle of GAUNTLET_PUZZLES) {
      for (const field of ['title', 'subtitle', 'prompt', 'errorMessage', 'successMessage', 'expectedAnswer'] as const) {
        expect(puzzle[field], `puzzle ${puzzle.id}.${field}`).toBeTruthy();
      }
    }
  });

  it('answers Puzzle 1 with the arrangements of the word in its own prompt', () => {
    const puzzle = GAUNTLET_PUZZLES[0];
    const word = puzzle.prompt.match(/word ([A-Z]{3,})/)?.[1];
    expect(word, 'puzzle 1 prompt should name a word in capitals').toBeTruthy();

    // The same function `gradePuzzle` marks a real attempt with.
    expect(puzzle.expectedAnswer).toBe(String(calculateCombinatorics(word!)));
  });

  it('marks Puzzle 2 with the sentinel the slider posts, not a typed answer', () => {
    // The Shattered Relic Matrix is solved by dragging tiles, so the client
    // submits a fixed token once the grid is complete rather than a value a
    // team could guess and type.
    expect(GAUNTLET_PUZZLES[1].expectedAnswer).toBe('SLIDER_SOLVED');
  });

  it('answers Puzzle 3 with the cipher of the place its own prompt names', () => {
    const puzzle = GAUNTLET_PUZZLES[2];
    expect(puzzle.prompt).toContain('NETHER BIOME');
    expect(puzzle.expectedAnswer).toBe(applyCipher('NETHER BIOME'));
  });

  it('shifts each letter by the length of the phrase', () => {
    // "BLUE" is four letters, so +4: B->F, L->P, U->Y, E->I.
    expect(applyCipher('BLUE')).toBe('FPYI');
    // Spaces are not letters and must not count toward the shift.
    expect(applyCipher('NETHER BIOME')).toBe(applyCipher('NETHERBIOME'));
    expect(applyCipher('BLUE')).toHaveLength(4);
  });

  it('wraps past Z rather than running off the alphabet', () => {
    // "ZZ" is two letters, so +2: Z->B twice.
    expect(applyCipher('ZZ')).toBe('BB');
    expect(applyCipher('NETHER BIOME')).toMatch(/^[A-Z]+$/);
  });
});
