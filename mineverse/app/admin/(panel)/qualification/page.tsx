import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyPanelToken, PANEL_COOKIE } from '@/lib/panel/session';
import { getQualificationOverview } from '@/lib/gameplay/qualification/service';
import AdminQualificationClient from '@/components/game/qualification/AdminQualificationClient';

export default async function AdminQualificationPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(PANEL_COOKIE)?.value;

  if (!token || !(await verifyPanelToken(token, 'admin'))) {
    redirect('/admin/login');
  }

  const overview = await getQualificationOverview();

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Day 1 Qualification Admin</h1>
      <AdminQualificationClient initialData={overview} />
    </div>
  );
}
