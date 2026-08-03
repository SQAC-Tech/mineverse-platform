import { NextRequest, NextResponse } from 'next/server';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { getGradingRun, processGradingBatch } from '@/lib/gameplay/grading/service';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const result = await getGradingRun(id);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: { code: result.code, message: result.message } },
        { status: result.status },
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Grading Run Status Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}

/** Resumes the run by grading the next batch. Durable, not fire-and-forget. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const result = await processGradingBatch(id, guard.adminId);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: { code: result.code, message: result.message } },
        { status: result.status },
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Grading Run Resume Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
