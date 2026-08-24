import { getCachedRound } from '@/lib/cache/reads';

/**
 * Whether a round's clock is still running.
 *
 * `verifyTeamRoundAccess` asks whether a round is *open* — its status, the
 * team's unlock, attendance. It does not ask whether the round's own timer has
 * run out, because until now nothing needed it to: the shell greys itself out
 * at zero and an organiser flips the round to `completed` afterwards.
 *
 * That gap is fine for an answer, which the shell has already stopped anyone
 * from editing. It is not fine for the Blaze Guardian, which pays out on
 * submit: between the clock hitting zero and an organiser closing the round
 * there is a window where a team could still bank the reward. So this is asked
 * on the server, where a locked screen cannot be worked around.
 *
 * A round with no `ends_at` is open. That is not a loophole — it is a round an
 * organiser started without a clock, and refusing every submission in it would
 * shut the hall out of a round that is deliberately untimed.
 */
export interface RoundWindow {
  ok: boolean;
  ends_at: string | null;
  reason?: 'ROUND_TIME_UP';
}

export async function roundWindowGate(roundId: number): Promise<RoundWindow> {
  /**
   * A failed lookup opens the gate rather than closing it.
   *
   * Same reasoning as `craftGate` and `attendanceGate`: this runs on the path
   * into a live round, and if the query breaks mid-event the choice is between
   * letting a late submission through and refusing every team's guardian. Only
   * one of those is recoverable while the clock is running.
   */
  let endsAt: string | null = null;
  try {
    endsAt = (await getCachedRound(roundId))?.ends_at ?? null;
  } catch (error) {
    console.error(`[rounds] window lookup failed for round ${roundId}:`, error);
    return { ok: true, ends_at: null };
  }

  if (!endsAt) return { ok: true, ends_at: null };

  if (new Date(endsAt).getTime() <= Date.now()) {
    return { ok: false, ends_at: endsAt, reason: 'ROUND_TIME_UP' };
  }

  return { ok: true, ends_at: endsAt };
}
