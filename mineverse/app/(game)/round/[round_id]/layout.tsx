import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import '../../../theme-kit.css';
import '../biome.css';

export default async function RoundLayout({ children }: { children: React.ReactNode }) {
  // Matches the dashboard guard: an expired session lands on login rather than
  // on a round screen that only fails once its first fetch returns 401.
  const session = await getSession();
  if (!session) redirect('/login');

  return children;
}
