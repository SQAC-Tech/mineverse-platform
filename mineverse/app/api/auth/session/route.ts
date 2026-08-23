import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * Whether the browser already holds a team session, and whose.
 *
 * Exists so the login screen can offer "ENTER DASHBOARD" to a team that is
 * already signed in, instead of making it log in again to find out. The session
 * cookie is httpOnly, so the client genuinely cannot answer this for itself.
 *
 * Deliberately thin: the team code and nothing else. It is read by an
 * unauthenticated page, so it must not become a way to learn anything about a
 * team beyond the fact that this browser is already that team.
 */
export async function GET() {
  const session = await getSession();

  return NextResponse.json({
    success: true,
    data: session
      ? { signed_in: true, team_code: session.team_code }
      : { signed_in: false, team_code: null },
  });
}
