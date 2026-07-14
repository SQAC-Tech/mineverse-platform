const rateLimiter = new Map<string, { count: number; expiresAt: number }>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimiter.get(key);

  if (!record || record.expiresAt < now) {
    rateLimiter.set(key, { count: 1, expiresAt: now + windowMs });
    return true;
  }

  if (record.count >= max) {
    return false;
  }

  record.count += 1;
  return true;
}
