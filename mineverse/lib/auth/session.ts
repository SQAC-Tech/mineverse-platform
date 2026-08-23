import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
export const SESSION_COOKIE = 'session_token';

/**
 * How long a signed-in team stays signed in.
 *
 * This was 24 hours, which is shorter than the event. A team logging in at 9am
 * on day 1 was thrown out around 9am on day 2 — mid-round — and, under the old
 * login latch, could not get back in at all. The window now covers both days
 * and the evening either side of them with room to spare, so expiry is never
 * the thing that ends a team's morning.
 */
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

/**
 * The browser's identity, independent of the team signed in on it.
 *
 * The one-device rule needs to recognise a returning browser, and none of the
 * obvious signals do that: the IP is shared by the whole venue behind one NAT,
 * and the session cookie is exactly what goes missing in the cases that matter
 * (expiry, logout, a cleared jar). A dedicated cookie with a long life survives
 * all of those, which is what makes the lease in `./login-lease` able to let a
 * team back onto its own laptop.
 *
 * `lax` rather than the session cookie's `strict`: this one has to arrive on a
 * navigation in from a mail link, and it authorises nothing on its own.
 */
export const DEVICE_COOKIE = 'mnv_device';
const DEVICE_TTL_SECONDS = 60 * 60 * 24 * 365;

export async function createSessionToken(teamId: string, teamCode: string) {
  return new SignJWT({ team_id: teamId, team_code: teamCode, kind: 'team' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(SECRET);
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET, { clockTolerance: 60 });
    if (payload.kind !== 'team') return null;
    return { team_id: payload.team_id as string, team_code: payload.team_code as string };
  } catch {
    return null;
  }
}

export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_TTL_SECONDS,
    path: '/',
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The device id this browser already carries, if it has one. */
export async function readDeviceId(): Promise<string | null> {
  const value = (await cookies()).get(DEVICE_COOKIE)?.value;
  return value && value.length >= 8 ? value : null;
}

/**
 * The device id for this browser, minting one if it has none.
 *
 * Only callable from a Route Handler or Server Function — setting a cookie
 * needs response headers that are already gone by render time.
 */
export async function ensureDeviceId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(DEVICE_COOKIE)?.value;
  if (existing && existing.length >= 8) return existing;

  const id = crypto.randomUUID();
  jar.set(DEVICE_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: DEVICE_TTL_SECONDS,
    path: '/',
  });
  return id;
}
