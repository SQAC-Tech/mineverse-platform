import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import '../../theme-kit.css';
import '../biome.css';

/**
 * Round 5 had no layout, so it loaded neither the component kit nor the palette
 * and rendered as unstyled text. Every other round in this group has one.
 */
export default async function RoundLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  return children;
}
