import { describe, expect, it } from 'vitest';
import { sortByRank } from '@/lib/screening/shortlist';

function team(code: string, score: number, submittedAt: string | null = null) {
  return { team_code: code, total_score: score, submitted_at: submittedAt };
}

describe('the ranking chain', () => {
  it('puts the higher score first', () => {
    const order = sortByRank([team('MNV-002', 31), team('MNV-001', 44)]);
    expect(order.map((t) => t.team_code)).toEqual(['MNV-001', 'MNV-002']);
  });

  /**
   * The rule as stated: the team that submitted at 07:00 beats the team that
   * submitted at 22:00 on the same score.
   */
  it('breaks a tie by who submitted earlier in the day', () => {
    const order = sortByRank([
      team('MNV-NIGHT', 40, '2026-08-22T16:30:00Z'), // 22:00 IST
      team('MNV-MORN', 40, '2026-08-22T01:30:00Z'),  // 07:00 IST
    ]);
    expect(order[0].team_code).toBe('MNV-MORN');
  });

  it('is stable across runs when score and submit time both tie', () => {
    // Without a third key the order would depend on the order rows came back
    // from Postgres, and two runs of the shortlist could disagree — after the
    // mails have gone out.
    const tied = [
      team('MNV-300', 40, '2026-08-22T05:00:00Z'),
      team('MNV-100', 40, '2026-08-22T05:00:00Z'),
      team('MNV-200', 40, '2026-08-22T05:00:00Z'),
    ];
    const first = sortByRank(tied).map((t) => t.team_code);
    const second = sortByRank([...tied].reverse()).map((t) => t.team_code);

    expect(first).toEqual(['MNV-100', 'MNV-200', 'MNV-300']);
    expect(second).toEqual(first);
  });

  it('sorts a team that never submitted last, not first', () => {
    // `null` read as 0 by a naive comparison would make an unfinished attempt
    // the earliest submission of the day.
    const order = sortByRank([
      team('MNV-GHOST', 40, null),
      team('MNV-REAL', 40, '2026-08-22T17:00:00Z'),
    ]);
    expect(order.map((t) => t.team_code)).toEqual(['MNV-REAL', 'MNV-GHOST']);
  });

  it('never lets the tiebreak beat the score', () => {
    // Submitting first must not rescue a worse paper.
    const order = sortByRank([
      team('MNV-FAST', 20, '2026-08-22T00:05:00Z'),
      team('MNV-GOOD', 21, '2026-08-22T17:55:00Z'),
    ]);
    expect(order[0].team_code).toBe('MNV-GOOD');
  });

  it('does not mutate the array it was given', () => {
    const input = [team('MNV-002', 10), team('MNV-001', 20)];
    const before = input.map((t) => t.team_code);
    sortByRank(input);
    expect(input.map((t) => t.team_code)).toEqual(before);
  });

  it('ranks a realistic field the way the cut line expects', () => {
    const order = sortByRank([
      team('MNV-A', 51, '2026-08-22T10:00:00Z'),
      team('MNV-B', 51, '2026-08-22T02:00:00Z'),
      team('MNV-C', 60, '2026-08-22T17:00:00Z'),
      team('MNV-D', 30, '2026-08-22T01:00:00Z'),
    ]);
    // Top score wins outright even though it was the latest submission; the two
    // on 51 split on time; the low score is last however early it came in.
    expect(order.map((t) => t.team_code)).toEqual(['MNV-C', 'MNV-B', 'MNV-A', 'MNV-D']);
  });
});
