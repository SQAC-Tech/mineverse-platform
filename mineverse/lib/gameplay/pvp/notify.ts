import { supabaseServer } from '@/lib/supabase/server';
import { supabaseClient } from '@/lib/supabase/client';
import { getTeamYear } from './year-detection';
import { buildEligibilitySnapshot } from '@/lib/gameplay/qualification/service';

const db = supabaseServer as any;

/**
 * Called after a team completes both PvP prerequisites (Iron Armor + Blaze Guardian).
 * Broadcasts a realtime event to the admin channel so the admin sees the team is ready.
 */
export async function broadcastPvpEligible(teamId: string): Promise<void> {
  try {
    // Check both prerequisites are actually met before broadcasting
    const snapshot = await buildEligibilitySnapshot([teamId], { lenient: true });
    const entry = snapshot.get(teamId);
    if (!entry?.hasIronArmor || !entry?.hasBlazeGuardian) return;

    const { data: team } = await db
      .from('teams')
      .select('team_code, team_name')
      .eq('id', teamId)
      .single();

    if (!team) return;

    const year = await getTeamYear(teamId);

    await supabaseClient.channel('pvp_admin').send({
      type: 'broadcast',
      event: 'team_eligible',
      payload: {
        team_id: teamId,
        team_name: team.team_name,
        team_code: team.team_code,
        year,
      },
    });
  } catch (err) {
    // Notifications are best-effort — never let them crash a gameplay action
    console.warn('[pvp-notify] broadcastPvpEligible failed:', err);
  }
}

/**
 * Called after an admin starts a PvP match.
 * Broadcasts to both player teams so they can open the arena immediately.
 */
export async function broadcastMatchStarted(matchId: string, teamIds: string[]): Promise<void> {
  try {
    await supabaseClient.channel('pvp_notifications').send({
      type: 'broadcast',
      event: 'match_started',
      payload: { match_id: matchId, team_ids: teamIds },
    });
  } catch (err) {
    console.warn('[pvp-notify] broadcastMatchStarted failed:', err);
  }
}

/**
 * Called the moment a duel is decided, so the losing team's arena stops.
 *
 * Only one of the two browsers pressed SUBMIT. The other is still sitting on a
 * question with a running clock, and without this it would keep typing into a
 * match that is already over until its next poll came round. The poll is still
 * there as the fallback; this is what makes it instant.
 */
export async function broadcastMatchResolved(matchId: string, teamIds: string[], winnerTeamId: string): Promise<void> {
  try {
    await supabaseClient.channel('pvp_notifications').send({
      type: 'broadcast',
      event: 'match_resolved',
      payload: { match_id: matchId, team_ids: teamIds, winner_team_id: winnerTeamId },
    });
  } catch (err) {
    console.warn('[pvp-notify] broadcastMatchResolved failed:', err);
  }
}
