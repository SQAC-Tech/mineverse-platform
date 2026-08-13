import { supabaseServer } from '@/lib/supabase/server';
import { day2ResourceKeys } from '@/lib/day2/events/resources';

const db = supabaseServer as any;

function snapshotBalance(row: any) {
  return Object.fromEntries(day2ResourceKeys.map((key) => [key, Number(row?.[key] ?? 0)]));
}

export async function gatherReconciliationEvidence(teamId: string) {
  const [
    qualification,
    resources,
    latestLedger,
    portalRepair,
    diamondPickaxe,
    finalBossAttempts,
    adjustments,
  ] = await Promise.all([
    db.from('team_game_state').select('*').eq('team_id', teamId).maybeSingle(),
    db.from('resources').select('*').eq('team_id', teamId).maybeSingle(),
    db
      .from('resource_ledger')
      .select('id, delta, balance_after, source_type, source_id, reason, created_at')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from('day2_portal_repair').select('*').eq('team_id', teamId).maybeSingle(),
    db.from('crafting_log').select('*').eq('team_id', teamId).eq('item', 'diamond_pickaxe').maybeSingle(),
    db
      .from('day2_final_boss_attempts')
      .select('id, status, started_at, completed_at, score_evidence')
      .eq('team_id', teamId)
      .order('started_at', { ascending: false })
      .limit(20),
    db
      .from('day2_manual_adjustments')
      .select('id, requested_delta, reason, status, requested_at, ledger_id')
      .eq('team_id', teamId)
      .neq('status', 'completed')
      .order('requested_at', { ascending: false }),
  ]);

  for (const result of [qualification, resources, latestLedger, portalRepair, diamondPickaxe, finalBossAttempts, adjustments]) {
    if (result.error && result.error.code !== 'PGRST116' && result.error.code !== '42P01') throw result.error;
  }

  const attempts = finalBossAttempts.data ?? [];
  const victory = attempts.find((attempt: any) => attempt.status === 'won') ?? null;

  return {
    qualification_snapshot: qualification.data ?? null,
    resource_balance: snapshotBalance(resources.data),
    resource_version: Number(resources.data?.version ?? 0),
    latest_ledger: latestLedger.data ?? null,
    portal_repaired: Boolean(portalRepair.data),
    diamond_pickaxe_crafted: Boolean(diamondPickaxe.data),
    final_boss_outcome: {
      has_started_attempt: attempts.length > 0,
      latest_attempt: attempts[0] ?? null,
      victory,
    },
    unresolved_adjustments: adjustments.data ?? [],
  };
}

export async function createReconciliation(params: {
  teamId: string;
  state: 'completed' | 'blocked';
  discrepancies: unknown[];
  operatorNotes: string;
  adminId: string;
  idempotencyKey: string;
}) {
  const evidence = await gatherReconciliationEvidence(params.teamId);

  const { data: existing, error: existingError } = await db
    .from('day2_reconciliations')
    .select('*')
    .eq('team_id', params.teamId)
    .eq('idempotency_key', params.idempotencyKey)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return { ok: true as const, data: { ...existing, idempotent: true } };

  const { data, error } = await db
    .from('day2_reconciliations')
    .insert({
      team_id: params.teamId,
      state: params.state,
      qualification_snapshot: evidence.qualification_snapshot ?? {},
      resource_balance: evidence.resource_balance,
      resource_version: evidence.resource_version,
      latest_ledger_id: evidence.latest_ledger?.id ?? null,
      portal_repaired: evidence.portal_repaired,
      diamond_pickaxe_crafted: evidence.diamond_pickaxe_crafted,
      final_boss_outcome: evidence.final_boss_outcome,
      unresolved_adjustments: evidence.unresolved_adjustments,
      discrepancies: params.discrepancies,
      operator_notes: params.operatorNotes,
      reconciled_by: params.adminId,
      idempotency_key: params.idempotencyKey,
    })
    .select()
    .single();

  if (error) throw error;
  return { ok: true as const, data: { ...data, idempotent: false } };
}

export async function listReconciliations(teamId?: string | null) {
  let query = db
    .from('day2_reconciliations')
    .select('id, team_id, state, portal_repaired, diamond_pickaxe_crafted, reconciled_by, reconciled_at, operator_notes')
    .order('reconciled_at', { ascending: false })
    .limit(100);

  if (teamId) query = query.eq('team_id', teamId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

