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

  // The client component renders its own PageTitle so it matches the other
  // panel screens; the layout already supplies padding and max width.
  const overview = await getQualificationOverview();

  return <AdminQualificationClient initialData={overview} />;
}
