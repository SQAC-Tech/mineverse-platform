import { NextRequest, NextResponse } from 'next/server';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { getDay2Round5Run, processDay2Round5Batch } from '@/lib/grading/day2-round5';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const result = await getDay2Round5Run(id);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: { code: result.code, message: result.message } },
        { status: result.status },
      );
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Day2 Grading Status Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const result = await processDay2Round5Batch(id, guard.adminId);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: { code: result.code, message: result.message } },
        { status: result.status },
      );
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Day2 Grading Batch Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}

