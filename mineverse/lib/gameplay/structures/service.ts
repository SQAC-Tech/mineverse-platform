import { supabaseServer } from '@/lib/supabase/server';
import { mutateTeamResource, ResourceDelta } from '@/lib/gameplay/marketplace/resource-client';

import { Dev3Structure, Dev3StructureRepair } from '@/lib/gameplay/types';

export type StructureType = 'bat_cave' | 'forge' | 'bastion' | 'tnt_storage';

export interface StructureConfig {
  type: StructureType;
  round_id: number;
  upgradeCost: { wood?: number; stone?: number; iron?: number; gold?: number };
  repairCost: { wood?: number; stone?: number; iron?: number; gold?: number };
}

export const STRUCTURES: Record<StructureType, StructureConfig> = {
  bat_cave: {
    type: 'bat_cave',
    round_id: 2,
    upgradeCost: { stone: 20, iron: 5 },
    repairCost: { stone: 8 }, // e.g. Creeper explosion repair
  },
  forge: {
    type: 'forge',
    round_id: 2,
    upgradeCost: { iron: 15 },
    repairCost: { stone: 10 },
  },
  bastion: {
    type: 'bastion',
    round_id: 3,
    upgradeCost: { gold: 15, iron: 10 },
    repairCost: { iron: 10, gold: 5 },
  },
  tnt_storage: {
    type: 'tnt_storage',
    round_id: 3,
    upgradeCost: { iron: 20, gold: 10 },
    repairCost: { wood: 15, stone: 15 },
  }
};

export async function getTeamStructure(teamId: string, roundId: number) {
  const { data, error } = await supabaseServer
    .from('structures')
    .select('*')
    .eq('team_id', teamId)
    .eq('round_id', roundId)
    .neq('state', 'consumed')
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return (data as unknown as Dev3Structure) || null;
}

export async function getTeamStructures(teamId: string) {
  const { data, error } = await supabaseServer
    .from('structures')
    .select('*')
    .eq('team_id', teamId);
    
  if (error) throw error;
  return data || [];
}

export async function buildStructure(teamId: string, roundId: number, type: StructureType) {
  const config = STRUCTURES[type];
  if (!config || config.round_id !== roundId) {
    return { success: false, error: 'INVALID_STRUCTURE', message: 'Invalid structure for this round.' };
  }

  const { data, error } = await supabaseServer
    .from('structures')
    .insert({
      team_id: teamId,
      round_id: roundId,
      type: type,
      state: 'active'
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') { // Unique constraint violation
      return { success: false, error: 'ALREADY_BUILT', message: 'You have already built a structure this round.' };
    }
    throw error;
  }

  return { success: true, data };
}

export async function upgradeStructure(teamId: string, type: StructureType, idempotencyKey: string) {
  const config = STRUCTURES[type];
  if (!config) return { success: false, error: 'INVALID_STRUCTURE', message: 'Invalid structure.' };

  const structures = await getTeamStructures(teamId);
  const structure = structures.find(s => s.type === type);

  if (!structure) {
    return { success: false, error: 'NOT_FOUND', message: 'Structure not built.' };
  }

  if (structure.state === 'upgraded') {
    return { success: false, error: 'ALREADY_UPGRADED', message: 'Structure is already upgraded.' };
  }

  // Deduct resources
  const res = await mutateTeamResource({
    teamId,
    delta: config.upgradeCost,
    sourceType: 'structure_upgrade',
    sourceId: structure.id,
    idempotencyKey,
    reason: `Upgraded ${type}`
  });

  if (!res.success) {
    return res;
  }

  const { data, error } = await supabaseServer
    .from('structures')
    .update({ state: 'upgraded', updated_at: new Date().toISOString() })
    .eq('id', structure.id)
    .select()
    .single();

  if (error) throw error;
  return { success: true, data };
}

export async function repairStructure(teamId: string, type: StructureType, idempotencyKey: string) {
  const config = STRUCTURES[type];
  if (!config) return { success: false, error: 'INVALID_STRUCTURE', message: 'Invalid structure.' };

  const structures = await getTeamStructures(teamId);
  const structure = structures.find(s => s.type === type);

  if (!structure) {
    return { success: false, error: 'NOT_FOUND', message: 'Structure not built.' };
  }

  if (structure.state !== 'damaged') {
    return { success: false, error: 'NOT_DAMAGED', message: 'Structure is not damaged.' };
  }

  // Deduct resources
  const res = await mutateTeamResource({
    teamId,
    delta: config.repairCost,
    sourceType: 'structure_repair',
    sourceId: structure.id,
    idempotencyKey,
    reason: `Repaired ${type}`
  });

  if (!res.success) {
    return res;
  }

  // Find if it was upgraded previously (ideally from upgrade_lineage or similar, but simplified here)
  const isUpgraded = structure.upgrade_lineage && structure.upgrade_lineage.length > 0;
  
  const { data, error } = await supabaseServer
    .from('structures')
    .update({ state: isUpgraded ? 'upgraded' : 'repaired', updated_at: new Date().toISOString() })
    .eq('id', structure.id)
    .select()
    .single();

  if (error) throw error;
  return { success: true, data };
}

export async function useTntStorage(teamId: string, idempotencyKey: string) {
  const structures = await getTeamStructures(teamId);
  const tnt = structures.find(s => s.type === 'tnt_storage');

  if (!tnt) {
    return { success: false, error: 'NOT_FOUND', message: 'TNT Storage not built.' };
  }

  if (tnt.state === 'damaged' || tnt.state === 'consumed') {
    return { success: false, error: 'UNAVAILABLE', message: 'TNT Storage is damaged or already consumed.' };
  }

  // TNT storage logic: skip a question. For Phase 2 Dev 3, we just mark it consumed.
  // The Dev 4 logic for skipping a question would use this state.
  
  const { data, error } = await supabaseServer
    .from('structures')
    .update({ state: 'consumed', updated_at: new Date().toISOString() })
    .eq('id', tnt.id)
    .select()
    .single();

  if (error) throw error;
  return { success: true, data };
}
