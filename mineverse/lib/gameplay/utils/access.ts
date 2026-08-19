import { supabaseServer } from '@/lib/supabase/server';
import { DEV_UNLOCK_ALL_ROUNDS, noteDevUnlockBypass } from '@/lib/gameplay/dev-mode';
import { isDemoTeamId, noteDemoBypass } from '@/lib/gameplay/demo-teams';

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

  return { hasAccess: true };
}
