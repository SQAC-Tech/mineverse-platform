import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { applyGradingOverride } from '@/lib/gameplay/grading/service';

const overrideSchema = z.object({
  submission_id: z.string().uuid(),
  score: z.number().min(0).max(1),
  reason: z.string().trim().min(1).max(1000),
});

export async function POST(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  try {
    const parsed = overrideSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PAYLOAD', message: 'A submission, score, and non-empty reason are required.' } },
        { status: 400 },
      );
    }

    const result = await applyGradingOverride({
      submissionId: parsed.data.submission_id,
      score: parsed.data.score,
      reason: parsed.data.reason,
      adminId: guard.adminId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: { code: result.code, message: result.message } },
        { status: result.status },
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Grading Override Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
