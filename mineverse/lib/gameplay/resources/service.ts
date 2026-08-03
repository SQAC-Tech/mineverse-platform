import { supabaseServer } from '@/lib/supabase/server';

const db = supabaseServer as any;

export const resourceKeys = ['wood', 'stone', 'iron', 'gold', 'diamond', 'emerald', 'obsidian'] as const;
export type ResourceKey = (typeof resourceKeys)[number];
export type ResourceBalance = Record<ResourceKey, number>;
export type ResourceDelta = Partial<ResourceBalance>;

export interface ResourceProjection extends ResourceBalance {
  team_id: string;
  version: number;
  updated_at: string;
}

export function emptyBalance(): ResourceBalance {
  return { wood: 0, stone: 0, iron: 0, gold: 0, diamond: 0, emerald: 0, obsidian: 0 };
}

export function toBalance(row: Partial<ResourceProjection> | null | undefined): ResourceBalance {
  const base = emptyBalance();
  for (const key of resourceKeys) base[key] = Number(row?.[key] ?? 0);
  return base;
}

export async function ensureTeamResources(teamId: string) {
  await db.from('resources').upsert({ team_id: teamId }, { onConflict: 'team_id', ignoreDuplicates: true });
}

export async function getTeamResources(teamId: string) {
  await ensureTeamResources(teamId);

  const { data, error } = await db
    .from('resources')
    .select('team_id, wood, stone, iron, gold, diamond, emerald, obsidian, version, updated_at')
    .eq('team_id', teamId)
    .single();

  if (error) throw error;

  const { count, error: pendingError } = await db
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .in('status', ['submitted', 'manual_review']);

  if (pendingError && pendingError.code !== '42P01') throw pendingError;

  return {
    balance: toBalance(data),
    version: data.version,
    updated_at: data.updated_at,
    server_time: new Date().toISOString(),
    active_modifiers: [],
    pending_grading: (count ?? 0) > 0,
  };
}

export async function getResourceHistory(teamId: string, cursor?: string | null, limit = 25) {
  let query = db
    .from('resource_ledger')
    .select('id, delta, balance_after, source_type, source_id, actor_type, reason, created_at')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (cursor) query = query.lt('created_at', cursor);

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];
  const page = rows.slice(0, limit);
  const next = rows.length > limit ? rows[limit].created_at : null;

  return {
    entries: page,
    next_cursor: next,
    server_time: new Date().toISOString(),
  };
}