import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePanelScope } from '@/lib/panel/require-admin';
import {
  createReconciliation,
  gatherReconciliationEvidence,
  listReconciliations,
} from '@/lib/day2/reconciliation/service';

const createSchema = z.object({
  team_id: z.string().uuid(),
  state: z.enum(['completed', 'blocked']),
  discrepancies: z.array(z.unknown()).optional().default([]),
  operator_notes: z.string().trim().min(1).max(4000),
  idempotency_key: z.string().uuid(),
});

export async function GET(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const teamId = req.nextUrl.searchParams.get('team_id');
  const evidenceOnly = req.nextUrl.searchParams.get('evidence') === '1';

  try {
    if (teamId && evidenceOnly) {
      const evidence = await gatherReconciliationEvidence(teamId);
      return NextResponse.json({ success: true, data: { evidence } });
    }

    const reconciliations = await listReconciliations(teamId);
    return NextResponse.json({ success: true, data: { reconciliations } });
  } catch (error) {
    console.error('Day2 Reconciliation GET Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const headerKey = req.headers.get('Idempotency-Key');

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse({ ...body, idempotency_key: body.idempotency_key || headerKey });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PAYLOAD', message: parsed.error.issues[0]?.message } },
        { status: 400 },
      );
    }

    const result = await createReconciliation({
      teamId: parsed.data.team_id,
      state: parsed.data.state,
      discrepancies: parsed.data.discrepancies,
      operatorNotes: parsed.data.operator_notes,
      adminId: guard.adminId,
      idempotencyKey: parsed.data.idempotency_key,
    });

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Day2 Reconciliation POST Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}

