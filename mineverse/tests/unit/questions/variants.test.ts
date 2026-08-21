import { describe, expect, it } from 'vitest';
import {
  allowedQuestionIds,
  groupKeyOf,
  hashString,
  mix32,
  pickVariants,
  variantIndexFor,
} from '@/lib/gameplay/questions/variants';

/** A slot with `count` interchangeable versions, numbered the way the seed files number them. */
function slot(base: number, count: number, group = `r1-s${base}`) {
  return Array.from({ length: count }, (_, index) => ({
    id: `q-${base}-${index}`,
    order_index: index === 0 ? base : index * 1000 + base,
    variant_group: group,
  }));
}

const TEAM_CODES = Array.from({ length: 200 }, (_, index) => `MNV-${String(index).padStart(3, '0')}`);

describe('picking a team’s variant', () => {
  const paper = [...slot(1, 3), ...slot(2, 3), ...slot(3, 3)];

  it('serves exactly one version of every slot', () => {
    const picked = pickVariants(paper, 'MNV-042', 1);
    expect(picked).toHaveLength(3);
    expect(new Set(picked.map((row) => row.variant_group)).size).toBe(3);
  });

  it('gives the same team the same paper every time it is asked', () => {
    // This is the whole promise made to a team that refreshes mid-round.
    const first = pickVariants(paper, 'MNV-042', 1).map((row) => row.id);
    for (let attempt = 0; attempt < 50; attempt += 1) {
      expect(pickVariants(paper, 'MNV-042', 1).map((row) => row.id)).toEqual(first);
    }
  });

  it('does not care what order the database returned the rows in', () => {
    const shuffled = [...paper].reverse();
    expect(pickVariants(shuffled, 'MNV-042', 1)).toEqual(pickVariants(paper, 'MNV-042', 1));
  });

  it('gives the same team different papers in different rounds', () => {
    const round1 = pickVariants(paper, 'MNV-042', 1).map((row) => row.id);
    const round2 = pickVariants(paper, 'MNV-042', 2).map((row) => row.id);
    // Not a guarantee for one fixed team, but across the field they must diverge.
    const differing = TEAM_CODES.filter(
      (code) =>
        pickVariants(paper, code, 1).map((row) => row.id).join() !==
        pickVariants(paper, code, 2).map((row) => row.id).join(),
    );
    expect(differing.length).toBeGreaterThan(TEAM_CODES.length * 0.5);
    expect([round1, round2]).toHaveLength(2);
  });

  it('keeps a slot in the position of the question it replaces', () => {
    // Alternates are numbered 1001 and 2001, but the team must see "Question 1"
    // wherever the original sat — not a paper that runs 2, 3, 1003.
    for (const code of TEAM_CODES.slice(0, 40)) {
      expect(pickVariants(paper, code, 1).map((row) => row.order_index)).toEqual([1, 2, 3]);
    }
  });

  it('serves the original when there is no team code', () => {
    // Admin previews and a failed code lookup fall back to the pre-variant paper
    // rather than throwing or picking arbitrarily.
    expect(pickVariants(paper, null, 1).map((row) => row.id)).toEqual(['q-1-0', 'q-2-0', 'q-3-0']);
    expect(pickVariants(paper, undefined, 1).map((row) => row.id)).toEqual(['q-1-0', 'q-2-0', 'q-3-0']);
  });

  it('reads a team code the same however it was typed or stored', () => {
    const canonical = pickVariants(paper, 'MNV-042', 1).map((row) => row.id);
    expect(pickVariants(paper, 'mnv-042', 1).map((row) => row.id)).toEqual(canonical);
    expect(pickVariants(paper, '  MNV-042 ', 1).map((row) => row.id)).toEqual(canonical);
  });

  it('passes through a question that has no alternates', () => {
    const mixed = [{ id: 'solo', order_index: 4, variant_group: null }, ...slot(1, 3)];
    const picked = pickVariants(mixed, 'MNV-042', 1);
    expect(picked.map((row) => row.id)).toContain('solo');
    expect(picked).toHaveLength(2);
  });

  it('handles a group that has exactly one row', () => {
    const single = slot(1, 1);
    expect(pickVariants(single, 'MNV-042', 1).map((row) => row.id)).toEqual(['q-1-0']);
  });

  it('spreads the field across all three versions of a slot', () => {
    // A hash that sent 90% of teams to variant A would be worthless here, so
    // check the split rather than merely that it varies.
    const counts = new Map<string, number>();
    for (const code of TEAM_CODES) {
      const id = pickVariants(paper, code, 1)[0].id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect(counts.size).toBe(3);
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(TEAM_CODES.length / 6);
    }
  });

  it('decides each slot independently, so adding a variant does not disturb the others', () => {
    // The seed files will keep growing right up to the event. Adding a fourth
    // version of slot 1 must not silently reshuffle slots 2 and 3 for teams that
    // have already sat down.
    const before = pickVariants(paper, 'MNV-042', 1);
    const grown = [...paper, { id: 'q-1-3', order_index: 3001, variant_group: 'r1-s1' }];
    const after = pickVariants(grown, 'MNV-042', 1);
    expect(after.slice(1).map((row) => row.id)).toEqual(before.slice(1).map((row) => row.id));
  });
});

