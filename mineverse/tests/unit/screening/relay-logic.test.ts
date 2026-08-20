import { describe, expect, it } from 'vitest';
import { RELAY_WORDS, calculateCombinatorics, generateCodeSnippets } from '../../../lib/screening/relayLogic';

/**
 * The Gauntlet's first puzzle is generated, not written down.
 *
 * For a first-year the prompt asks for the number of arrangements of a word
 * with its vowels kept together; for everyone else the same number is hidden
 * inside a program they have to trace. `gradePuzzle` marks both against
 * `calculateCombinatorics(word_assigned)`, so if the generated program prints
 * anything else the puzzle is unsolvable — the team traces the code correctly
 * and is still told it is wrong.
 *
 * Nothing else checks that, and it cannot be caught by eye: the generator picks
 * its constants at random on every call.
 */

/** What the generated program computes: `(C << S) * (D + E)`. */
function evaluateSnippet(js: string) {
  const data = js.match(/chunk_data = \[([^\]]+)\]/);
  const signal = js.match(/redstone_signal = (-?\d+)/);
  if (!data || !signal) throw new Error('snippet did not match the expected shape');

  const nums = data[1].split(',').map((entry) => Number(entry.trim()));
  const shift = Number(signal[1]);
  return (nums[2] << shift) * (nums[3] + nums[4]);
}

describe('relay combinatorics', () => {
  it('counts arrangements with the vowels kept together', () => {
    // "redstone": consonants r,d,s,t,n plus one vowel block = 6! = 720
    // arrangements, and the block itself is e,e,o = 3!/2! = 3. 720 * 3 = 2160.
    expect(calculateCombinatorics('Redstone')).toBe(2160);

    // "creeper": c,r,p,r + block = 5!/2! = 60; block e,e,e = 3!/3! = 1.
    expect(calculateCombinatorics('Creeper')).toBe(60);
  });

  it('is case-insensitive, since the word is shown uppercase but stored mixed', () => {
    for (const word of RELAY_WORDS) {
      expect(calculateCombinatorics(word.toUpperCase()), word).toBe(calculateCombinatorics(word.toLowerCase()));
    }
  });

  it('gives every word a whole, positive, safe-integer answer', () => {
    for (const word of RELAY_WORDS) {
      const answer = calculateCombinatorics(word);
      expect(Number.isSafeInteger(answer), `${word} -> ${answer}`).toBe(true);
      expect(answer, word).toBeGreaterThan(0);
    }
  });
});

describe('relay code snippets', () => {
  it('generates a program that prints exactly the graded answer', () => {
    for (const word of RELAY_WORDS) {
      const target = calculateCombinatorics(word);
      // The constants are chosen at random per call, so one sample per word
      // proves nothing; take several.
      for (let attempt = 0; attempt < 25; attempt++) {
        const snippets = generateCodeSnippets(word, target);
        expect(evaluateSnippet(snippets.JS), `${word} attempt ${attempt}`).toBe(target);
      }
    }
  });

  it('emits all five languages, and names them as the UI expects', () => {
    const snippets = generateCodeSnippets('Redstone', calculateCombinatorics('Redstone'));
    expect(Object.keys(snippets).sort()).toEqual(['C', 'C++', 'JS', 'Java', 'Python'].sort());
    for (const [language, code] of Object.entries(snippets)) {
      expect(code.length, language).toBeGreaterThan(40);
    }
  });

  it('keeps every constant inside 32-bit int range, so the C and Java versions agree', () => {
    // The C, C++ and Java snippets use `int`. A constant or product past 2^31-1
    // would overflow there and print something the JS and Python versions never
    // would, marking a correct trace wrong depending on which language a team read.
    const limit = 2 ** 31 - 1;
    for (const word of RELAY_WORDS) {
      const target = calculateCombinatorics(word);
      for (let attempt = 0; attempt < 25; attempt++) {
        const js = generateCodeSnippets(word, target).JS;
        const nums = js.match(/chunk_data = \[([^\]]+)\]/)![1].split(',').map((n) => Number(n.trim()));
        const shift = Number(js.match(/redstone_signal = (-?\d+)/)![1]);

        for (const value of nums) expect(Math.abs(value), `${word} constant`).toBeLessThanOrEqual(limit);
        expect(shift, `${word} shift`).toBeGreaterThanOrEqual(0);
        expect(shift, `${word} shift`).toBeLessThan(31);
        expect((nums[2] << shift) * (nums[3] + nums[4]), `${word} product`).toBeLessThanOrEqual(limit);
      }
    }
  });

  it('generates in reasonable time for every word', () => {
    // The generator enumerates divisors up to `target / 2^S`. A word with a
    // large answer makes that loop long, and it runs inside a request.
    for (const word of RELAY_WORDS) {
      const target = calculateCombinatorics(word);
      const started = Date.now();
      generateCodeSnippets(word, target);
      expect(Date.now() - started, `${word} (answer ${target})`).toBeLessThan(1000);
    }
  });
});
