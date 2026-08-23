import { createHash } from 'node:crypto';

/**
 * A stable UUID derived from a readable name.
 *
 * Exists because several tables key idempotency on a `uuid` column while the
 * thing that actually identifies the action is a sentence — "this submission at
 * this revision", "this bulk grant for this team". Passing the sentence fails
 * the cast and loses the write; passing `crypto.randomUUID()` makes every retry
 * a fresh action, which is how a team gets paid twice.
 *
 * Hashing keeps the property that matters: the same name always yields the same
 * UUID, so a retry collides with the original and is refused by the unique
 * index rather than duplicated.
 *
 * Version 5 layout, RFC 4122 variant. Not a security primitive — the names are
 * not secret and do not need to be.
 */
export function deterministicUuid(name: string): string {
  const digest = createHash('sha1').update(name).digest();
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
