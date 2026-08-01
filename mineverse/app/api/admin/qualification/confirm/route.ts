import { NextRequest, NextResponse } from 'next/server';
import { verifyPanelToken, PANEL_COOKIE } from '@/lib/panel/session';
import { confirmQualification } from '@/lib/gameplay/qualification/service';
import { z } from 'zod';
import { cookies } from 'next/headers';

const confirmSchema = z.object({
  cutoff_percent: z.number().int().min(1).max(100),
  reason: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(PANEL_COOKIE)?.value;

  if (!token) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const isAdmin = await verifyPanelToken(token, 'admin');
  if (!isAdmin) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 403 });

  try {
    const body = await req.json();
    const result = confirmSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_PAYLOAD' } }, { status: 400 });
    }

    const res = await confirmQualification({
      cutoffPercent: result.data.cutoff_percent,
      reason: result.data.reason,
    });

    if (!res.success) {
      return NextResponse.json({ success: false, error: { code: res.error, message: res.message } }, { status: 422 });
    }

    return NextResponse.json({ success: true, data: res.data });
  } catch (error: unknown) {
    console.error('Confirm Qualification Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
