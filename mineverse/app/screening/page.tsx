import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { ScreeningEntry } from '@/components/screening/ScreeningEntry';

export const dynamic = 'force-dynamic';

/**
 * The screening qualifier.
 *
 * Deliberately not under `(game)` — that group's layout assumes a game round
 * with a biome and an economy, and the screening has neither. Access is the
 * team session plus the window; there is no `team_round_access` lock to clear,
 * because every registered team may sit it.
 */
export default async function ScreeningPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/screening');

  return <ScreeningEntry />;
}
