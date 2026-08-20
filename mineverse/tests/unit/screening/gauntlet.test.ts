import { describe, expect, it } from 'vitest';
import { GAUNTLET_PUZZLES } from '@/lib/screening/config';

describe("The Iron Golem's Gauntlet Logic", () => {
  it('contains 3 sequential interlocked puzzles', () => {
    expect(GAUNTLET_PUZZLES).toHaveLength(3);
    expect(GAUNTLET_PUZZLES[0].id).toBe(1);
    expect(GAUNTLET_PUZZLES[1].id).toBe(2);
    expect(GAUNTLET_PUZZLES[2].id).toBe(3);
  });

  it('validates Puzzle 1: Resource Math (Deficit calculation = 20)', () => {
    const puzzle1 = GAUNTLET_PUZZLES[0];
    expect(puzzle1.expectedAnswer).toBe('20');

    // Logic verification: 25 wood + 15 wood bundle = 40 wood. 60 required - 40 = 20.
    const startingWood = 25;
    const woodBundle = 15;
    const totalWood = startingWood + woodBundle;
    const requiredWood = 60;
    const deficit = requiredWood - totalWood;
    expect(deficit).toBe(20);
  });

  it('validates Puzzle 2: Redstone Lock (Lever #20 -> BLUE lamp)', () => {
    const puzzle2 = GAUNTLET_PUZZLES[1];
    expect(puzzle2.expectedAnswer).toBe('BLUE');
  });

  it('validates Puzzle 3: Enchantment Cipher (BLUE shifted by +4 -> FPYI)', () => {
    const puzzle3 = GAUNTLET_PUZZLES[2];
    expect(puzzle3.expectedAnswer).toBe('FPYI');

    // Cipher verification logic: "BLUE" shifted +4
    const baseWord = 'BLUE';
    const shift = baseWord.length; // 4
    const ciphered = baseWord
      .split('')
      .map((char) => String.fromCharCode(((char.charCodeAt(0) - 65 + shift) % 26) + 65))
      .join('');

    expect(ciphered).toBe('FPYI');
  });
});
