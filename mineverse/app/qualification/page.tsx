import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { QualificationStatus } from '@/components/game/qualification/QualificationStatus';

export default async function QualificationPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-bold text-center text-neutral-200 mb-6">Day 1 Qualification</h1>
        <QualificationStatus />
      </div>
    </div>
  );
}
