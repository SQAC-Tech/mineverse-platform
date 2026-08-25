import { supabaseServer } from '@/lib/supabase/server';
import { isDemoTeamId, noteDemoBypass } from '@/lib/gameplay/demo-teams';
import { getCachedCheckpoints, getCachedShortlistSize } from '@/lib/cache/reads';

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
  // Cached and filtered in memory. Four rows, configured before the desks open
  // and not touched again, asked for on every round entry by every team.
  //
  // A failed lookup returns null, which `attendanceGate` reads as "no desk
  // claims this round" and opens. That is the documented behaviour and the
  // reason this does not rethrow.
  let checkpoints: Awaited<ReturnType<typeof getCachedCheckpoints>>;
  try {
    checkpoints = await getCachedCheckpoints();
  } catch (error) {
    console.error(`[gates] checkpoint lookup failed for round ${roundId}:`, error);
    return null;
  }
  const match = checkpoints.find((checkpoint) => checkpoint.covers_rounds?.includes(roundId));
  return match ? { id: match.id, code: match.code, label: match.label, day: match.day, covers_rounds: match.covers_rounds } : null;
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
  // Same reasoning as the dashboard: a demo team has to be markable at the desk
  // for anyone to rehearse the desk.
  if (await isDemoTeamId(teamId)) {
    noteDemoBypass('attendance marking entitlement');
    return OK;
  }

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
  // or an event run without one. Refusing every team then would be wrong, and a
  // failed lookup is read the same way rather than turning the desk away.
  if (await shortlistSizeOrZero() === 0) return OK;

  if (!row || row.result !== 'shortlisted') {
    return { ok: false, reason: 'NOT_SHORTLISTED', message: 'This team is not on the shortlist.' };
  }

  /**
   * The RSVP is recorded here too, never enforced. See `dashboardEntitlement`.
   *
   * This one was the worst place for it. Attendance is what opens a round, and
   * nothing has ever written `rsvp_confirmed_at`, so on event morning the desk
   * would have scanned a team's QR, been told the team never confirmed, and had
   * no way to mark it present — and therefore no way for it to play. A whole
   * hall deadlocked on a column with no writer.
   *
   * A team standing at the desk with its QR has answered the only question the
   * RSVP was asking.
   */
  if (!row.rsvp_confirmed_at) {
    console.warn(`[gates] marking team ${teamId} present without a recorded RSVP`);
  }

  return OK;
}

interface ShortlistRow {
  result: string | null;
  rsvp_confirmed_at: string | null;
}

/**
 * How many teams are on the shortlist, or zero if we cannot tell.
 *
 * One integer, identical for every team, and `dashboardEntitlement` asked the
 * database for it on every dashboard tick — 34,207 HEAD requests in two hours
 * on event day. Cached now, and a failed lookup answers zero, which every
 * caller reads as "no cut has been made" and opens the gate. That is the
 * existing fail-open behaviour, not a new one.
 */
async function shortlistSizeOrZero(): Promise<number> {
  try {
    return await getCachedShortlistSize();
  } catch (error) {
    console.error('[gates] shortlist size lookup failed:', error);
    return 0;
  }
}

/**
 * Whether a team may open the dashboard.
 *
 * The RSVP, not attendance: the dashboard is where a team reads its resources,
 * its rounds and its team code, and it needs that the night before as much as
 * on the day. Nothing on it can be played, so there is nothing to protect by
 * demanding the team be in the room.
 */
