import { NextRequest, NextResponse } from 'next/server';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { listManualReview } from '@/lib/gameplay/grading/service';

export async function GET(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const roundParam = req.nextUrl.searchParams.get('round_id');
  const roundId = roundParam ? Number.parseInt(roundParam, 10) : undefined;

  if (roundParam && !Number.isInteger(roundId)) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_ROUND' } }, { status: 400 });
  }

  try {
    const submissions = await listManualReview(roundId);
    return NextResponse.json({ success: true, data: { submissions, count: submissions.length } });
  } catch (error) {
    console.error('Manual Review List Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
