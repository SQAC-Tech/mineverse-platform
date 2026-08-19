import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { verifyTeamRoundAccess } from '@/lib/gameplay/utils/access';

/**
 * Page-level gate for a round route.
 *
 * Rounds 1 and 5 each carried their own inline copy of this and Rounds 2, 3 and
 * 4 carried nothing at all, so a signed-out visitor was served the round shell
 * and a signed-in team could open a round the organizers had not unlocked yet.
 * There is no `app/(game)/layout.tsx` covering the group, so each page calls
 * this itself.
 *
 * The check delegates to `verifyTeamRoundAccess`, the same helper the round APIs
 * use, so a page and the endpoints it calls can never disagree about who is let
 * in. This is a redirect, not a security boundary — every mutation still
 * re-validates on its own.
 *
 * Redirects (and never returns) on failure, so a returned session is proof of
 * access.
 */
export async function requireRoundAccess(roundId: number) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { hasAccess } = await verifyTeamRoundAccess(session.team_id, roundId);
  if (!hasAccess) redirect('/dashboard');

  return session;
}
