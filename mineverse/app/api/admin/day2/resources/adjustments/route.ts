import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { supabaseServer } from '@/lib/supabase/server';
import { addDelta, day2ResourceKeys, hasNonZeroDelta, normalizeDelta } from '@/lib/day2/events/resources';

const db = supabaseServer as any;

const resourceSchema = z.object({
  wood: z.number().int(),
  stone: z.number().int(),
  iron: z.number().int(),
  gold: z.number().int(),
  diamond: z.number().int(),
  emerald: z.number().int(),
  obsidian: z.number().int(),
});

const deltaSchema = resourceSchema.partial();

const adjustmentSchema = z.object({
  team_id: z.string().uuid(),
  delta: deltaSchema,
  reason: z.string().trim().min(1).max(1000),
  expected_balance_before: resourceSchema,
  expected_balance_after: resourceSchema,
  idempotency_key: z.string().uuid(),
  notes: z.string().trim().max(2000).optional(),
});

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

    const delta = normalizeDelta(parsed.data.delta);
    if (!hasNonZeroDelta(delta)) {
      return NextResponse.json(
        { success: false, error: { code: 'EMPTY_DELTA', message: 'Provide at least one non-zero resource delta.' } },
        { status: 400 },
      );
    }

    const calculatedAfter = addDelta(parsed.data.expected_balance_before, delta);
    const matchesAfter = day2ResourceKeys.every(
      (key) => calculatedAfter[key] === parsed.data.expected_balance_after[key],
    );
    if (!matchesAfter) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFIRMATION_MISMATCH', message: 'Expected after-balance does not match the requested delta.' } },
        { status: 400 },
      );
    }

    const { data, error } = await db.rpc('dev5_apply_day2_manual_adjustment', {
      p_team_id: parsed.data.team_id,
      p_delta: delta,
      p_reason: parsed.data.reason,
      p_admin_id: guard.adminId,
      p_idempotency_key: parsed.data.idempotency_key,
      p_expected_balance_before: parsed.data.expected_balance_before,
      p_expected_balance_after: parsed.data.expected_balance_after,
      p_notes: parsed.data.notes ?? null,
    });

    if (error) {
      if (error.message?.includes('mismatch')) {
        return NextResponse.json(
          { success: false, error: { code: 'BALANCE_CONFIRMATION_MISMATCH', message: error.message } },
          { status: 409 },
        );
      }
      if (error.message?.includes('insufficient')) {
        return NextResponse.json(
          { success: false, error: { code: 'INSUFFICIENT_RESOURCES', message: 'The adjustment would drive a balance negative.' } },
          { status: 422 },
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Day2 Adjustment Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const teamId = req.nextUrl.searchParams.get('team_id');

  try {
    let query = db
      .from('day2_manual_adjustments')
      .select('id, team_id, requested_delta, reason, admin_id, requested_at, ledger_id, status, notes, teams(team_code, team_name)')
      .order('requested_at', { ascending: false })
      .limit(100);

    if (teamId) query = query.eq('team_id', teamId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: { adjustments: data ?? [] } });
  } catch (error) {
    console.error('Day2 Adjustment List Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}

