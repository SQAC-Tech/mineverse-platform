/**
 * Canonical Cloudflare Turnstile server-side verification.
 *
 * Called from API routes only — never from the browser.
 * Tokens are single-use; a second call with the same token returns
 * `success: false` with error code `timeout-or-duplicate`.
 */
export async function verifyTurnstileToken(
  token: string,
  remoteIp: string,
): Promise<boolean> {
  let result: { success: boolean };
  try {
    const r = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: process.env.TURNSTILE_SECRET!,
          response: token,
          remoteip: remoteIp,
        }),
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
