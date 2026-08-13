import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { supabaseServer } from '@/lib/supabase/server';
import {
  findRound4Award,
  hasNonZeroDelta,
  normalizeDelta,
  type Round4ActivityKey,
  type Round4Outcome,
} from '@/lib/day2/events/offline';

const db = supabaseServer as any;

const deltaSchema = z.object({
  wood: z.number().int().optional(),
  stone: z.number().int().optional(),
  iron: z.number().int().optional(),
  gold: z.number().int().optional(),
  diamond: z.number().int().optional(),
  emerald: z.number().int().optional(),
  obsidian: z.literal(0).optional(),
});

const postSchema = z.object({
  team_id: z.string().uuid().optional(),
  team_ids: z.array(z.string().uuid()).min(1).max(100).optional(),
  activity_key: z.enum(['memory_challenge', 'spot_the_difference', 'insta_lollipop_soap', 'crack_the_code', 'cup_flip']),
  outcome: z.enum(['completed', 'win', 'loss']),
  configured_award: deltaSchema.optional(),
  volunteer_identity: z.string().trim().min(1).max(200),
  idempotency_key: z.string().uuid(),
  notes: z.string().trim().max(2000).optional(),
}).refine((body) => body.team_id || body.team_ids, { message: 'Select at least one team.' });

export async function POST(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const headerKey = req.headers.get('Idempotency-Key');

  try {
    const body = await req.json();
    const parsed = postSchema.safeParse({ ...body, idempotency_key: body.idempotency_key || headerKey });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PAYLOAD', message: parsed.error.issues[0]?.message } },
        { status: 400 },
      );
    }

    const catalog = findRound4Award(
      parsed.data.activity_key as Round4ActivityKey,
      parsed.data.outcome as Round4Outcome,
    );
    if (!catalog) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_OUTCOME', message: 'That outcome is not valid for this activity.' } },
        { status: 400 },
      );
    }

    const award = catalog.requiresConfiguredAward
      ? normalizeDelta(parsed.data.configured_award ?? {})
      : catalog.award;

    if (!award || !hasNonZeroDelta(award)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AWARD_REQUIRED',
            message: 'This activity has no default reward; enter the organizer-configured award before recording.',
          },
        },
        { status: 400 },
      );
    }

    const teamIds = parsed.data.team_ids ?? [parsed.data.team_id as string];
    const results = [];

    for (const teamId of teamIds) {
      const { data, error } = await db.rpc('dev5_record_round4_offline_result', {
        p_team_id: teamId,
        p_activity_key: catalog.activityKey,
        p_outcome: catalog.outcome,
        p_award: award,
        p_portal_fragment_delta: catalog.portalFragmentDelta,
        p_volunteer_identity: parsed.data.volunteer_identity,
        p_admin_id: guard.adminId,
        p_idempotency_key: parsed.data.idempotency_key,
        p_reason: `Round 4 offline result: ${catalog.label}`,
        p_notes: parsed.data.notes ?? null,
      });

      if (error) {
        if (error.message?.includes('qualification')) {
          return NextResponse.json(
            { success: false, error: { code: 'DAY2_QUALIFICATION_REQUIRED', message: 'Only Day 2-qualified teams can receive Round 4 records.' } },
            { status: 422 },
          );
        }
        if (error.message?.includes('already recorded') || error.code === '23505') {
          return NextResponse.json(
            { success: false, error: { code: 'ALREADY_RECORDED', message: 'This activity already has a result for one selected team.' } },
            { status: 409 },
          );
        }
        throw error;
      }

      results.push({ team_id: teamId, ...data });
    }

    return NextResponse.json({ success: true, data: { results, award, portal_fragment_delta: catalog.portalFragmentDelta } });
  } catch (error) {
    console.error('Day2 Offline Result Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}

export async function GET() {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  try {
    const { data, error } = await db
      .from('day2_offline_results')
      .select('id, team_id, activity_key, outcome, award, portal_fragment_delta, volunteer_identity, recorded_by, recorded_at, notes, ledger_id, teams(team_code, team_name)')
      .order('recorded_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    return NextResponse.json({ success: true, data: { results: data ?? [] } });
  } catch (error) {
    console.error('Day2 Offline List Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}

