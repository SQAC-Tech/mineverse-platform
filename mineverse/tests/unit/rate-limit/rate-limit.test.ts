import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  consumeRateLimit,
  peekRateLimit,
  rateLimit,
  retryHint,
} from '../../../lib/rate-limit';
import { clientIp, isIpAddress } from '../../../lib/request-ip';

/**
 * Regression guard for the campus-NAT lockout: every participant reaches the app
 * through one SRMIST public IP, so anything keyed on IP is a budget the whole
 * campus spends on each other. These tests pin the shape of the limiter and the
 * IP parsing that feeds it.
 */

// Buckets are module-level, so each test needs a key nobody else touches.
let n = 0;
const freshKey = () => `test:${process.pid}:${n++}`;

afterEach(() => vi.useRealTimers());

describe('consumeRateLimit', () => {
  it('allows exactly `max` calls, then blocks', () => {
    const key = freshKey();
    for (let i = 0; i < 3; i++) expect(consumeRateLimit(key, 3, 60_000).allowed).toBe(true);
    expect(consumeRateLimit(key, 3, 60_000).allowed).toBe(false);
  });

  it('reports how long the caller has to wait', () => {
    vi.useFakeTimers();
    const key = freshKey();
    consumeRateLimit(key, 1, 10 * 60_000);

    vi.advanceTimersByTime(4 * 60_000);
    expect(consumeRateLimit(key, 1, 10 * 60_000).retryAfterSeconds).toBe(6 * 60);
  });

  it('starts a fresh window once the old one expires', () => {
    vi.useFakeTimers();
    const key = freshKey();
    consumeRateLimit(key, 1, 60_000);
    expect(consumeRateLimit(key, 1, 60_000).allowed).toBe(false);

    vi.advanceTimersByTime(60_001);
    expect(consumeRateLimit(key, 1, 60_000).allowed).toBe(true);
  });

  it('keeps separate keys independent — one team hitting its cap must not block another', () => {
    const a = freshKey();
    const b = freshKey();
    consumeRateLimit(a, 1, 60_000);
    expect(consumeRateLimit(a, 1, 60_000).allowed).toBe(false);
    expect(consumeRateLimit(b, 1, 60_000).allowed).toBe(true);
  });

  it('keeps the legacy boolean wrapper in step', () => {
    const key = freshKey();
    expect(rateLimit(key, 1, 60_000)).toBe(true);
    expect(rateLimit(key, 1, 60_000)).toBe(false);
  });
});

describe('peekRateLimit', () => {
  it('does not spend from the bucket', () => {
    const key = freshKey();
    for (let i = 0; i < 5; i++) expect(peekRateLimit(key, 1).allowed).toBe(true);
    expect(consumeRateLimit(key, 1, 60_000).allowed).toBe(true);
  });

  it('blocks once the bucket is exhausted', () => {
    const key = freshKey();
    consumeRateLimit(key, 1, 60_000);
    expect(peekRateLimit(key, 1).allowed).toBe(false);
  });

  it('lets unlimited successful panel logins through while capping failures', () => {
    // Mirrors app/api/panel/login: peek to admit, consume only on a bad password.
    const key = freshKey();
    const succeed = () => peekRateLimit(key, 2).allowed;
    const fail = () => {
      const admitted = peekRateLimit(key, 2).allowed;
      if (admitted) consumeRateLimit(key, 2, 60_000);
      return admitted;
    };

    for (let i = 0; i < 50; i++) expect(succeed()).toBe(true);
    expect(fail()).toBe(true);
    expect(fail()).toBe(true);
    expect(fail()).toBe(false);
    expect(succeed()).toBe(false);
  });
});

describe('retryHint', () => {
  it.each([
    [1, 'about a minute'],
    [60, 'about a minute'],
    [61, 'about 2 minutes'],
    [600, 'about 10 minutes'],
  ])('renders %i seconds as "%s"', (seconds, expected) => {
    expect(retryHint(seconds)).toBe(expected);
  });
});

describe('clientIp', () => {
  const withHeaders = (headers: Record<string, string>) =>
    new Request('https://mineverse.sqac.space/api/register', { method: 'POST', headers });

  it('takes the leftmost x-forwarded-for entry, not the whole chain', () => {
    expect(clientIp(withHeaders({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178' })))
      .toBe('203.0.113.7');
  });

  it('falls back to x-real-ip', () => {
    expect(clientIp(withHeaders({ 'x-real-ip': '203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('returns null rather than a placeholder when no proxy header is present', () => {
    expect(clientIp(withHeaders({}))).toBeNull();
  });
});

describe('isIpAddress', () => {
  it.each(['203.0.113.7', '2001:db8::1', '::1'])('accepts %s', (value) => {
    expect(isIpAddress(value)).toBe(true);
  });

  it.each([
    ['a forwarded chain', '203.0.113.7, 70.41.3.18'],
    ['the old placeholder', 'unknown'],
    ['empty', ''],
  ])('rejects %s', (_label, value) => {
    expect(isIpAddress(value)).toBe(false);
  });

  it('rejects null and undefined', () => {
    expect(isIpAddress(null)).toBe(false);
    expect(isIpAddress(undefined)).toBe(false);
  });
});
