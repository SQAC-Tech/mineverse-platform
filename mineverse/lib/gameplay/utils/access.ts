import { supabaseServer } from '@/lib/supabase/server';

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

  if (round.status !== 'active') {
    return { hasAccess: false, error: 'ROUND_NOT_ACTIVE' };
  }

  // 2. Check if the team has access to this round
  const { data: access, error: accessError } = await supabaseServer
    .from('team_round_access')
    .select('has_access')
    .eq('team_id', teamId)
    .eq('round_id', roundId)
    .single();

  if (accessError || !access || !access.has_access) {
    return { hasAccess: false, error: 'TEAM_NOT_AUTHORIZED_FOR_ROUND' };
  }

  return { hasAccess: true };
}
