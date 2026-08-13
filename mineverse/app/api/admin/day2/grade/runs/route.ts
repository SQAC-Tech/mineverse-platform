import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { createDay2Round5GradingRun, processDay2Round5Batch } from '@/lib/grading/day2-round5';

const createSchema = z.object({
  round_id: z.literal(5).optional().default(5),
  process: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PAYLOAD', message: 'Day 2 grading only supports Round 5.' } },
        { status: 400 },
      );
    }

    const run = await createDay2Round5GradingRun(guard.adminId, parsed.data.round_id);
    if (!run.ok) {
      return NextResponse.json(
        { success: false, error: { code: run.code, message: run.message } },
        { status: run.status },
      );
    }

    if (!parsed.data.process) return NextResponse.json({ success: true, data: run.data });

    const batch = await processDay2Round5Batch(run.data.id, guard.adminId);
    if (!batch.ok) {
      return NextResponse.json(
        { success: false, error: { code: batch.code, message: batch.message } },
        { status: batch.status },
      );
    }

    return NextResponse.json({ success: true, data: batch.data });
  } catch (error) {
    console.error('Day2 Grading Create Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}