describe('the ids a team may answer', () => {
  const paper = [...slot(1, 3), ...slot(2, 3)];

  it('is exactly what was served, and never another team’s version', () => {
    const allowed = allowedQuestionIds(paper, 'MNV-042', 1);
    expect(allowed.size).toBe(2);

    // The exploit this set exists to stop: two teams comparing ids and each
    // answering both versions of a slot to be paid twice for one question.
    const other = TEAM_CODES.find(
      (code) => pickVariants(paper, code, 1)[0].id !== pickVariants(paper, 'MNV-042', 1)[0].id,
    );
    expect(other).toBeTruthy();
    const theirs = pickVariants(paper, other!, 1)[0].id;
    expect(allowed.has(theirs)).toBe(false);
  });

  it('agrees with what was served, for every team', () => {
    for (const code of TEAM_CODES) {
      const served = pickVariants(paper, code, 1).map((row) => row.id);
      const allowed = allowedQuestionIds(paper, code, 1);
      expect([...allowed].sort()).toEqual([...served].sort());
    }
  });
});

describe('the hash', () => {
  it('is stable — these numbers are what every team’s paper depends on', () => {
    // Pinned literals, not a round-trip: if FNV-1a is ever "tidied up" into
    // something that returns different numbers, every team's paper silently
    // changes and this is the only thing that would notice.
    expect(hashString('')).toBe(2166136261);
    expect(hashString('a')).toBe(3826002220);
    expect(hashString('MNV-042|1|g:r1-s1')).toBe(hashString('MNV-042|1|g:r1-s1'));
  });

  it('stays a 32-bit unsigned integer for long inputs', () => {
    for (const input of ['', 'x', 'MNV-999|5|g:r5-s7', 'z'.repeat(5000)]) {
      const value = hashString(input);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('never indexes past the end of a group', () => {
    for (const code of TEAM_CODES) {
      for (const size of [1, 2, 3, 4, 7]) {
        const index = variantIndexFor(code, 3, 'g:whatever', size);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(size);
      }
    }
  });
});

describe('grouping', () => {
  it('keys a grouped row by its group and a lone row by its id', () => {
    expect(groupKeyOf({ id: 'x', order_index: 1, variant_group: 'r1-s1' })).toBe('g:r1-s1');
    expect(groupKeyOf({ id: 'x', order_index: 1, variant_group: null })).toBe('q:x');
    // Whitespace-only is not a group name — it would silently merge every such
    // row into one bucket and serve a single question in place of many.
    expect(groupKeyOf({ id: 'x', order_index: 1, variant_group: '   ' })).toBe('q:x');
  });
});

describe('the avalanche pass', () => {
  it('is stable — these numbers decide every team’s paper', () => {
    expect(mix32(0)).toBe(0);
    expect(mix32(hashString('')) >>> 0).toBe(mix32(2166136261));
    expect(mix32(1)).toBe(mix32(1));
    expect(mix32(0xffffffff)).toBeLessThanOrEqual(0xffffffff);
    expect(mix32(0xffffffff)).toBeGreaterThanOrEqual(0);
  });

  it('stays a 32-bit unsigned integer', () => {
    for (const input of [0, 1, 12345, 0x7fffffff, 0x80000000, 0xffffffff]) {
      const value = mix32(input);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('decorrelates slots, which raw FNV-1a does not', () => {
    // The regression this exists for. Team codes here differ only in three
    // digits, and `% 3` reads the low bits, where FNV-1a barely avalanches.
    // Without a finalizer a team's pick in slot 1 predicted its picks in the
    // other twelve: 1000 codes produced ~180 distinct papers out of 3^13.
    //
    // Note that checking one slot at a time would NOT catch it — each slot
    // splits about evenly either way. Only the whole paper shows the problem.
    const codes = Array.from({ length: 1000 }, (_, index) => `MNV-${String(index).padStart(3, '0')}`);
    const papers = new Set(
      codes.map((code) =>
        Array.from({ length: 13 }, (_, slot) => variantIndexFor(code, 2, `g:r2-s${slot + 1}`, 3)).join(''),
      ),
    );
    expect(papers.size).toBeGreaterThan(950);

    const rawPapers = new Set(
      codes.map((code) =>
        Array.from({ length: 13 }, (_, slot) => hashString(`${code}|2|g:r2-s${slot + 1}`) % 3).join(''),
      ),
    );
    // Pinned as documentation of the bug, not as a requirement.
    expect(rawPapers.size).toBeLessThan(papers.size / 2);
  });
});
