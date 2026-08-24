import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import {
  EVENT_SEVERITY,
  MAX_EVENTS_PER_BATCH,
  isFlagged,
  proctorRules,
  type ProctorEventKind,
} from './config';

// Rules stay plain data in `./config` so client components can import the
// budgets without dragging the service-role key into the browser bundle.
export { proctorRules, EVENT_SEVERITY, isFlagged } from './config';
export type { ProctorEventKind, ProctorSeverity, ProctorRules } from './config';

const db = supabaseServer as any;

const EVENT_KINDS = Object.keys(EVENT_SEVERITY) as [ProctorEventKind, ...ProctorEventKind[]];

export const openSessionSchema = z.object({
  // 0 is the screening qualifier, which is proctored like a round.
  round_id: z.number().int().min(0).max(5),
  device_id: z.string().min(8).max(64),
  capabilities: z.record(z.string(), z.boolean()).optional(),
});

export const eventBatchSchema = z.object({
  session_id: z.string().uuid(),
  events: z
    .array(
      z.object({
        kind: z.enum(EVENT_KINDS),
        // Free-form context (which key, how long out of fullscreen). Bounded so a
        // scripted client cannot use the log as unbounded storage.
        detail: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
      }),
    )
    .min(1)
    .max(MAX_EVENTS_PER_BATCH),
});

export type OpenSessionInput = z.infer<typeof openSessionSchema>;
export type EventBatchInput = z.infer<typeof eventBatchSchema>;

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string; message?: string };

export interface ProctorSessionRow {
  id: string;
  team_id: string;
  round_id: number;
  device_id: string;
  status: 'active' | 'flagged' | 'ended';
  warning_count: number;
  key_violation_count: number;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
}

/**
 * Opens the session for this browser, or re-attaches to it after a reload.
 *
 * `team_id` is supplied by the caller from the verified session cookie and is
 * never read from the request body — that is the whole difference from the
 * reference implementation, where the count that decides an accusation was
 * under the accused party's control.
 */
export async function openProctorSession(
  teamId: string,
  input: OpenSessionInput,
  userAgent: string | null,
): Promise<ServiceResult<ProctorSessionRow>> {
  const { data, error } = await db
    .from('proctor_sessions')
    .upsert(
      {
        team_id: teamId,
        round_id: input.round_id,
        device_id: input.device_id,
        user_agent: userAgent?.slice(0, 400) ?? null,
        capabilities: input.capabilities ?? {},
        last_seen_at: new Date().toISOString(),
        // A reload re-opens the same row. Counters are deliberately untouched:
        // refreshing the page must not wipe what already happened.
        ended_at: null,
      },
      { onConflict: 'team_id,round_id,device_id' },
    )
    .select('id, team_id, round_id, device_id, status, warning_count, key_violation_count, started_at, last_seen_at, ended_at')
    .single();

  if (error || !data) {
    console.error('Proctor session open failed:', error);
    return { ok: false, status: 500, code: 'SESSION_OPEN_FAILED' };
  }

  // Re-opening an ended session puts it back in play, but a flag survives —
  // an organizer clears that, not a page refresh.
  if (data.status === 'ended') {
    await db.from('proctor_sessions').update({ status: 'active' }).eq('id', data.id);
    data.status = 'active';
  }

  return { ok: true, data: data as ProctorSessionRow };
}

/**
 * Appends a batch of events and recomputes the session's counters.
 *
 * Counters are recomputed from `proctor_events` rather than incremented, so two
 * batches landing at once cannot lose an update, and the denormalised columns
 * can never drift from the table they summarise.
 */
