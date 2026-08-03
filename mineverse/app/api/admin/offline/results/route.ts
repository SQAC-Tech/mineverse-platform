import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { supabaseServer } from '@/lib/supabase/server';

const db = supabaseServer as any;

const resourceDeltaSchema = z
  .object({
    wood: z.number().int().optional(),
    stone: z.number().int().optional(),
    iron: z.number().int().optional(),
    gold: z.number().int().optional(),
    diamond: z.number().int().optional(),
    emerald: z.number().int().optional(),
    obsidian: z.number().int().optional(),
  })
  .refine((delta) => Object.keys(delta).length > 0, { message: 'Award cannot be empty.' });

const offlineSchema = z.object({
  team_id: z.string().uuid(),
  round_id: z.number().int().min(1),
  activity: z.string().trim().min(1).max(120),
  award: resourceDeltaSchema,
  volunteer_name: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  idempotency_key: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const headerKey = req.headers.get('Idempotency-Key');

  try {
    const body = await req.json();
    const parsed = offlineSchema.safeParse({ ...body, idempotency_key: body.idempotency_key || headerKey });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PAYLOAD', message: parsed.error.issues[0]?.message } },
        { status: 400 },
      );
    }

    const { data, error } = await db.rpc('record_offline_result', {
      p_team_id: parsed.data.team_id,
      p_round_id: parsed.data.round_id,
      p_activity: parsed.data.activity,
      p_award: parsed.data.award,
      p_volunteer_name: parsed.data.volunteer_name ?? null,
      p_admin_id: guard.adminId,
      p_idempotency_key: parsed.data.idempotency_key,
      p_notes: parsed.data.notes ?? null,
    });

    if (error) {
      if (error.message?.includes('already recorded')) {
        return NextResponse.json(
          { success: false, error: { code: 'ALREADY_RECORDED', message: 'This activity was already paid for this team and round.' } },
          { status: 409 },
        );
      }
      if (error.message?.includes('insufficient')) {
        return NextResponse.json(
          { success: false, error: { code: 'INSUFFICIENT_RESOURCES', message: 'The award would drive a balance negative.' } },
          { status: 422 },
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Offline Result Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const roundParam = req.nextUrl.searchParams.get('round_id');

  try {
    let query = db
      .from('offline_results')
      .select('id, team_id, round_id, activity, award, volunteer_name, recorded_by, notes, created_at, teams(team_code, team_name)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (roundParam) query = query.eq('round_id', Number.parseInt(roundParam, 10));

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: { results: data ?? [] } });
  } catch (error) {
    console.error('Offline Result List Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
