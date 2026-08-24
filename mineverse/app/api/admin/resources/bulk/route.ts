import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { supabaseServer } from '@/lib/supabase/server';
import { deterministicUuid } from '@/lib/uuid-v5';

const db = supabaseServer as any;

/**
 * One resource grant applied to many teams.
 *
 * The offline rounds are played in the hall, off the platform: an organiser
 * watches a physical game and then has to credit what every team earned. The
 * single-team screen makes that ninety-odd repetitions of pick-team, type-delta,
 * type-reason, submit — which is slow enough that it will be done wrong, and
 * there is no way to tell afterwards whether team forty was missed or genuinely
 * earned nothing.
 *
 * Same ledger, same audited RPC, same reason string. Only the loop is new.
 *
 * ## Retrying is safe
 *
 * Each team's adjustment is keyed on `(idempotency_key, team_id)` hashed into a
 * UUID, so re-submitting an identical grant — a flaky connection, a double
 * click, an organiser unsure whether it went through — collides with the
 * original and pays nothing. A *new* grant needs a new key, which the client
 * generates per submission.
 *
 * ## Failure is per team, not per batch
 *
 * A grant that would drive one team's balance negative must not silently drop
 * the other ninety. Every team is attempted and the response reports each
 * outcome, so the organiser sees exactly who was credited.
 */

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

const bulkSchema = z.object({
  team_ids: z.array(z.string().uuid()).min(1).max(300),
  delta: deltaSchema,
  reason: z.string().trim().min(1).max(1000),
  idempotency_key: z.string().uuid(),
});

interface Outcome {
  team_id: string;
  ok: boolean;
  code?: string;
  message?: string;
}

export async function POST(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const headerKey = req.headers.get('Idempotency-Key');

  try {
    const body = await req.json();
    const parsed = bulkSchema.safeParse({ ...body, idempotency_key: body.idempotency_key || headerKey });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PAYLOAD', message: parsed.error.issues[0]?.message } },
        { status: 400 },
      );
    }

    // Duplicates in the list would otherwise be two attempts on the same key —
    // harmless, but they make the result count disagree with what was asked.
    const teamIds = [...new Set(parsed.data.team_ids)];
    const outcomes: Outcome[] = [];

    // Sequential on purpose. Every call goes through `apply_manual_adjustment`,
    // which takes the team's resource row; running three hundred of those at
    // once turns a slow screen into lock contention and lost writes.
    for (const teamId of teamIds) {
      const key = deterministicUuid(`mineverse:bulk-grant:${parsed.data.idempotency_key}:${teamId}`);

      const { error } = await db.rpc('apply_manual_adjustment', {
        p_team_id: teamId,
        p_delta: parsed.data.delta,
        p_reason: parsed.data.reason,
        p_admin_id: guard.adminId,
        p_idempotency_key: key,
      });

      if (!error) {
        outcomes.push({ team_id: teamId, ok: true });
        continue;
      }

      const message = String(error.message ?? '');
      if (message.includes('insufficient')) {
        outcomes.push({
          team_id: teamId,
          ok: false,
          code: 'INSUFFICIENT_RESOURCES',
          message: 'Would drive a balance negative.',
        });
      } else if (message.toLowerCase().includes('idempot') || error.code === '23505') {
        // Already applied under this key — the grant stands, so this is a
        // success from the organiser's point of view, not a failure to retry.
        outcomes.push({ team_id: teamId, ok: true, code: 'ALREADY_APPLIED' });
      } else {
        console.error(`Bulk grant failed for team ${teamId}:`, error);
        outcomes.push({ team_id: teamId, ok: false, code: 'SERVER_ERROR', message: 'Could not apply.' });
      }
    }

    const granted = outcomes.filter((row) => row.ok).length;

    return NextResponse.json({
      success: true,
      data: {
        requested: teamIds.length,
        granted,
        failed: teamIds.length - granted,
        outcomes,
      },
    });
  } catch (error) {
    console.error('Bulk Grant Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
