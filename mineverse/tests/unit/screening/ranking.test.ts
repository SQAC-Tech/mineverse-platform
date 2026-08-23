import { describe, expect, it } from 'vitest';
import { sortByRank } from '@/lib/screening/shortlist';

function team(
  code: string,
  score: number,
  relaySeconds: number | null = null,
  submittedAt: string | null = null,
) {
  return { team_code: code, total_score: score, relay_seconds: relaySeconds, submitted_at: submittedAt };
}

describe('the ranking chain', () => {
  it('puts the higher score first', () => {
    const order = sortByRank([team('MNV-002', 31), team('MNV-001', 44)]);
    expect(order.map((t) => t.team_code)).toEqual(['MNV-001', 'MNV-002']);
  });

  /**
   * The rule as stated: on the same score, the faster relay goes through.
   */
  it('breaks a tie on relay time, fastest first', () => {
    const order = sortByRank([
      team('MNV-SLOW', 100, 1200),
      team('MNV-FAST', 100, 251),
    ]);
    expect(order[0].team_code).toBe('MNV-FAST');
  });

  /**
   * The regression this chain exists to fix.
   *
   * The window ran four and a half hours. Ranking on submit time meant the hour
   * a team happened to log in outranked what they did once they were in: the
   * team below took a fifth of the time and lost to a clock.
   */
  it('does not let an early login beat a faster relay', () => {
    const order = sortByRank([
      team('MNV-EARLY', 100, 1200, '2026-08-22T12:53:00Z'), // 18:23 IST, 20 min
      team('MNV-LATE', 100, 251, '2026-08-22T16:12:00Z'),   // 21:42 IST, 4 min
    ]);
    expect(order.map((t) => t.team_code)).toEqual(['MNV-LATE', 'MNV-EARLY']);
  });

  it('never lets the relay time beat the score', () => {
    // Solving two puzzles quickly is not better than solving three slowly.
    const order = sortByRank([
      team('MNV-QUICK', 50, 120),
      team('MNV-WHOLE', 100, 1400),
    ]);
    expect(order[0].team_code).toBe('MNV-WHOLE');
  });

  it('sorts an untimed relay last, not first', () => {
    // `null` read as 0 would hand a team with no telemetry the fastest run in
    // the field, which is exactly backwards.
    const order = sortByRank([
      team('MNV-GHOST', 100, null),
      team('MNV-REAL', 100, 900),
    ]);
    expect(order.map((t) => t.team_code)).toEqual(['MNV-REAL', 'MNV-GHOST']);
  });

  it('falls back to submit time when neither team was timed', () => {
    const order = sortByRank([
      team('MNV-NIGHT', 100, null, '2026-08-22T16:30:00Z'),
      team('MNV-MORN', 100, null, '2026-08-22T01:30:00Z'),
    ]);
    expect(order[0].team_code).toBe('MNV-MORN');
  });

  it('is stable across runs when every key ties', () => {
    // Without a final key the order would depend on the order rows came back
    // from Postgres, and two runs of the shortlist could disagree — after the
    // mails have gone out.
    const tied = [
      team('MNV-300', 100, 400, '2026-08-22T05:00:00Z'),
      team('MNV-100', 100, 400, '2026-08-22T05:00:00Z'),
      team('MNV-200', 100, 400, '2026-08-22T05:00:00Z'),
    ];
    const first = sortByRank(tied).map((t) => t.team_code);
    const second = sortByRank([...tied].reverse()).map((t) => t.team_code);

    expect(first).toEqual(['MNV-100', 'MNV-200', 'MNV-300']);
    expect(second).toEqual(first);
  });

  it('does not mutate the array it was given', () => {
    const input = [team('MNV-002', 10), team('MNV-001', 20)];
    const before = input.map((t) => t.team_code);
    sortByRank(input);
    expect(input.map((t) => t.team_code)).toEqual(before);
  });

  it('ranks a realistic field the way the cut line expects', () => {
    // What the live table actually looks like: almost everyone full-cleared, so
    // the relay times are the ranking.
    const order = sortByRank([
      team('MNV-A', 100, 640, '2026-08-22T13:00:00Z'),
      team('MNV-B', 100, 341, '2026-08-22T17:28:00Z'),
      team('MNV-C', 100, 251, '2026-08-22T15:31:00Z'),
      team('MNV-D', 50, 200, '2026-08-22T12:40:00Z'),
    ]);
    expect(order.map((t) => t.team_code)).toEqual(['MNV-C', 'MNV-B', 'MNV-A', 'MNV-D']);
  });
});
