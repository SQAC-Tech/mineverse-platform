import { NextResponse } from 'next/server';
import { clearSessionCookie, getSession, readDeviceId } from '@/lib/auth/session';
import { releaseLoginLease } from '@/lib/auth/login-lease';

/**
 * Signs the team out, and gives its seat back.
 *
 * Releasing the lease is the whole point. This used to clear the cookie alone,
 * which meant the LOGOUT button on the dashboard was a trapdoor: the team was
 * signed out, the one-device latch stayed set, and the only way back in was an
 * organizer clicking Release in the admin panel. Pressing Logout should be an
 * ordinary thing to do.
 *
 * The session is read before the cookie is cleared, for the obvious reason.
 */
export async function POST() {
  const session = await getSession();

  if (session) {
    const deviceId = await readDeviceId();
    await releaseLoginLease(session.team_id, deviceId);
  }

  await clearSessionCookie();
  return NextResponse.json({ success: true, redirect: '/' });
}
