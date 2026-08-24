import { supabaseServer } from '@/lib/supabase/server';
import { getActiveModifiers } from '@/lib/gameplay/events/service';

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

const RESOURCE_COLUMNS = 'team_id, wood, stone, iron, gold, diamond, emerald, obsidian, version, updated_at';

export async function getTeamResources(teamId: string) {
  /**
   * Read first, create only if the row is genuinely missing.
   *
   * This used to call `ensureTeamResources` unconditionally, so every read of a
   * team's balance also wrote to `resources`. The round shell polls this every
   * 25 seconds per team, which on event day came to 28,824 POSTs in eleven
   * hours — about half of every write the platform made, all of them
   * `INSERT ... ON CONFLICT DO NOTHING` against a row that already existed.
   *
   * A row that does not exist is created exactly once, on the team's first
   * read, and never again. Reads are cheap on a database that fits in memory;
   * writes are what spend the Disk IO budget.
   */
  let { data, error } = await db
    .from('resources')
    .select(RESOURCE_COLUMNS)
    .eq('team_id', teamId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    await ensureTeamResources(teamId);
    ({ data, error } = await db
      .from('resources')
      .select(RESOURCE_COLUMNS)
      .eq('team_id', teamId)
      .single());
    if (error) throw error;
  }

  const { count, error: pendingError } = await db
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .in('status', ['submitted', 'manual_review']);

  if (pendingError && pendingError.code !== '42P01') throw pendingError;

  const activeModifiers = await getActiveModifiers(teamId);

  return {
    balance: toBalance(data),
    version: data.version,
    updated_at: data.updated_at,
    server_time: new Date().toISOString(),
    active_modifiers: activeModifiers,
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