export async function recordProctorEvents(
  teamId: string,
  input: EventBatchInput,
): Promise<ServiceResult<{ warning_count: number; key_violation_count: number; status: string }>> {
  const { data: session, error: sessionError } = await db
    .from('proctor_sessions')
    .select('id, team_id, round_id, status')
    .eq('id', input.session_id)
    .single();

  if (sessionError || !session) {
    return { ok: false, status: 404, code: 'SESSION_NOT_FOUND' };
  }

  // A session id is a uuid the client holds, so it has to be checked against the
  // cookie's team before anything is written under it.
  if (session.team_id !== teamId) {
    return { ok: false, status: 403, code: 'SESSION_NOT_YOURS' };
  }

  const rows = input.events.map((event) => ({
    session_id: session.id,
    team_id: teamId,
    round_id: session.round_id,
    kind: event.kind,
    // Severity is looked up server-side. The client says what happened, never
    // how much it costs.
    severity: EVENT_SEVERITY[event.kind],
    detail: event.detail ?? {},
    // `occurred_at` is left to the column default — the server clock.
  }));

  const { error: insertError } = await db.from('proctor_events').insert(rows);
  if (insertError) {
    console.error('Proctor event insert failed:', insertError);
    return { ok: false, status: 500, code: 'EVENT_WRITE_FAILED' };
  }

  return recountSession(session.id, teamId, session.round_id, session.status);
}

