import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { gradeCode, isLlmConfigured, rescueFreeText } from '@/lib/gameplay/grading/llm';

/**
 * Calls the real grader, with the real key, on real questions from the bank.
 *
 * A mocked language model proves nothing here. Everything that can actually go
 * wrong lives outside this repository: whether the key is accepted, whether the
 * model honours JSON mode, whether its reply matches the schema, and — the part
 * no unit test can assert from the prompt text alone — whether the instructions
 * make it generous enough to rescue a real near-miss and strict enough to
 * refuse a wrong answer.
 *
 * Skips itself when no key is configured, so an offline run stays green.
 */

beforeAll(() => {
  // Vitest does not read `.env.local`, and the point of this file is to use the
  // same key the running platform uses rather than a second one set by hand.
  if (process.env.GROQ_API_KEY) return;
  try {
    for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
      const match = /^(GROQ_API_KEY|GROQ_MODEL)=(.*)$/.exec(line.trim());
      if (match && match[2]) process.env[match[1]] = match[2];
    }
  } catch {
    // No env file — the suite below skips.
  }
});

const RIDDLE = [
  'Three sacks stand in the store room. One holds only IRON, one holds only GOLD,',
  'and one holds a MIX. Every label is wrong. You may draw one item from one sack.',
  'Which sack should you draw from?',
].join(' ');

// The live key for that question, verbatim from the bank.
const RIDDLE_ACCEPTED = ['mix', 'the mix', 'mix sack', 'the sack labelled mix', 'the one labelled mix'];

describe.skipIf(!process.env.VITEST_LIVE_GRADER)('the grader, live', () => {
  it('is configured', () => {
    expect(isLlmConfigured()).toBe(true);
  });

  /**
   * The phrasing the answer key cannot enumerate. This is the entire reason the
   * rescue path exists — if it fails, worded answers are being marked wrong.
   */
  it('rescues a correct answer the key does not list', async () => {
    const verdict = await rescueFreeText({
      prompt: RIDDLE,
      accepted: RIDDLE_ACCEPTED,
      answer: 'I would draw from the sack that has the MIX label on it',
    });
    expect(verdict).not.toBeNull();
    expect(verdict!.score).toBeGreaterThanOrEqual(0.75);
  }, 30_000);

  /** The other half: it must not simply agree with everybody. */
  it('refuses an answer that contradicts the key', async () => {
    const verdict = await rescueFreeText({
      prompt: RIDDLE,
      accepted: RIDDLE_ACCEPTED,
      answer: 'the gold sack',
    });
    expect(verdict).not.toBeNull();
    expect(verdict!.score).toBeLessThan(0.5);
  }, 30_000);

  it('scores an empty answer at zero without asking anyone', async () => {
    const verdict = await rescueFreeText({ prompt: RIDDLE, accepted: RIDDLE_ACCEPTED, answer: '   ' });
    expect(verdict!.score).toBe(0);
  });

  /**
   * Partial credit on code. The test results are handed to the model as
   * evidence; code that passes nothing must not be talked up into a payout.
   */
  it('pays a near-miss and refuses a non-solution', async () => {
    const prompt = 'Return the second highest distinct value in the list.';

    const nearMiss = await gradeCode({
      prompt,
      language: 'python',
      // Correct approach, wrong on the single-distinct-value edge case.
      code: 'class Solution:\n    def second_highest(self, weights):\n        return sorted(set(weights), reverse=True)[1]',
      passed: 7,
      total: 8,
    });
    expect(nearMiss).not.toBeNull();
    expect(nearMiss!.score).toBeGreaterThanOrEqual(0.5);

    const wrong = await gradeCode({
      prompt,
      language: 'python',
      code: 'class Solution:\n    def second_highest(self, weights):\n        return 0',
      passed: 0,
      total: 8,
    });
    expect(wrong).not.toBeNull();
    expect(wrong!.score).toBeLessThan(0.5);
  }, 60_000);
});
