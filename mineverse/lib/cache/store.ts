/**
 * A two-tier read cache for the handful of things the whole hall asks for.
 *
 * ## Why
 *
 * On event day the edge logs showed 352,000 requests in one hour against a
 * 23 MB database, with average origin times over two seconds and better than
 * 40% of them failing. A good share of that is the same answer fetched over and
 * over: `/rest/v1/rounds` was hit 30,320 times in two hours for a six-row table
 * that changes about ten times a day, and the shortlist *count* — one integer,
 * identical for every team — was fetched 34,207 times.
 *
 * ## The two tiers
 *
 * **L1** is an in-process `Map`, the same idiom `lib/platform/settings.ts`
 * already uses. It costs nothing, needs no configuration, and is the only tier
 * that exists when Redis is not set up.
 *
 * **L2** is Upstash over its REST API. REST rather than a TCP client on purpose:
 * this runs on Vercel's serverless functions, where a pooled socket per lambda
 * is a liability rather than an optimisation, and the REST form needs no npm
 * dependency at all — it is `fetch` and a bearer token.
 *
 * L2 is **opt-in per key and off by default**, because Upstash's free plan is
 * metered in commands per month and a hot key on a short TTL spends it fast —
 * see `CacheOptions.shared` for the arithmetic. Two keys use it today: the
 * attendance checkpoints and the shortlist count, both tiny values on
 * two-minute TTLs. The rounds table and the question banks are L1-only; they
 * are the hottest and the largest respectively, and a cold lambda paying one
 * indexed query is cheaper than a quota that runs out mid-round.
 *
 * ## Failing open, everywhere
 *
 * Every path here degrades to "just call the loader". No env vars, Redis down,
 * Redis slow, malformed JSON — all of them fall through to Postgres rather than
 * raising. That is the whole point of adding this the night before a live
 * event: it can help, and it must not become a new way for the evening to
 * break. The one-second timeout enforces the second half — a Redis that has
 * gone slow is worse than no Redis, so it is given one second to be useful.
 *
 * ## What must never go in here
 *
 * Anything carrying an answer key. `questions.expected_answer` and the sealed
 * `pvp_match_questions` rows stay on the database side of the wire; Upstash is
 * a third party and an answer key sitting in it is an answer key we no longer
 * control. Cache the sanitised shape or do not cache it.
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL ?? '';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? '';

/** Whether the shared tier is configured at all. */
export const redisEnabled = Boolean(REDIS_URL && REDIS_TOKEN);

/** A Redis that has gone slow is worse than no Redis. */
const REDIS_TIMEOUT_MS = 1_000;

interface Entry {
  value: unknown;
  expiresAt: number;
}

const l1 = new Map<string, Entry>();

/**
 * Logged once per key, not once per miss.
 *
 * A Redis outage during a round would otherwise write a line per request, which
 * is how a cache layer turns into the thing filling the logs it was added to
 * quieten.
 */
const warned = new Set<string>();

function warnOnce(scope: string, error: unknown) {
  if (warned.has(scope)) return;
  warned.add(scope);
  console.warn(`[cache] ${scope} unavailable, falling through to the database:`, error);
}

async function redisCommand(command: unknown[]): Promise<unknown> {
  const response = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
    cache: 'no-store',
  });

  if (!response.ok) throw new Error(`upstash ${response.status}`);
  const payload = (await response.json()) as { result?: unknown };
  return payload.result ?? null;
}

async function redisGet(key: string): Promise<unknown | undefined> {
  if (!redisEnabled) return undefined;
  try {
    const raw = await redisCommand(['GET', key]);
    if (typeof raw !== 'string') return undefined;
    return JSON.parse(raw);
  } catch (error) {
    warnOnce('redis GET', error);
    return undefined;
  }
}

async function redisSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!redisEnabled) return;
  try {
    await redisCommand(['SET', key, JSON.stringify(value), 'EX', String(ttlSeconds)]);
  } catch (error) {
    warnOnce('redis SET', error);
  }
}

export interface CacheOptions {
  /**
   * Also keep this key in Redis, shared across lambda instances.
   *
   * **Off by default, and that default is the important part.** Upstash's free
   * plan is metered in commands per month, and a key is read once per L1 expiry
   * *per lambda instance* — so a short TTL on a hot key is what actually spends
   * the budget, not the size of the value.
   *
   * Worked example, at roughly fifteen instances during a round:
   *
   *   rounds, 10s TTL   ->  ~10,800 Redis reads an hour  ->  ~119,000 a day
   *   questions, 60s    ->   ~1,800 an hour              ->   ~20,000 a day
   *   checkpoints, 120s ->     ~900 an hour              ->   ~10,000 a day
   *
   * One event day of the first line is a quarter of a month's free quota, and
   * running out mid-round means Redis starts erroring — which sends everything
   * back to the database that the cache existed to protect.
   *
   * So the rule is: share a key only when its TTL is long enough that the
   * command count stays small, and the value is small enough that bandwidth
   * does too. Everything else is L1-only, which costs nothing and still spares
   * the database every repeat read within a lambda's lifetime.
   */
  shared?: boolean;
}

/**
 * Read through the cache, or load and fill it.
 *
 * `ttlSeconds` is how stale an answer may be, and it is the only staleness
 * control that matters — a round unlock reaches teams through the realtime
 * channel regardless, so the TTL governs the fallback path, not the fast one.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
  options: CacheOptions = {},
): Promise<T> {
  const now = Date.now();
  const useRedis = options.shared === true;

  const hit = l1.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;

  const shared = useRedis ? await redisGet(key) : undefined;
  if (shared !== undefined) {
    // Half the TTL locally. The shared copy already has a deadline of its own,
    // and holding it in-process for the full window would let one lambda serve
    // a value that Redis had already replaced.
    l1.set(key, { value: shared, expiresAt: now + (ttlSeconds * 1000) / 2 });
    return shared as T;
  }

  const value = await load();
  l1.set(key, { value, expiresAt: now + ttlSeconds * 1000 });
  if (useRedis) void redisSet(key, value, ttlSeconds);
  return value;
}

/**
 * Drop keys from both tiers.
 *
 * L1 is dropped only in the process that calls this — the other lambdas keep
 * their copies until they expire. That is why the local TTLs here are seconds
 * rather than minutes: invalidation is a best-effort speedup, and expiry is
 * what actually guarantees correctness.
 */
export async function invalidate(...keys: string[]): Promise<void> {
  for (const key of keys) l1.delete(key);
  if (!redisEnabled || keys.length === 0) return;
  try {
    await redisCommand(['DEL', ...keys]);
  } catch (error) {
    warnOnce('redis DEL', error);
  }
}

/** Empties the in-process tier. Tests and the admin cache-flush button. */
export function clearLocalCache(): void {
  l1.clear();
}
