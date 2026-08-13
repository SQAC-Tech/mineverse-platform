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
  /**
   * Repairing the Nether Portal needs a Portal Fragment and a Nether Core, and
   * neither is a resource — they live in `day2_portal_fragments` and
   * `team_game_state.nether_core_count`. The fragment used to fall out of a
   * recorded offline-game result; with the offline games off the platform the
   * same organizer who credits the resources ticks these.
   */
  grant_portal_fragment: z.boolean().optional().default(false),
  grant_nether_core: z.boolean().optional().default(false),
});

/**
 * The one screen that hands resources to a team. Everything an organizer decides
 * off the platform — physical games, corrections, judgement calls — lands here
 * and is written to the same audited ledger as in-game earnings.
 *
 * It moves resources only; it cannot set qualification status (PHASE2_API.md §3.3).
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

    // Artifacts are granted after the ledger write, so a rejected adjustment
    // never leaves a team holding a fragment it did not earn. Both writes are
    // idempotent on their own key, so a retry is inert.
    const artifacts: Record<string, boolean> = {};

    if (parsed.data.grant_portal_fragment) {
      const { error: fragmentError } = await db
        .from('day2_portal_fragments')
        .upsert(
          { team_id: parsed.data.team_id, source: `admin_grant:${guard.adminId}` },
          { onConflict: 'team_id', ignoreDuplicates: true },
        );

      if (fragmentError) throw fragmentError;
      artifacts.portal_fragment = true;
    }

    if (parsed.data.grant_nether_core) {
      // A team can win more than one core in PvP, so this tops up to one rather
      // than setting the count — granting must never take a core away.
      const { data: state, error: stateError } = await db
        .from('team_game_state')
        .select('nether_core_count')
        .eq('team_id', parsed.data.team_id)
        .maybeSingle();

      if (stateError) throw stateError;

      if ((state?.nether_core_count ?? 0) < 1) {
        const { error: coreError } = await db
          .from('team_game_state')
          .upsert({ team_id: parsed.data.team_id, nether_core_count: 1 }, { onConflict: 'team_id' });

        if (coreError) throw coreError;
      }

      artifacts.nether_core = true;
    }

    return NextResponse.json({ success: true, data, artifacts });
  } catch (error) {
    console.error('Manual Adjustment Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
