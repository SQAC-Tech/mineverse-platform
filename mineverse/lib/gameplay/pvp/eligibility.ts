import { attendanceGate } from '@/lib/attendance/gates';

/**
 * Who may duel.
 *
 * One question: was the team marked present at the Round 3 desk. Nothing else —
 * not the Iron Armor, not the Blaze Guardian, not a prior win.
 *
 * The old rule required all three, and it was the wrong rule for a live hall.
 * A team stuck behind a craft it could not afford was locked out of the duel
 * entirely, which is the one part of the evening that is worth watching. The
 * duel is now its own round and asks only whether the team is here.
 *
 * `PVP_ATTENDANCE_ROUND` is 3 rather than 6 deliberately: the desk that admits
 * teams to the duel is the Round 3 desk, and there is no second scan. Adding 6
 * to that checkpoint's `covers_rounds` makes `attendanceGate(team, 6)` resolve
 * to the same desk, so both spellings agree — but this constant means the rule
 * holds even if that row has not been updated yet.
 */
export const PVP_ATTENDANCE_ROUND = 3;

export interface PvpEligibility {
  /** Marked present at the Round 3 desk — the only requirement. */
  attendanceMarked: boolean;
  isEligible: boolean;
  /** Sentence for the participant when they cannot enter. */
  reason: string | null;
}

export async function pvpEligibility(teamId: string): Promise<PvpEligibility> {
  const attendance = await attendanceGate(teamId, PVP_ATTENDANCE_ROUND);

  // A missing checkpoint opens the gate rather than closing it, matching
  // `attendanceGate`: if nobody configured the desk, that is our failure, and
  // locking the whole hall out of the duel is the worse of the two mistakes.
  if (attendance.ok) {
    return { attendanceMarked: true, isEligible: true, reason: null };
  }

  return {
    attendanceMarked: false,
    isEligible: false,
    reason: 'Get your team marked present at the Round 3 desk to enter the duel.',
  };
}
