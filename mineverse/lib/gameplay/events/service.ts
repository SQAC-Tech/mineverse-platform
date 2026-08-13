import { supabaseServer } from '@/lib/supabase/server';
import { WORLD_EVENTS, WorldEventKey, WorldEventConfig } from '@/lib/gameplay/events/catalog';

const db = supabaseServer as any;

export interface ActiveModifier {
  event_key: string;
  label: string;
  modifier: Record<string, number>;
  expires_at: string | null;
}

/**
 * Modifiers currently in force for a team. Used both by the team resources read
 * model and by grading, so a question award and the UI agree on what is active.
 */
export async function getActiveModifiers(teamId: string): Promise<ActiveModifier[]> {
  const nowIso = new Date().toISOString();

  const { data, error } = await db
    .from('team_event_effects')
    .select('modifier, expires_at, world_events!inner(event_key, status)')
    .eq('team_id', teamId)
    .eq('world_events.status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }

  return (data ?? [])
    .filter((row: any) => row.modifier && Object.keys(row.modifier).length > 0)
    .map((row: any) => {
      const key = row.world_events?.event_key as WorldEventKey;
      return {
        event_key: key,
        label: WORLD_EVENTS[key]?.label ?? key,
        modifier: row.modifier,
        expires_at: row.expires_at,
      };
    });
}

/**
 * Multiplies a question reward by every active modifier. Rounding is floor, so a
 * modifier can never invent a fractional resource.
 */
export function applyModifiers(
  reward: Record<string, number>,
  modifiers: ActiveModifier[],
): Record<string, number> {
  const result: Record<string, number> = { ...reward };

  for (const active of modifiers) {
    for (const [key, multiplier] of Object.entries(active.modifier)) {
      if (typeof result[key] === 'number') {
        result[key] = Math.floor(result[key] * multiplier);
      }
    }
  }

  return result;
}

async function eligibleTeamIds(scope: 'all' | 'targeted', targetTeamIds: string[]) {
  if (scope === 'targeted') return targetTeamIds;

  const { data, error } = await db
    .from('teams')
    .select('id')
    .eq('is_payment_verified', true)
    .eq('status', 'active');

  if (error) throw error;
  return (data ?? []).map((team: { id: string }) => team.id);
}

export interface TriggerWorldEventParams {
  eventKey: WorldEventKey;
  roundId: number;
  adminId: string;
  scope?: 'all' | 'targeted';
  targetTeamIds?: string[];
}

/**
 * Triggers a canonical world event and writes one expiring effect row per
 * eligible team. Every event is a reward modifier, so nothing here moves a
 * balance — the multiplier is applied when a question is graded.
 */
export async function triggerWorldEvent(params: TriggerWorldEventParams) {
  const config: WorldEventConfig | undefined = WORLD_EVENTS[params.eventKey];
  if (!config) {
    return { success: false as const, error: 'INVALID_EVENT', message: 'Unknown world event key.' };
  }

  if (config.round_id !== params.roundId) {
    return {
      success: false as const,
      error: 'WRONG_ROUND',
      message: `${config.label} belongs to round ${config.round_id}.`,
    };
  }

  const { data: round, error: roundError } = await db
    .from('rounds')
    .select('id, status')
    .eq('id', params.roundId)
    .single();

  if (roundError) throw roundError;
  if (round.status !== 'active') {
    return { success: false as const, error: 'ROUND_NOT_ACTIVE', message: 'Round is not active.' };
  }

  const scope = params.scope ?? 'all';
  const targets = await eligibleTeamIds(scope, params.targetTeamIds ?? []);

  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + config.durationSeconds * 1000);

  const { data: event, error: eventError } = await db
    .from('world_events')
    .insert({
      event_key: config.key,
      round_id: params.roundId,
      scope,
      target_team_ids: scope === 'targeted' ? targets : [],
      effect: {
        kind: config.kind,
        modifier: config.modifier,
      },
      status: 'active',
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      triggered_by: params.adminId,
    })
    .select()
    .single();

  if (eventError) {
    if (eventError.code === '23505') {
      return {
        success: false as const,
        error: 'ALREADY_ACTIVE',
        message: `${config.label} is already active for this round.`,
      };
    }
    throw eventError;
  }

  for (const teamId of targets) {
    // The unique (event, team) index makes a retried trigger inert rather than
    // handing a team the modifier twice.
    const { error: effectError } = await db.from('team_event_effects').insert({
      world_event_id: event.id,
      team_id: teamId,
      modifier: config.modifier,
      resolution: 'applied',
      ledger_id: null,
      expires_at: endsAt.toISOString(),
    });

    if (effectError && effectError.code !== '23505') throw effectError;
  }

  return {
    success: true as const,
    data: {
      event_id: event.id,
      event_key: config.key,
      label: config.label,
      announcement: config.announcement,
      scope,
      affected_teams: targets.length,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
    },
  };
}

export async function expireWorldEvent(eventId: string) {
  const { data, error } = await db
    .from('world_events')
    .update({ status: 'expired', ends_at: new Date().toISOString() })
    .eq('id', eventId)
    .eq('status', 'active')
    .select()
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  if (!data) {
    return { success: false as const, error: 'NOT_ACTIVE', message: 'No active event with that id.' };
  }

  return { success: true as const, data };
}

export async function listWorldEvents(roundId?: number) {
  let query = db
    .from('world_events')
    .select('id, event_key, round_id, scope, status, starts_at, ends_at, triggered_by, effect')
    .order('starts_at', { ascending: false })
    .limit(50);

  if (roundId) query = query.eq('round_id', roundId);

  const { data, error } = await query;
  if (error) throw error;

  const now = Date.now();
  return (data ?? []).map((event: any) => ({
    ...event,
    label: WORLD_EVENTS[event.event_key as WorldEventKey]?.label ?? event.event_key,
    is_expired:
      event.status !== 'active' || (event.ends_at ? new Date(event.ends_at).getTime() <= now : false),
  }));
}
