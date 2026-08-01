import { NextResponse } from 'next/server';
import { verifyPanelToken, PANEL_COOKIE } from '@/lib/panel/session';
import { getQualificationOverview } from '@/lib/gameplay/qualification/service';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(PANEL_COOKIE)?.value;

  if (!token) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const isAdmin = await verifyPanelToken(token, 'admin');
  if (!isAdmin) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 403 });

  try {
    const overview = await getQualificationOverview();
    return NextResponse.json({ success: true, data: overview });
  } catch (error: unknown) {
    console.error('Get Qualification Overview Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
