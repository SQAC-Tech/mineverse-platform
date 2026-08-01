import { NextResponse } from 'next/server';
import { verifyPanelToken, PANEL_COOKIE } from '@/lib/panel/session';
import { exportQualifiedTeams } from '@/lib/gameplay/qualification/service';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(PANEL_COOKIE)?.value;

  if (!token) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const isAdmin = await verifyPanelToken(token, 'admin');
  if (!isAdmin) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 403 });

  try {
    const data = await exportQualifiedTeams();

    if (!data) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FROZEN', message: 'Qualification has not been frozen yet.' } },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error('Export Qualified Teams Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
