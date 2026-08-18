/**
 * The single client IP for a request.
 *
 * `x-forwarded-for` is a list — `client, proxy1, proxy2` — and only the leftmost
 * entry is the original client. Handing the raw header around made every
 * consumer subtly wrong: rate-limit keys changed whenever the proxy path did,
 * and Cloudflare's siteverify wants one bare address for `remoteip`, not a
 * chain and not the literal string `unknown` we used to substitute.
 *
 * The value comes from a proxy and is spoofable, so treat it as a hint for
 * traffic shaping, never as proof of who someone is.
 */
export function clientIp(req: Request): string | null {
  for (const header of ['x-forwarded-for', 'x-real-ip']) {
    const first = req.headers.get(header)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return null;
}

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-f:]+$/i;

export function isIpAddress(value: string | null | undefined): value is string {
  if (!value) return false;
  return IPV4.test(value) || (value.includes(':') && IPV6.test(value));
}
