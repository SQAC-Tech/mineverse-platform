import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pickVariants } from '@/lib/gameplay/questions/variants';

/**
 * The 84 team codes that are actually registered, against the actual bank.
 *
 * Synthetic codes are evenly spread by construction; the real ones are not —
 * they are whatever the registration generator produced, all three digits, all
 * sharing the `MNV-` prefix. That is the input the hash has to spread on the
 * day, so it is the input worth checking.
 *
 * Refresh this list from `select team_code from teams` if the field changes.
 * A team code that is not in it is not a problem — this is a sample, not a gate.
 */
const REAL_TEAM_CODES = `
MNV-000 MNV-051 MNV-064 MNV-088 MNV-089 MNV-095 MNV-099 MNV-100 MNV-102 MNV-118
MNV-126 MNV-134 MNV-147 MNV-169 MNV-187 MNV-189 MNV-199 MNV-232 MNV-237 MNV-244
MNV-265 MNV-267 MNV-269 MNV-284 MNV-288 MNV-297 MNV-302 MNV-306 MNV-316 MNV-324
MNV-336 MNV-348 MNV-356 MNV-358 MNV-380 MNV-388 MNV-430 MNV-431 MNV-441 MNV-453
MNV-502 MNV-539 MNV-546 MNV-547 MNV-551 MNV-555 MNV-578 MNV-590 MNV-596 MNV-600
MNV-608 MNV-623 MNV-627 MNV-643 MNV-678 MNV-693 MNV-694 MNV-704 MNV-719 MNV-732
MNV-746 MNV-755 MNV-765 MNV-768 MNV-774 MNV-777 MNV-785 MNV-791 MNV-794 MNV-795
MNV-810 MNV-820 MNV-847 MNV-850 MNV-878 MNV-893 MNV-907 MNV-918 MNV-919 MNV-934
MNV-963 MNV-983 MNV-990 MNV-DEV
`.trim().split(/\s+/);

const SEED = resolve(__dirname, '../../../supabase/seed');

interface Row {
  id: string;
  title: string;
  order_index: number;
  variant_group?: string | null;
  type: string;
}

function loadRound(roundId: number): Row[] | null {
  try {
    const doc = JSON.parse(readFileSync(resolve(SEED, `round-${roundId}.json`), 'utf8'));
    return doc.questions
      .map((q: Row) => ({ ...q, id: `r${roundId}-${q.order_index}` }))
      .filter((q: Row) => q.type !== 'pvp');
  } catch {
    return null;
  }
}

describe('the registered field, on the real bank', () => {
  const rounds = [1, 2, 3, 5].map((id) => [id, loadRound(id)] as const);
  const available = rounds.every(([, rows]) => rows !== null);

  it('has 84 distinct team codes to test with', () => {
    expect(new Set(REAL_TEAM_CODES).size).toBe(REAL_TEAM_CODES.length);
  });

  it.skipIf(!available)('never hands two neighbouring codes an identical paper', () => {
    // The failure this guards against is the one that matters in a lab: the
    // team beside you gets your paper. Codes are compared in sorted order,
    // which is roughly how they were handed out.
    for (const [roundId, rows] of rounds) {
      const papers = REAL_TEAM_CODES.map((code) => ({
        code,
        titles: pickVariants(rows!, code, roundId).map((row) => row.title).join('|'),
      }));

      let identicalNeighbours = 0;
      for (let index = 1; index < papers.length; index += 1) {
        if (papers[index].titles === papers[index - 1].titles) identicalNeighbours += 1;
      }
      expect(identicalNeighbours, `round ${roundId} neighbours sharing a paper`).toBe(0);
    }
  });

  it.skipIf(!available)('gives the field many distinct papers, not a handful', () => {
    for (const [roundId, rows] of rounds) {
      const distinct = new Set(
        REAL_TEAM_CODES.map((code) => pickVariants(rows!, code, roundId).map((row) => row.title).join('|')),
      );
      // 13 slots of 3 is 1.5 million possible papers; 84 teams drawing from that
      // should essentially never collide. Round 5 has 7 slots, so 2187 — still
      // far more than the field.
      expect(distinct.size, `round ${roundId} produced only ${distinct.size} distinct papers`)
        .toBeGreaterThan(REAL_TEAM_CODES.length * 0.9);
    }
  });

  it.skipIf(!available)('uses every version that was written', () => {
    // An authored variant no team can ever draw is wasted work, and would mean
    // the hash has a blind spot.
    for (const [roundId, rows] of rounds) {
      const seen = new Set<string>();
      for (const code of REAL_TEAM_CODES) {
        for (const row of pickVariants(rows!, code, roundId)) seen.add(row.title);
      }
      const authored = new Set(rows!.map((row) => row.title));
      const unused = [...authored].filter((title) => !seen.has(title));
      expect(unused, `round ${roundId} never serves: ${unused.join(', ')}`).toEqual([]);
    }
  });
});