export async function dashboardEntitlement(
  teamId: string,
  /**
   * The team's shortlist row, when the caller already has it.
   *
   * `/api/dashboard/data` reads it as part of `dashboard_snapshot`, so passing
   * it here saves the one round trip this function would otherwise make on
   * every tick. `null` is a real answer — the team is not on the shortlist —
   * which is why the parameter is checked against `undefined`, not falsiness.
   */
  preloaded?: ShortlistRow | null,
): Promise<Entitlement> {
  // A demo team exists to walk the event before the teams do. It is not on the
  // shortlist and never will be, so every gate below would refuse it — which is
  // how the organizers' own dashboard came to be as blank as everyone else's.
  if (await isDemoTeamId(teamId)) {
    noteDemoBypass('dashboard entitlement');
    return OK;
  }

  if (await shortlistSizeOrZero() === 0) return OK;

  const row = preloaded !== undefined
    ? preloaded
    : (await db.from('screening_shortlist').select('result, rsvp_confirmed_at').eq('team_id', teamId).maybeSingle()).data;

  if (!row || row.result !== 'shortlisted') {
    return { ok: false, reason: 'NOT_SHORTLISTED', message: 'Your team did not clear the screening round.' };
  }

  /**
   * The RSVP is recorded, not enforced.
   *
   * It used to close the dashboard, on the reasoning that a team which never
   * replied has no seat. That reasoning needed the replies to actually reach the
   * table, and they never did: the RSVP is a Google Form and nothing imports it,
   * so all fifty shortlisted teams sat at `rsvp_confirmed_at is null` and every
   * one of them got a 403 for their own dashboard.
   *
   * Blocking here bought nothing anyway. The shortlist check above is what keeps
   * a team that did not qualify out, and *attendance* — being in the room — is
   * what opens a round. An unconfirmed team that never turns up is stopped at
   * the desk, which is the gate that was always doing the real work.
   */
  if (!row.rsvp_confirmed_at) {
    console.warn(`[gates] team ${teamId} opened the dashboard without a recorded RSVP`);
  }

  return OK;
}

export interface CheckpointOrderGate {
  ok: boolean;
  /** The desk that has to be visited first, when this one is out of order. */
  required?: { id: number; code: string; label: string };
  message?: string;
}

/**
 * The desks are a sequence, and this is what makes them one.
 *
 * A team that never turned up in the morning was walking to the Round 3 desk
 * and being ticked in as though it had been there all day. The round gate only
 * ever asked "is there a record at the desk that covers this round?", so one
 * scan after lunch admitted a team that had played nothing — and, on day 1,
 * that is a team entering the elimination round without having sat the two
 * rounds it eliminates on.
 *
 * So a checkpoint now requires the one before it *on the same day*. Round 3
 * requires Rounds 1 & 2; Day 2's Round 5 desk requires its Round 4 desk. The
 * rule is read from `sequence` rather than written against checkpoint ids,
 * because the desks are configured in the table and a hardcoded id would be
 * wrong the moment one is added.
 *
 * ## The way round it, on purpose
 *
 * There is one, and it is deliberate: mark the team at the earlier desk. A
 * team that genuinely was there but was missed — a scanner that failed, a
 * volunteer who forgot — is fixed by recording the truth about the morning,
 * which is a thing an organiser can see and audit afterwards. What is not
 * possible is waving it through at the later desk, because that leaves no
 * trace that anything was skipped.
 *
 * Fails open. If the lookup breaks mid-event this must not become the reason a
 * hall of teams cannot be marked in — same reasoning as `attendanceGate`.
 */
export async function checkpointOrderGate(
  teamId: string,
  checkpointId: number,
): Promise<CheckpointOrderGate> {
  let checkpoints: Awaited<ReturnType<typeof getCachedCheckpoints>>;
  try {
    checkpoints = await getCachedCheckpoints();
  } catch (error) {
    console.error(`[gates] checkpoint order lookup failed for ${checkpointId}:`, error);
    return { ok: true };
  }

  const here = checkpoints.find((checkpoint) => checkpoint.id === checkpointId);
  if (!here) return { ok: true };

  // The desk immediately before this one, on this day. The first desk of a day
  // has none, so it is never gated — a team has to be able to start somewhere.
  const previous = checkpoints
    .filter(
      (checkpoint) =>
        checkpoint.day === here.day &&
        (checkpoint.sequence ?? 0) < (here.sequence ?? 0),
    )
    .sort((a, b) => (b.sequence ?? 0) - (a.sequence ?? 0))[0];

  if (!previous) return { ok: true };

  // Demo teams walk the whole event without waiting on desks, exactly as they
  // skip round status and locks. See `lib/gameplay/demo-teams.ts`.
  if (await isDemoTeamId(teamId)) {
    noteDemoBypass(`team ${teamId} checkpoint ${checkpointId}`);
    return { ok: true };
  }

  const { data, error } = await db
    .from('attendance_records')
    .select('id')
    .eq('team_id', teamId)
    .eq('checkpoint_id', previous.id)
    .maybeSingle();

  if (error) {
    console.error(`[gates] previous-checkpoint read failed for team ${teamId}:`, error);
    return { ok: true };
  }

  if (data) return { ok: true };

  return {
    ok: false,
    required: { id: previous.id, code: previous.code, label: previous.label },
    message:
      `This team was never marked present at "${previous.label}". ` +
      `Mark them there first, then scan them in here.`,
  };
}
