import { supabaseServer } from '@/lib/supabase/server';

/**
 * The typed client, not the `as any` escape hatch the older gameplay modules
 * use. Every table read here is in `types/supabase.ts`, so there is nothing to
 * cast around.
 */
const db = supabaseServer;

/**
 * The chain of gates between qualifying and playing a round.
 *
 *   screening shortlist  →  RSVP confirmed  →  attendance marked  →  round entry
 *
 * Each one is a different question and they are deliberately not collapsed:
 *
 *  - the **shortlist** says the team earned a seat;
 *  - the **RSVP** says it intends to use it, which is what opens the dashboard
 *    so a team can see its inventory and its rounds the night before;
 *  - **attendance** says it is physically in the room, which is the only one
 *    that can open a round. A team that confirmed and then did not turn up must
 *    not be able to play from home.
 *
 * Day 2 swaps the first gate: the day-1 shortlist is replaced by the day-2 one,
 * because surviving day 1 is what earns a day-2 seat. Everything downstream is
 * the same.
 */

/** Rounds 4 and 5 are day 2; everything below is day 1. */
export const DAY_TWO_ROUNDS = [4, 5];

export function roundDay(roundId: number): 1 | 2 {
  return DAY_TWO_ROUNDS.includes(roundId) ? 2 : 1;
}

export interface Checkpoint {
  id: number;
  code: string;
  label: string;
  day: number;
  covers_rounds: number[];
}

/**
 * The checkpoint that admits a team to a round.
 *
 * Read from the table rather than hardcoded, because the desks are the thing
 * that decides this: one desk covers Rounds 1 and 2 together, so a team marked
 * once in the morning is admitted to both and is not asked again before Round
 * 2. Round 3 has its own desk after the break, and each day-2 round has one.
 */
export async function checkpointForRound(roundId: number): Promise<Checkpoint | null> {
  const { data } = await db
    .from('attendance_checkpoints')
    .select('id, code, label, day, covers_rounds')
    .contains('covers_rounds', [roundId])
    .order('sequence', { ascending: true })
    .limit(1)
    .maybeSingle();

  return (data as Checkpoint | null) ?? null;
}

export interface AttendanceGate {
  ok: boolean;
  /** Null when no checkpoint claims this round — a configuration gap, not a team's fault. */
  checkpoint: Checkpoint | null;
  reason?: 'NO_CHECKPOINT' | 'NOT_MARKED';
}

/**
 * Whether a team has been marked present for the desk that covers this round.
 *
 * A missing checkpoint returns `ok` rather than refusing. If nobody has
 * configured a desk for a round, the failure is ours, and locking every team
 * out of a round that is about to start is the worse of the two mistakes —
 * the round's own lock and the team's `team_round_access` row still apply.
 */
export async function attendanceGate(teamId: string, roundId: number): Promise<AttendanceGate> {
  const checkpoint = await checkpointForRound(roundId);
  if (!checkpoint) {
    console.warn(`[attendance] no checkpoint covers round ${roundId} — gate skipped`);
    return { ok: true, checkpoint: null, reason: 'NO_CHECKPOINT' };
  }

  const { count } = await db
    .from('attendance_records')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .eq('checkpoint_id', checkpoint.id);

  return (count ?? 0) > 0
    ? { ok: true, checkpoint }
    : { ok: false, checkpoint, reason: 'NOT_MARKED' };
}

export interface Entitlement {
  ok: boolean;
  reason?: 'NOT_SHORTLISTED' | 'NO_RSVP' | 'NOT_DAY2';
  message?: string;
}

const OK: Entitlement = { ok: true };

/**
 * Whether a team is entitled to be marked present at all, on a given day.
 *
 * Day 1 asks the screening shortlist and the RSVP. Day 2 asks the day-2
 * shortlist instead — a team can have RSVP'd for day 1, played it, and still
 * not have made the cut for day 2.
 *
 * Checked at the desk rather than only at round entry so a volunteer is told
 * "this team is not on the list" while the team is standing in front of them,
 * instead of the team discovering it when a round will not open.
 */
export async function markingEntitlement(teamId: string, day: number): Promise<Entitlement> {
  if (day >= 2) {
    const { data: state } = await db
      .from('team_game_state')
      .select('qualified_for_day2')
      .eq('team_id', teamId)
      .maybeSingle();

    return state?.qualified_for_day2
      ? OK
      : { ok: false, reason: 'NOT_DAY2', message: 'This team did not qualify for day 2.' };
  }

  const { data: row } = await db
    .from('screening_shortlist')
    .select('result, rsvp_confirmed_at')
    .eq('team_id', teamId)
    .maybeSingle();

  // No frozen shortlist at all means the screening is not in play — a rehearsal,
  // or an event run without one. Refusing every team then would be wrong.
  const { count: shortlistSize } = await db
    .from('screening_shortlist')
    .select('team_id', { count: 'exact', head: true });
  if ((shortlistSize ?? 0) === 0) return OK;

  if (!row || row.result !== 'shortlisted') {
    return { ok: false, reason: 'NOT_SHORTLISTED', message: 'This team is not on the shortlist.' };
  }
  if (!row.rsvp_confirmed_at) {
    return {
      ok: false,
      reason: 'NO_RSVP',
      message: 'This team never confirmed its RSVP. An organizer can mark it from the screening console.',
    };
  }

  return OK;
}

/**
 * Whether a team may open the dashboard.
 *
 * The RSVP, not attendance: the dashboard is where a team reads its resources,
 * its rounds and its team code, and it needs that the night before as much as
 * on the day. Nothing on it can be played, so there is nothing to protect by
 * demanding the team be in the room.
 */
export async function dashboardEntitlement(teamId: string): Promise<Entitlement> {
  const { count: shortlistSize } = await db
    .from('screening_shortlist')
    .select('team_id', { count: 'exact', head: true });
  if ((shortlistSize ?? 0) === 0) return OK;

  const { data: row } = await db
    .from('screening_shortlist')
    .select('result, rsvp_confirmed_at')
    .eq('team_id', teamId)
    .maybeSingle();

  if (!row || row.result !== 'shortlisted') {
    return { ok: false, reason: 'NOT_SHORTLISTED', message: 'Your team did not clear the screening round.' };
  }
  if (!row.rsvp_confirmed_at) {
    return {
      ok: false,
      reason: 'NO_RSVP',
      message: 'We have not received your RSVP yet. Fill the form, or find an organizer at the desk.',
    };
  }

  return OK;
}
