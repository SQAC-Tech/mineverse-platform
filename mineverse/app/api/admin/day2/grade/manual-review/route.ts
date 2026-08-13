import { NextResponse } from 'next/server';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { listDay2ManualReview } from '@/lib/grading/day2-round5';

export async function GET() {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  try {
    const submissions = await listDay2ManualReview();
    return NextResponse.json({ success: true, data: { submissions } });
  } catch (error) {
    console.error('Day2 Manual Review Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}

