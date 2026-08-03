import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { voidPvpMatch } from '@/lib/gameplay/pvp/admin-service';

const voidSchema = z.object({ reason: z.string().trim().min(1).max(1000) });

/** Voiding never changes a resolved result and issues no award. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const parsed = voidSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'REASON_REQUIRED', message: 'A non-empty void reason is required.' } },
        { status: 400 },
      );
    }

    const result = await voidPvpMatch(id, guard.adminId, parsed.data.reason);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: { code: result.code, message: result.message } },
        { status: result.status },
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('PvP Match Void Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
