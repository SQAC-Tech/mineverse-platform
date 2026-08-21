import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pickVariants } from '@/lib/gameplay/questions/variants';

/**
 * The question bank itself, checked as data.
 *
 * `variants.test.ts` proves the picker behaves on synthetic rows. This checks
 * the thing teams will actually sit: that every slot really has alternates, that
 * the alternates are worth the same as each other, and that the field spreads
 * across them instead of everyone landing on variant A.
 *
 * It reads `supabase/seed/round-N.json`, which `scripts/export-questions.mjs
 * --check` keeps identical to the live table. The files are gitignored — they
 * hold every answer key — so this skips rather than fails when they are absent,
 * which is what CI and a fresh clone will see.
 */
const SEED = resolve(__dirname, '../../../supabase/seed');
const ROUNDS = [1, 2, 3, 5];

interface SeedQuestion {
  id: string;
  title: string;
  order_index: number;
  variant_group?: string | null;
  type: string;
  reward?: Record<string, number>;
  guardian_name?: string | null;
  content?: Record<string, unknown>;
  expected_answer?: unknown;
  hidden_test_cases?: unknown[];
}

function loadRound(roundId: number): SeedQuestion[] | null {
  try {
    const doc = JSON.parse(readFileSync(resolve(SEED, `round-${roundId}.json`), 'utf8'));
    // The picker keys ungrouped rows by id; the seed files carry no ids, so
    // stand one in from the order_index, which is unique within a round.
    return doc.questions.map((q: SeedQuestion) => ({ ...q, id: `r${roundId}-${q.order_index}` }));
  } catch {
    return null;
  }
}

const TEAM_CODES = Array.from({ length: 120 }, (_, index) => `MNV-${String(index * 7 % 1000).padStart(3, '0')}`);

describe.each(ROUNDS)('the round %i bank', (roundId) => {
  const questions = loadRound(roundId);
  const answerable = (questions ?? []).filter((q) => q.type !== 'pvp');

  it.skipIf(!questions)('groups every question into a slot', () => {
    for (const question of questions!) {
      expect(question.variant_group, `order_index ${question.order_index} has no variant_group`).toBeTruthy();
    }
  });

  it.skipIf(!questions)('gives every answerable slot more than one version', () => {
    const sizes = new Map<string, number>();
    for (const question of answerable) {
      const key = question.variant_group!;
      sizes.set(key, (sizes.get(key) ?? 0) + 1);
    }
    // PvP is excluded on purpose: those five are revealed per match by the admin
    // start endpoint, so they are already varied by a different mechanism.
    for (const [group, size] of sizes) {
      expect(size, `${group} has only ${size} version(s)`).toBeGreaterThan(1);
    }
  });

  it.skipIf(!questions)('keeps every version of a slot worth the same', () => {
    const byGroup = new Map<string, SeedQuestion[]>();
    for (const question of questions!) {
      const bucket = byGroup.get(question.variant_group!) ?? [];
      bucket.push(question);
      byGroup.set(question.variant_group!, bucket);
    }

    for (const [group, members] of byGroup) {
      const [first] = members;
      for (const member of members) {
        // Unequal pay would make which variant you drew worth resources.
        expect(JSON.stringify(member.reward ?? {}), `${group} reward`).toBe(JSON.stringify(first.reward ?? {}));
        expect(member.type, `${group} type`).toBe(first.type);
        expect(member.guardian_name ?? null, `${group} guardian`).toBe(first.guardian_name ?? null);
      }
    }
  });

  it.skipIf(!questions)('gives every version an answer key or hidden tests', () => {
    for (const question of questions!) {
      const gradable =
        question.expected_answer !== null && question.expected_answer !== undefined
          ? true
          : (question.hidden_test_cases ?? []).length > 0;
      expect(gradable, `${question.variant_group} / ${question.order_index} cannot be graded`).toBe(true);
    }
  });

  it.skipIf(!questions)('hands every team a full paper of one version per slot', () => {
    const slots = new Set(answerable.map((q) => q.variant_group));
    for (const code of TEAM_CODES) {
      const paper = pickVariants(answerable, code, roundId);
      expect(paper).toHaveLength(slots.size);
      expect(new Set(paper.map((q) => q.variant_group)).size).toBe(slots.size);
    }
  });

  it.skipIf(!questions)('spreads the field across the versions rather than favouring one', () => {
    const byGroup = new Map<string, Map<string, number>>();
    for (const code of TEAM_CODES) {
      for (const picked of pickVariants(answerable, code, roundId)) {
        const tally = byGroup.get(picked.variant_group!) ?? new Map<string, number>();
        // `pickVariants` rewrites order_index to the slot so the paper reads
        // 1..N, which means order_index cannot tell the versions apart here.
        // The title can — the exporter lifts it out of `content` to the top level.
        const key = picked.title;
        tally.set(key, (tally.get(key) ?? 0) + 1);
        byGroup.set(picked.variant_group!, tally);
      }
    }

    for (const [group, tally] of byGroup) {
      const biggest = Math.max(...tally.values());
      // With three versions and 120 teams an even split is 40 each. Anything
      // above 75% of the field on one version means the hash is not spreading.
      expect(biggest, `${group} sent ${biggest}/${TEAM_CODES.length} teams to one version`)
        .toBeLessThan(TEAM_CODES.length * 0.75);
    }
  });
});
