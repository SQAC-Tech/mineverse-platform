import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { supabaseServer } from '@/lib/supabase/server';

const db = supabaseServer as any;

const deltaSchema = z
  .object({
    wood: z.number().int().optional(),
    stone: z.number().int().optional(),
    iron: z.number().int().optional(),
    gold: z.number().int().optional(),
    diamond: z.number().int().optional(),
    emerald: z.number().int().optional(),
    obsidian: z.number().int().optional(),
  })
  .refine((delta) => Object.values(delta).some((value) => value !== 0), {
    message: 'Provide at least one non-zero resource delta.',
  });

const adjustmentSchema = z.object({
  team_id: z.string().uuid(),
  delta: deltaSchema,
  reason: z.string().trim().min(1).max(1000),
  idempotency_key: z.string().uuid(),
});

/**
 * Audited manual adjustment. This endpoint moves resources only — it cannot set
 * qualification status (PHASE2_API.md §3.3).
 */
export async function POST(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const headerKey = req.headers.get('Idempotency-Key');

  try {
    const body = await req.json();
    const parsed = adjustmentSchema.safeParse({ ...body, idempotency_key: body.idempotency_key || headerKey });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PAYLOAD', message: parsed.error.issues[0]?.message } },
        { status: 400 },
      );
    }

    const { data, error } = await db.rpc('apply_manual_adjustment', {
      p_team_id: parsed.data.team_id,
      p_delta: parsed.data.delta,
      p_reason: parsed.data.reason,
      p_admin_id: guard.adminId,
      p_idempotency_key: parsed.data.idempotency_key,
    });

    if (error) {
      if (error.message?.includes('insufficient')) {
        return NextResponse.json(
          { success: false, error: { code: 'INSUFFICIENT_RESOURCES', message: 'The adjustment would drive a balance negative.' } },
          { status: 422 },
        );
      }
      if (error.message?.includes('reason is required')) {
        return NextResponse.json(
          { success: false, error: { code: 'REASON_REQUIRED', message: 'A non-empty reason is required.' } },
          { status: 400 },
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Manual Adjustment Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
