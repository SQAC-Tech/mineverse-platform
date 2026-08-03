import { supabaseServer } from '@/lib/supabase/server';
import { mutateTeamResource, ResourceDelta } from '@/lib/gameplay/marketplace/resource-client';
import { GUARDIANS, GuardianName } from '@/lib/gameplay/guardians/service';
import { getHintApproach } from '@/lib/gameplay/marketplace/hints';
import { isConsumableItem } from '@/lib/gameplay/marketplace/service';
import { Dev3Transaction, Dev3ItemUse, Dev3GuardianBattle } from '@/lib/gameplay/types';

export interface UseMarketplaceItemParams {
  teamId: string;
  transactionId: string;
  questionId?: string;
  idempotencyKey: string;
}

export type UseItemResult =
  | { success: true; data: Dev3ItemUse & { approach?: string } }
  | { success: false; error: string; message?: string };

async function findItemUse(transactionId: string): Promise<Dev3ItemUse | null> {
  const { data, error } = await supabaseServer
    .from('item_uses')
    .select('*')
    .eq('transaction_id', transactionId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return (data as unknown as Dev3ItemUse) || null;
}

async function findLastLostBattle(teamId: string): Promise<Dev3GuardianBattle | null> {
  const { data, error } = await supabaseServer
    .from('guardian_battles')
    .select('*')
    .eq('team_id', teamId)
    .eq('status', 'lost')
    .not('penalty_ledger_id', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return (data as unknown as Dev3GuardianBattle) || null;
}

export async function applyMarketplaceItem({
  teamId,
  transactionId,
  questionId,
  idempotencyKey,
}: UseMarketplaceItemParams): Promise<UseItemResult> {
  const { data: txData, error: txError } = await supabaseServer
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .eq('team_id', teamId)
    .single();

  if (txError || !txData) {
    return { success: false, error: 'TRANSACTION_NOT_FOUND', message: 'Transaction not found.' };
  }

  const tx = txData as unknown as Dev3Transaction;

  if (!isConsumableItem(tx.item_type)) {
    return { success: false, error: 'NOT_CONSUMABLE', message: 'This item cannot be used.' };
  }

  const existingUse = await findItemUse(transactionId);
  if (existingUse) {
    return { success: false, error: 'ALREADY_USED', message: 'This purchase has already been used.' };
  }

  switch (tx.item_type) {
    case 'revival_potion':
      return applyRevivalPotion(teamId, transactionId, idempotencyKey);
    case 'hint':
      return applyHint(teamId, transactionId, questionId);
    default:
      // Buff items (totem / retry token / strength potion) are activated here and are
      // consumed by the guardian flow when their documented effect actually applies:
      // totem on a prevented defeat, retry token on a bypassed cooldown, strength on a won battle.
      return activateBuffItem(teamId, transactionId, tx.item_type);
  }
}

async function activateBuffItem(
  teamId: string,
  transactionId: string,
  itemType: string,
): Promise<UseItemResult> {
  const { data, error } = await supabaseServer
    .from('item_uses')
    .insert({
      team_id: teamId,
      transaction_id: transactionId,
      item_type: itemType,
      consumed_at: null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'ALREADY_USED', message: 'This purchase has already been used.' };
    }
    throw error;
  }

  return { success: true, data: data as unknown as Dev3ItemUse };
}

async function applyRevivalPotion(
  teamId: string,
  transactionId: string,
  idempotencyKey: string,
): Promise<UseItemResult> {
  const lastBattle = await findLastLostBattle(teamId);
  if (!lastBattle) {
    return {
      success: false,
      error: 'NO_PENALTY_TO_REVIVE',
      message: 'There is no previous lost guardian battle to revive from.',
    };
  }

  const guardian = GUARDIANS[lastBattle.guardian_name as GuardianName];
  if (!guardian) {
    return { success: false, error: 'SERVER_ERROR', message: 'Guardian configuration not found.' };
  }

  // Event brief: "Recover 50% of resources lost in the previous guardian battle".
  // The brief does not specify rounding, so a conservative floor is used per resource.
  const refund: ResourceDelta = {};
  for (const [key, value] of Object.entries(guardian.defeatPenalty)) {
    refund[key as keyof ResourceDelta] = Math.floor(Math.abs(value as number) / 2);
  }

  const now = new Date().toISOString();
  const { data: useData, error: useError } = await supabaseServer
    .from('item_uses')
    .insert({
      team_id: teamId,
      transaction_id: transactionId,
      item_type: 'revival_potion',
      consumed_at: now,
    })
    .select()
    .single();

  if (useError) {
    if (useError.code === '23505') {
      return { success: false, error: 'ALREADY_USED', message: 'This purchase has already been used.' };
    }
    throw useError;
  }

  const res = await mutateTeamResource({
    teamId,
    delta: refund,
    sourceType: 'revival_potion',
    sourceId: transactionId,
    idempotencyKey,
    reason: `Used Revival Potion after losing to ${lastBattle.guardian_name}`,
  });

  if (!res.success) {
    // Roll back the recorded use so the purchase can be attempted again.
    await supabaseServer.from('item_uses').delete().eq('id', useData.id);
    return { success: false, error: res.error ?? 'SERVER_ERROR', message: res.message };
  }

  return { success: true, data: useData as unknown as Dev3ItemUse };
}

async function applyHint(teamId: string, transactionId: string, questionId?: string): Promise<UseItemResult> {
  if (!questionId) {
    return { success: false, error: 'QUESTION_REQUIRED', message: 'A question_id is required to use a hint.' };
  }

  const hint = await getHintApproach(questionId);
  if (!hint.success) {
    // The hint is not consumed when no provider is available.
    return { success: false, error: hint.code, message: hint.message };
  }

  const { data, error } = await supabaseServer
    .from('item_uses')
    .insert({
      team_id: teamId,
      transaction_id: transactionId,
      item_type: 'hint',
      question_id: questionId,
      consumed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'ALREADY_USED', message: 'This purchase has already been used.' };
    }
    throw error;
  }

  const itemUse = data as unknown as Dev3ItemUse;
  return { success: true, data: { ...itemUse, approach: hint.approach } };
}
