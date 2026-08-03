import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { createGradingRun, processGradingBatch } from '@/lib/gameplay/grading/service';

const createSchema = z.object({
  round_id: z.number().int().min(1),
  /** Grade one batch immediately instead of only queueing the run. */
  process: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_PAYLOAD' } }, { status: 400 });
    }

    const run = await createGradingRun(parsed.data.round_id, guard.adminId);
    if (!run.ok) {
      return NextResponse.json(
        { success: false, error: { code: run.code, message: run.message } },
        { status: run.status },
      );
    }

    if (!parsed.data.process) {
      return NextResponse.json({ success: true, data: run.data });
    }

    const batch = await processGradingBatch(run.data.id, guard.adminId);
    if (!batch.ok) {
      return NextResponse.json(
        { success: false, error: { code: batch.code, message: batch.message } },
        { status: batch.status },
      );
    }

    return NextResponse.json({ success: true, data: batch.data });
  } catch (error) {
    console.error('Grading Run Create Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
