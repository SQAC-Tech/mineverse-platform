import { supabaseServer } from '@/lib/supabase/server';
import { cached, invalidate } from '@/lib/cache/store';

/**
 * The reads the whole hall makes, cached once instead of per team.
 *
 * Chosen from the edge log, not from instinct. Over two hours on event day:
 *
 *   /rest/v1/rounds                  30,320 requests   (6 rows)
 *   /rest/v1/screening_shortlist     57,106 requests   (a count and one row)
 *   /rest/v1/attendance_checkpoints  16,164 requests   (4 rows)
 *
 * Every one of those is a small, slow-changing table that every team asks about
 * on every tick. Nothing here carries an answer key — see the note in
 * `lib/cache/store.ts` about what must never be cached.
 */

const ROUNDS_KEY = 'mv:rounds:all';
const CHECKPOINTS_KEY = 'mv:attendance:checkpoints';
const SHORTLIST_SIZE_KEY = 'mv:screening:shortlist_size';

/**
 * Ten seconds, because a round's status is the one field here that changes
 * while people are waiting for it.
 *
 * An organiser opening a round reaches every screen instantly over the realtime
 * `round_status` broadcast, so this TTL governs only how long a server-side
 * gate could still say "not active" after the fact. `invalidateRounds` drops it
 * on the admin's own request as well, which covers the common case; the TTL is
 * the backstop for the other lambdas that never saw that call.
 */
const ROUNDS_TTL = 10;

/** The desks are configured before the event and not touched again. */
const CHECKPOINTS_TTL = 120;

/** Frozen once the screening cut is made. */
const SHORTLIST_TTL = 120;

export interface CachedRound {
  id: number;
  name: string | null;
  day: number | null;
  sequence: number | null;
  description: string | null;
  time_allotted: number | null;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  guardian_unlocked: boolean | null;
}

/**
 * Every round, in one key.
 *
 * One entry rather than one per round on purpose: the table is six rows, and a
 * single key means a team checking round 3 also warms the lookup the dashboard
 * makes for round 6 a moment later. Callers filter in memory.
 */
export async function getCachedRounds(): Promise<CachedRound[]> {
  return cached(ROUNDS_KEY, ROUNDS_TTL, async () => {
    const { data, error } = await supabaseServer
      .from('rounds')
      .select('id, name, day, sequence, description, time_allotted, status, starts_at, ends_at, guardian_unlocked')
      .order('id', { ascending: true });

    // Throwing here would be cached as nothing and retried by the next caller,
    // which is what we want — an empty array must not be mistaken for "no
    // rounds exist" and then held for ten seconds.
    if (error) throw error;
    return (data ?? []) as CachedRound[];
  });
}

export async function getCachedRound(roundId: number): Promise<CachedRound | null> {
  const rounds = await getCachedRounds();
  return rounds.find((round) => round.id === roundId) ?? null;
}

export interface CachedCheckpoint {
  id: number;
  code: string;
  label: string;
  day: number;
  sequence: number | null;
  covers_rounds: number[];
}

export async function getCachedCheckpoints(): Promise<CachedCheckpoint[]> {
  return cached(CHECKPOINTS_KEY, CHECKPOINTS_TTL, async () => {
    const { data, error } = await supabaseServer
      .from('attendance_checkpoints')
      .select('id, code, label, day, sequence, covers_rounds')
      .order('sequence', { ascending: true });

    if (error) throw error;
    return (data ?? []) as CachedCheckpoint[];
  });
}

/**
 * How many teams are on the shortlist.
 *
 * One integer, identical for every team, and `dashboardEntitlement` asked the
 * database for it on every dashboard tick — 34,207 HEAD requests in two hours
 * to find out whether a cut has been made at all.
 */
export async function getCachedShortlistSize(): Promise<number> {
  return cached(SHORTLIST_SIZE_KEY, SHORTLIST_TTL, async () => {
    const { count, error } = await supabaseServer
      .from('screening_shortlist')
      .select('team_id', { count: 'exact', head: true });

    if (error) throw error;
    return count ?? 0;
  });
}

/** Called when an organiser starts, closes or re-times a round. */
export async function invalidateRounds(): Promise<void> {
  await invalidate(ROUNDS_KEY);
}

/** Called when the desks or the shortlist change. */
export async function invalidateAttendanceConfig(): Promise<void> {
  await invalidate(CHECKPOINTS_KEY, SHORTLIST_SIZE_KEY);
}
