import { isIpAddress } from '@/lib/request-ip';

/**
 * Canonical Cloudflare Turnstile server-side verification.
 *
 * Called from API routes only — never from the browser.
 * Tokens are single-use; a second call with the same token returns
 * `success: false` with error code `timeout-or-duplicate`.
 */
export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string | null,
): Promise<boolean> {
  const form = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET!,
    response: token,
  });
  // `remoteip` is optional, and it has to be one bare address. We used to pass
  // the raw `x-forwarded-for` header, which is a proxy chain, or the literal
  // string 'unknown' when the header was missing — neither is an IP.
  if (isIpAddress(remoteIp)) form.set('remoteip', remoteIp);

  let result: { success: boolean };
  try {
    const r = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
      },
    );
    if (!r.ok) throw new Error(`siteverify ${r.status}`);
    result = await r.json();
  } catch {
    // Network error, non-2xx, or non-JSON body. Fail closed.
    return false;
  }
  return result.success === true;
}
