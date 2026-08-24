import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import '../../theme-kit.css';
import '../biome.css';

/**
 * The duel was added as a round without one of these, so it inherited the same
 * fault Round 5 had: `CustomRoundShell` imports only `round-ui.css`, and the
 * component kit and the biome palette come from here. Without them the duel
 * screen renders as unstyled text — and it is the one round nobody has opened
 * in a browser yet, so nothing had caught it.
 *
 * The session redirect matters for the same reason it does elsewhere: the page
 * calls `requireRoundAccess`, which needs a session to check anything at all.
 */
export default async function RoundLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  return children;
}
