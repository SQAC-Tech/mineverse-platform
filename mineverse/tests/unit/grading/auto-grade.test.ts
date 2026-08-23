import { describe, expect, it } from 'vitest';
import { awardKeyFor, payoutFor, scaleReward } from '@/lib/gameplay/grading/instant';
import { acceptedAnswers, isFixedAnswerKey } from '@/lib/gameplay/grading/llm';

/**
 * The rules that decide what a team is paid.
 *
 * Worth pinning because every one of them is a number agreed with the organisers
 * rather than something a reader can derive, and because the routing decision —
 * which answers reach the language model at all — is the difference between an
 * arithmetic puzzle being marked by its answer key and being marked by a guess.
 */

describe('payout tiers', () => {
  it('pays in full at 75% and above', () => {
    expect(payoutFor(1)).toBe(1);
    expect(payoutFor(0.75)).toBe(1);
  });

  it('pays 70% between half and three quarters', () => {
    expect(payoutFor(0.74)).toBe(0.7);
    expect(payoutFor(0.5)).toBe(0.7);
  });

  it('pays nothing below half', () => {
    expect(payoutFor(0.49)).toBe(0);
    expect(payoutFor(0)).toBe(0);
  });
});

describe('scaled rewards', () => {
  it('hands over the whole reward on a full pass', () => {
    expect(scaleReward({ wood: 8, stone: 5 }, 1)).toEqual({ wood: 8, stone: 5 });
  });

  it('scales every resource on a partial pass', () => {
    expect(scaleReward({ wood: 10, stone: 5 }, 0.7)).toEqual({ wood: 7, stone: 4 });
  });

  /**
   * A single-unit reward must survive the partial rate. Rounding 1 down to 0
   * would tell a team they were partially correct and then hand them nothing,
   * which reads as a broken payout rather than a partial mark.
   */
  it('never scales a reward away to nothing', () => {
    expect(scaleReward({ emerald: 1 }, 0.7)).toEqual({ emerald: 1 });
  });

  it('pays nothing at all below the threshold', () => {
    expect(scaleReward({ wood: 8 }, 0)).toEqual({});
  });
});

describe('which answers reach the model', () => {
  it('treats plain numbers and numbers with units as settled', () => {
    expect(isFixedAnswerKey({ any_of: ['17', '17 minutes'] })).toBe(true);
    expect(isFixedAnswerKey({ any_of: ['48', '48 kg'] })).toBe(true);
    expect(isFixedAnswerKey({ any_of: ['240'] })).toBe(true);
    expect(isFixedAnswerKey('5 4')).toBe(true);
  });

  /**
   * The Round 1 sack riddle. Its key lists five phrasings and a team can write a
   * sixth, so a failed comparison here is ambiguous rather than wrong — this is
   * exactly the answer the second opinion exists for.
   */
  it('treats worded answers as open to a second opinion', () => {
    expect(isFixedAnswerKey({ any_of: ['mix', 'the mix', 'mix sack', 'the sack labelled mix'] })).toBe(false);
    expect(isFixedAnswerKey({ any_of: ['queue'] })).toBe(false);
    expect(isFixedAnswerKey({ any_of: ['index', 'the index'] })).toBe(false);
  });

  /**
   * "7 crossings" is a counted answer, not a worded one, so it stays on the
   * comparison path even though it contains a word. The cost is that a team
   * writing "seven" is marked wrong — the fix for that belongs in the question's
   * answer key, not in sending arithmetic to a model to re-derive.
   */
  it('counts a number with a trailing noun as settled', () => {
    expect(isFixedAnswerKey({ any_of: ['7', '7 crossings'] })).toBe(true);
    expect(isFixedAnswerKey({ any_of: ['120', '120 seconds'] })).toBe(true);
  });

  it('has nothing to say about a question with no key', () => {
    expect(isFixedAnswerKey(null)).toBe(false);
    expect(acceptedAnswers(null)).toEqual([]);
    expect(acceptedAnswers({ any_of: ['a', 'b'] })).toEqual(['a', 'b']);
  });
});

describe('award idempotency keys', () => {
  const submission = '11111111-2222-3333-4444-555555555555';

  /**
   * The ledger column is a `uuid`, so a readable key is not merely untidy — it
   * fails the cast and loses the payout. The finish-round sweep re-examines
   * everything the section hand-in already paid, and only a stable key stops it
   * paying twice.
   */
  it('is a valid uuid', () => {
    expect(awardKeyFor(submission, 1)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('is the same every time for one revision', () => {
    expect(awardKeyFor(submission, 3)).toBe(awardKeyFor(submission, 3));
  });

  it('differs across revisions and across submissions', () => {
    expect(awardKeyFor(submission, 1)).not.toBe(awardKeyFor(submission, 2));
    expect(awardKeyFor(submission, 1)).not.toBe(awardKeyFor('99999999-2222-3333-4444-555555555555', 1));
  });
});
