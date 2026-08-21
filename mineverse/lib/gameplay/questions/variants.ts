/**
 * Which version of each question a team sees.
 *
 * Teams sit next to each other in a lab. If everyone gets the same paper, the
 * answer to Q3 travels down the row faster than anyone can solve it. So each
 * question slot can hold several interchangeable versions — same type, same
 * reward, same difficulty — and a team is served exactly one of them.
 *
 * The choice is *derived*, never stored: it comes from hashing the team's own
 * code together with the round and the slot. That gives the two properties the
 * event needs at once —
 *
 *   - a refresh, a re-login, or a second device shows the same paper, because
 *     nothing about the choice depends on when it was asked; and
 *   - two teams almost certainly differ, because their codes differ.
 *
 * A stored assignment would need a write on first view, a migration, and a
 * story for what happens when that write fails mid-event. This needs none of
 * them.
 */

/** A row this module can group and pick between. */
export interface VariantRow {
  id: string;
  order_index: number;
  /** Rows sharing this within a round are interchangeable. NULL = no variants. */
  variant_group?: string | null;
}

/**
 * FNV-1a, 32-bit.
 *
 * Chosen because it is four lines, has no dependencies, and gives the same
 * number in every JavaScript runtime and on every machine — the seeding script,
 * the server, and the test suite must all agree or a team's paper changes
 * between the preview and the event. `Math.random` and anything seeded from the
 * clock are disqualified for the same reason.
 *
 * This is not a security hash and does not need to be: knowing which variant
 * you were given tells you nothing about its answer.
 */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    // The FNV prime, 16777619, via shifts — a plain `hash * 16777619` loses
    // low bits to float rounding once the product passes 2^53.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
}

/**
 * The bucket a row belongs to.
 *
 * A row with no `variant_group` is its own bucket of one, keyed by id, so a
 * question that has no alternates is served to everybody without needing a
 * group name of its own.
 */
export function groupKeyOf(row: VariantRow): string {
  const group = row.variant_group?.trim();
  return group ? `g:${group}` : `q:${row.id}`;
}

/**
 * A final avalanche pass over a 32-bit hash (MurmurHash3's fmix32).
 *
 * FNV-1a's low bits barely change between similar inputs, and `% 3` reads
 * exactly those bits. Every team code here is `MNV-` plus three digits, so the
 * inputs are about as similar as inputs get, and the result was that a team's
 * pick in slot 1 strongly predicted its pick in slots 2..13. Measured over 1000
 * codes against the real 13-slot round 2 bank: **180 distinct papers** out of a
 * possible 3^13. With this pass, 1000.
 *
 * What makes it easy to miss: each slot on its own looked perfectly random —
 * about 333/333/333 across the three variants either way. Only the whole paper
 * shows the correlation, which is why `real-teams.test.ts` compares papers
 * rather than slots.
 */
export function mix32(hash: number): number {
  let value = hash >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b) >>> 0;
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35) >>> 0;
  value ^= value >>> 16;
  return value >>> 0;
}

/**
 * The index of the variant this team gets, within a group of `size`.
 *
 * The group key is part of the hash rather than the sequence position, so
 * adding a fourth variant to slot 3 does not shift what any team sees in
 * slot 4. Each slot is decided on its own.
 */
export function variantIndexFor(teamCode: string, roundId: number, groupKey: string, size: number): number {
  if (size <= 1) return 0;
  const normalized = teamCode.trim().toUpperCase();
  return mix32(hashString(`${normalized}|${roundId}|${groupKey}`)) % size;
}

/**
 * One row per slot, in slot order.
 *
 * `teamCode` may be null — an admin preview, or a team row whose code failed to
 * load. That case serves the lowest `order_index` of each group, which is the
 * original question, so a missing code degrades to the pre-variant behaviour
 * instead of throwing.
 */
export function pickVariants<T extends VariantRow>(rows: T[], teamCode: string | null | undefined, roundId: number): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = groupKeyOf(row);
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  const picked: T[] = [];
  for (const [key, members] of groups) {
    // Sorted here, not trusted from the caller: the database returns rows in
    // whatever order it likes, and the pick must not depend on that.
    const ordered = [...members].sort((a, b) => a.order_index - b.order_index || a.id.localeCompare(b.id));
    const index = teamCode ? variantIndexFor(teamCode, roundId, key, ordered.length) : 0;
    // The slot sits where its *first* variant sits, so alternates numbered far
    // away (1003, 2003) still appear in the position of the question they
    // replace rather than at the end of the paper.
    picked.push({ ...ordered[index], order_index: ordered[0].order_index });
  }

  return picked.sort((a, b) => a.order_index - b.order_index || a.id.localeCompare(b.id));
}

/**
 * The ids this team is allowed to touch in a round.
 *
 * Needed because hiding the other variants is not the same as refusing them.
 * Two teams that compare notes hold each other's question ids, and without this
 * each could answer both versions of every slot and be paid twice for one
 * question. Every write path checks against this set.
 */
export function allowedQuestionIds<T extends VariantRow>(
  rows: T[],
  teamCode: string | null | undefined,
  roundId: number,
): Set<string> {
  return new Set(pickVariants(rows, teamCode, roundId).map((row) => row.id));
}
