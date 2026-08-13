import { supabaseServer } from '@/lib/supabase/server';
import { DAY2_EVENTS, type Day2EventKey } from '@/lib/day2/events/catalog';
import type { Day2ResourceDelta } from '@/lib/day2/events/offline';

const db = supabaseServer as any;

export async function triggerDay2Event(params: {
  eventKey: Day2EventKey;
  targetTeamIds: string[];
  adminId: string;
  idempotencyKey: string;
  reason: string;
  notes?: string | null;
}) {
  const config = DAY2_EVENTS[params.eventKey];

  const { data, error } = await db.rpc('dev5_trigger_day2_event', {
    p_event_key: params.eventKey,
    p_target_team_ids: params.targetTeamIds,
    p_admin_id: params.adminId,
    p_idempotency_key: params.idempotencyKey,
    p_reason: params.reason,
    p_notes: params.notes ?? null,
  });

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false as const,
        status: 409,
        code: 'ALREADY_ACTIVE',
        message: `${config.label} is already active or this event was already recorded.`,
      };
    }
    if (error.message?.includes('reason')) {
      return { ok: false as const, status: 400, code: 'REASON_REQUIRED', message: 'A reason is required.' };
    }
    throw error;
  }

  return {
    ok: true as const,
    data: {
      ...(data ?? {}),
      label: config.label,
      announcement: config.announcement,
    },
  };
}

export async function listDay2Events() {
  const { data, error } = await db
    .from('day2_event_instances')
    .select('id, event_key, round_id, scope, target_team_ids, effect, status, starts_at, ends_at, triggered_by, reason, notes')
    .order('starts_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  const now = Date.now();

  return (data ?? []).map((event: any) => ({
    ...event,
    label: DAY2_EVENTS[event.event_key as Day2EventKey]?.label ?? event.event_key,
    is_expired: event.ends_at ? new Date(event.ends_at).getTime() <= now : event.status !== 'active',
  }));
}

export async function getActiveChorusBonus(teamId: string, solvedAt: string | null | undefined) {
  if (!solvedAt) return null;

  const { data, error } = await db
    .from('day2_event_instances')
    .select('id, starts_at, ends_at')
    .eq('event_key', 'chorus_fruit_blessing')
    .eq('status', 'active')
    .or(`scope.eq.all_qualified,target_team_ids.cs.{${teamId}}`)
    .lte('starts_at', solvedAt)
    .gt('ends_at', solvedAt)
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === '42P01') return null;
    throw error;
  }

  return data ? { eventId: data.id as string, bonus: { emerald: 2 } satisfies Day2ResourceDelta } : null;
}

