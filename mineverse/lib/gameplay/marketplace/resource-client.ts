import { supabaseServer } from '@/lib/supabase/server';

export interface ResourceDelta {
  wood?: number;
  stone?: number;
  iron?: number;
  gold?: number;
  diamond?: number;
  emerald?: number;
  obsidian?: number;
}

export interface MutateResourceParams {
  teamId: string;
  delta: ResourceDelta;
  sourceType: string;
  sourceId?: string;
  idempotencyKey: string;
  reason: string;
}

/**
 * Wrapper for Dev 4's RPC to mutate resources and write to the resource_ledger.
 */
export interface MutateResourceResult {
  ledger_id: string;
  balance: Record<string, number>;
  version: number;
  created_at: string;
  idempotent: boolean;
}

export async function mutateTeamResource(params: MutateResourceParams) {
  const { data, error } = await supabaseServer.rpc('mutate_team_resources', {
    p_team_id: params.teamId,
    p_delta: params.delta as never,
    p_source_type: params.sourceType,
    p_source_id: params.sourceId,
    p_idempotency_key: params.idempotencyKey,
    p_reason: params.reason
  });

  if (error) {
    if (error.code === 'P0001' && error.message.includes('idempotency')) {
      return { success: false, error: 'CONFLICT', message: 'Action already performed.' };
    }
    if (error.code === 'P0001' && error.message.includes('insufficient')) {
      return { success: false, error: 'INSUFFICIENT_FUNDS', message: 'Not enough resources.' };
    }
    // 23505 is the PostgreSQL error code for unique_violation, common for idempotency failures
    if (error.code === '23505') {
       return { success: false, error: 'CONFLICT', message: 'Action already performed.' };
    }
    console.error('[mutateTeamResource] RPC error:', error);
    return { success: false, error: 'SERVER_ERROR', message: 'Failed to mutate resources.' };
  }

  const result = data as unknown as MutateResourceResult | null;
  return { success: true, ledgerId: result?.ledger_id, balance: result?.balance };
}
