import { supabaseServer } from '@/lib/supabase/server';
import { DEV_UNLOCK_ALL_ROUNDS, noteDevUnlockBypass } from '@/lib/gameplay/dev-mode';
import { isDemoTeamId, noteDemoBypass } from '@/lib/gameplay/demo-teams';
import { attendanceGate } from '@/lib/attendance/gates';
import { craftGate } from '@/lib/gameplay/crafting/gate';

export async function verifyTeamRoundAccess(teamId: string, roundId: number): Promise<{ hasAccess: boolean; error?: string }> {
  // 1. Check if the round is active
  const { data: round, error: roundError } = await supabaseServer
    .from('rounds')
    .select('status')
    .eq('id', roundId)
    .single();

  if (roundError || !round) {
    return { hasAccess: false, error: 'ROUND_NOT_FOUND' };
  }

  // Dev unlock skips the lock checks only; the caller already verified the session.
  if (DEV_UNLOCK_ALL_ROUNDS) {
    noteDevUnlockBypass(`team ${teamId} round ${roundId}`);
    return { hasAccess: true };
  }

  /**
   * The biome is opened by the tool that reaches it.
   *
   * Above the demo bypass on purpose. That bypass waives the SCHEDULING gates --
   * round status and the per-team lock -- so a round can be walked without
   * flipping `rounds.status` for the whole hall. Progression is not scheduling:
   * a demo team skipping the craft would be testing a route no real team can
   * take, and the craft loop is exactly the thing worth rehearsing.
   */
  const craft = await craftGate(teamId, roundId);
  if (!craft.ok) {
    return { hasAccess: false, error: 'CRAFT_REQUIRED' };
  }

  // Scoped to named team codes, so testing a round does not require flipping
  // `rounds.status`, which would open it for every real team at once.
  if (await isDemoTeamId(teamId)) {
    noteDemoBypass(`team ${teamId} round ${roundId}`);
    return { hasAccess: true };
  }

  if (round.status !== 'active') {
    return { hasAccess: false, error: 'ROUND_NOT_ACTIVE' };
  }

  // 2. Check if the team has access to this round. Access is granted by the
  // presence of an unlocked team_round_access row; there is no `has_access`
  // column, and selecting one made this check fail closed for every team.
  const { data: access, error: accessError } = await supabaseServer
    .from('team_round_access')
    .select('is_locked')
    .eq('team_id', teamId)
    .eq('round_id', roundId)
    .single();

  if (accessError || !access || access.is_locked) {
    return { hasAccess: false, error: 'TEAM_NOT_AUTHORIZED_FOR_ROUND' };
  }

  /**
   * 3. Check the team is actually in the room.
   *
   * The unlock above says the team is entitled to this round; attendance says
   * it turned up. Both are needed, and this is the one that cannot be granted
   * in advance — it is written at the desk when the team's QR is scanned.
   *
   * Deliberately last. It is the cheapest failure to explain to a team ("go get
   * marked at the desk"), so it should not mask a harder one.
   */
  const attendance = await attendanceGate(teamId, roundId);
  if (!attendance.ok) {
    return { hasAccess: false, error: 'ATTENDANCE_NOT_MARKED' };
  }

  return { hasAccess: true };
}
