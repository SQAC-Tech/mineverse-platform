import { FinalBossUI } from '@/components/day2/final-boss/FinalBossUI';
import { requireDay2Access } from '@/lib/day2/access/guard';
import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';

export default async function FinalBossPage() {
  const guard = await requireDay2Access();
  
  if (guard instanceof NextResponse) {
    if (guard.status === 401) {
      redirect('/login');
    }
    if (guard.status === 403) {
      return (
        <div className="p-8 text-center text-red-500">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p>Your team is not qualified for Day 2.</p>
        </div>
      );
    }
    return null;
  }

  return <FinalBossUI />;
}
