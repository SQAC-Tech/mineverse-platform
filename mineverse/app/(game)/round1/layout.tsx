import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import '../../theme-kit.css';

export default async function RoundLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  return children;
}