async function recountSession(
  sessionId: string,
  teamId: string,
  roundId: number,
  currentStatus: string,
): Promise<ServiceResult<{ warning_count: number; key_violation_count: number; status: string }>> {
  /**
   * One read of the two severities, not one read each.
   *
   * These were two `count: 'exact', head: true` queries, and this function runs
   * on every batch of proctor events a team's browser posts — which is what put
   * 18,132 HEAD requests against `proctor_events` in a day next to 9,838 writes.
   * Two counts per write, exactly.
   *
   * Fetching the severities and tallying them here is one request instead of
   * two, and it is not the trade it looks like: the rows are filtered on the
   * indexed `session_id`, a session holds tens of events rather than thousands,
   * and the column is a short string. We were already paying to visit the same
   * rows twice to have Postgres count them.
   */
  const { data: severities } = await db
    .from('proctor_events')
    .select('severity')
    .eq('session_id', sessionId)
    .in('severity', ['warning', 'key_violation']);

  let warning_count = 0;
  let key_violation_count = 0;
  for (const row of (severities ?? []) as Array<{ severity: string }>) {
    if (row.severity === 'warning') warning_count += 1;
    else if (row.severity === 'key_violation') key_violation_count += 1;
  }
  const rules = proctorRules(roundId);

  const flagged = isFlagged({ warning_count, key_violation_count }, rules);
  // Only ever escalates here. Clearing a flag is an organizer's decision.
  const status = currentStatus === 'ended' ? 'ended' : flagged ? 'flagged' : currentStatus;

  // Crossing a budget takes the round away until a human looks at it.
  //
  // Note what this is and is not. `autoSubmitOnExhaustion` is off everywhere and
  // deliberately so — sealing the work is irreversible. This is reversible: the
  // team keeps every answer it has saved, and `clearProctorFlag` hands the round
  // straight back. That is the whole reason the two have to move together, and
  // they did not: clearing the flag reset the session and left `is_locked` set,
  // so the console said "cleared" while the team still could not open the round
  // and the only way back was re-toggling it for everybody.
  if (flagged && currentStatus !== 'flagged' && currentStatus !== 'ended') {
    await db.from('team_round_access').update({ is_locked: true }).eq('team_id', teamId).eq('round_id', roundId);
  }

  const { error } = await db
    .from('proctor_sessions')
    .update({ warning_count, key_violation_count, status, last_seen_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (error) {
    console.error('Proctor session recount failed:', error);
    return { ok: false, status: 500, code: 'SESSION_UPDATE_FAILED' };
  }

  return { ok: true, data: { warning_count, key_violation_count, status } };
}

export async function touchProctorSession(teamId: string, sessionId: string): Promise<void> {
  await db
    .from('proctor_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('team_id', teamId);
}

export async function endProctorSession(teamId: string, sessionId: string): Promise<void> {
  await db
    .from('proctor_sessions')
    .update({ ended_at: new Date().toISOString(), status: 'ended' })
    .eq('id', sessionId)
    .eq('team_id', teamId)
    // A flagged session keeps its flag through a clean exit.
    .neq('status', 'flagged');
}

/* ------------------------------------------------------------------ admin */

export interface ProctorFeedRow extends ProctorSessionRow {
  team_code: string | null;
  team_name: string | null;
  user_agent: string | null;
  capabilities: Record<string, boolean>;
  recent: Array<{ kind: string; severity: string; detail: Record<string, unknown>; occurred_at: string }>;
}

/**
 * The live console feed: one row per device, newest activity first, each with
 * the handful of events that explain its counters.
 */
export async function getProctorFeed(
  options: { roundId?: number; limit?: number } = {},
): Promise<ProctorFeedRow[]> {
  const limit = Math.min(options.limit ?? 100, 200);

  let query = db
    .from('proctor_sessions')
    .select(
      'id, team_id, round_id, device_id, status, warning_count, key_violation_count, started_at, last_seen_at, ended_at, user_agent, capabilities, teams(team_code, team_name)',
    )
    .order('last_seen_at', { ascending: false })
    .limit(limit);

  if (options.roundId) query = query.eq('round_id', options.roundId);

  const { data: sessions, error } = await query;
  if (error || !sessions?.length) {
    if (error) console.error('Proctor feed failed:', error);
    return [];
  }

  // One query for every session's recent events, sliced in memory. Cheaper than
  // a per-row subquery and the volume is small — hundreds of rows, not millions.
  const sessionIds = sessions.map((s: any) => s.id);
  const { data: events } = await db
    .from('proctor_events')
    .select('session_id, kind, severity, detail, occurred_at')
    .in('session_id', sessionIds)
    .neq('kind', 'heartbeat')
    .order('occurred_at', { ascending: false })
    .limit(sessionIds.length * 12);

  const bySession = new Map<string, ProctorFeedRow['recent']>();
  for (const event of events ?? []) {
    const list = bySession.get(event.session_id) ?? [];
    if (list.length < 5) {
      list.push({
        kind: event.kind,
        severity: event.severity,
        detail: event.detail ?? {},
        occurred_at: event.occurred_at,
      });
      bySession.set(event.session_id, list);
    }
  }

  return sessions.map((session: any) => ({
    id: session.id,
    team_id: session.team_id,
    round_id: session.round_id,
    device_id: session.device_id,
    status: session.status,
    warning_count: session.warning_count,
    key_violation_count: session.key_violation_count,
    started_at: session.started_at,
    last_seen_at: session.last_seen_at,
    ended_at: session.ended_at,
    user_agent: session.user_agent,
    capabilities: session.capabilities ?? {},
    team_code: session.teams?.team_code ?? null,
    team_name: session.teams?.team_name ?? null,
    recent: bySession.get(session.id) ?? [],
  }));
}

/** Full event history for one session, for adjudicating a flag. */
export async function getSessionEvents(sessionId: string, limit = 300) {
  const { data } = await db
    .from('proctor_events')
    .select('kind, severity, detail, occurred_at')
    .eq('session_id', sessionId)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** Clears a flag after an organizer has looked at it. */
/**
 * Puts a flagged team back in the round.
 *
 * Undoes both halves of a flag. `recountSession` locks the team out of the round
 * when a budget runs out, so resetting only `proctor_sessions.status` — which is
 * all this did — left the team barred from a round the console had just declared
 * clear. Four stray Escapes is the whole budget, and the only other way back was
 * re-toggling the round, which restarts its clock for all ninety teams.
 *
 * The unlock is scoped to the session's own round, so clearing a Round 2 flag
 * cannot open Round 3 early.
 */
export async function clearProctorFlag(sessionId: string): Promise<boolean> {
  const { data: session } = await db
    .from('proctor_sessions')
    .select('team_id, round_id')
    .eq('id', sessionId)
    .maybeSingle();

  const { error } = await db
    .from('proctor_sessions')
    .update({ status: 'active' })
    .eq('id', sessionId)
    .eq('status', 'flagged');

  if (error) return false;

  if (session) {
    const { error: unlockError } = await db
      .from('team_round_access')
      .update({ is_locked: false })
      .eq('team_id', session.team_id)
      .eq('round_id', session.round_id);

    if (unlockError) {
      console.error('Proctor flag cleared but round stayed locked:', unlockError);
      return false;
    }
  }

  return true;
}
