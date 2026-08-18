import { NextResponse } from 'next/server';

/**
 * In-process fixed-window rate limiter.
 *
 * Counters live in one serverless instance's memory, so several instances each
 * keep their own and the real ceiling is some multiple of `max`. That is fine
 * for what these limits actually do — shed floods, slow brute force — but it is
 * not an exact quota, so never size one as if it were.
 *
 * Choose the key with care. Keying on IP looks like the obvious move and is the
 * wrong one for this event: the entire campus reaches us through a single SRMIST
 * NAT address, so an IP-keyed budget is a *shared* budget that legitimate users
 * burn on each other's behalf. Ration the thing you actually mean to ration — a
 * college email, a team code — and keep IP limits loose enough that a few
 * hundred people behind one address never trip them.
 */

type Bucket = { count: number; expiresAt: number };

const buckets = new Map<string, Bucket>();
let nextSweep = 0;

/** Expired buckets are never read again, so drop them and keep the map bounded. */
function sweep(now: number) {
  if (now < nextSweep) return;
  nextSweep = now + 60_000;
  for (const [key, bucket] of buckets) {
    if (bucket.expiresAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  /** Seconds until this window resets. 0 when allowed. */
  retryAfterSeconds: number;
};

const ALLOWED: RateLimitResult = { allowed: true, retryAfterSeconds: 0 };

const blocked = (bucket: Bucket, now: number): RateLimitResult => ({
  allowed: false,
  retryAfterSeconds: Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000)),
});

/** Spend one unit against `key`. */
export function consumeRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.expiresAt <= now) {
    buckets.set(key, { count: 1, expiresAt: now + windowMs });
    return ALLOWED;
  }
  if (bucket.count >= max) return blocked(bucket, now);

  bucket.count += 1;
  return ALLOWED;
}

/**
 * Read `key` without spending from it, for limits that should only charge for
 * failures: peek to decide whether to serve, consume only once the attempt has
 * actually turned out to be a bad one.
 */
export function peekRateLimit(key: string, max: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.expiresAt <= now || bucket.count < max) return ALLOWED;
  return blocked(bucket, now);
}

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  return consumeRateLimit(key, max, windowMs).allowed;
}

/** "about 4 minutes" — for error copy, which the client shows verbatim in a toast. */
export function retryHint(retryAfterSeconds: number): string {
  if (retryAfterSeconds <= 60) return 'about a minute';
  return `about ${Math.ceil(retryAfterSeconds / 60)} minutes`;
}

export function tooManyRequests(error: string, retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { success: false, error },
    { status: 429, headers: { 'Retry-After': String(Math.max(1, retryAfterSeconds)) } },
  );
}
