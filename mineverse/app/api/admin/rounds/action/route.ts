import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseClient } from '@/lib/supabase/client'; // For broadcasting
import { requirePanelScope } from '@/lib/panel/require-admin';

export async function POST(req: Request) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const { round_id, action, minutes } = await req.json();

  if (action === 'toggle') {
    const { data: round } = await supabaseServer.from('rounds').select('*').eq('id', round_id).single();
    if (!round) return NextResponse.json({ success: false, error: 'Round not found' }, { status: 404 });

    const newStatus = round.status === 'locked' ? 'active' : round.status === 'active' ? 'completed' : 'locked';
    const startsAt = newStatus === 'active' ? new Date().toISOString() : round.starts_at;
    const endsAt = newStatus === 'active' 
      ? new Date(Date.now() + round.time_allotted * 60000).toISOString() 
      : round.ends_at;

    await supabaseServer.from('rounds').update({
      status: newStatus,
      starts_at: startsAt,
      ends_at: endsAt
    }).eq('id', round_id);

    /**
     * If making active, unlock for the teams entitled to play it.
     *
     * That used to be every payment-verified team — all 94 of them — which
     * quietly undid the screening cut: pressing this once on Round 1 would let
     * in the 46 teams that did not qualify, and nothing would say so.
     *
     * Once a shortlist is frozen it is the authority on who plays, for every
     * round. Before one exists the old behaviour stands, so rounds can still be
     * opened during a rehearsal or if the screening is skipped entirely.
     */
    if (newStatus === 'active') {
      const { data: shortlisted } = await supabaseServer
        .from('screening_shortlist')
        .select('team_id, rsvp_confirmed_at')
        .eq('result', 'shortlisted');

      let teamIds: string[];
      if (shortlisted && shortlisted.length > 0) {
        /**
         * The whole shortlist, Round 1 included.
         *
         * Round 1 used to additionally require `rsvp_confirmed_at`, on the
         * reasoning that qualifying earns the seat and confirming keeps it.
         * Nothing has ever written that column — the RSVP is a Google Form with
         * no import — so this filter reduced the roster to zero. Pressing
         * "open" flipped `rounds.status` to active and unlocked the round for
         * nobody, which is exactly what "the biomes still do not open" was.
         *
         * Attendance is the live signal now, as it already was for every other
         * round: the team is in the room and its QR has been scanned. A form
         * from the night before adds nothing to that.
         */
        teamIds = shortlisted.map((row) => row.team_id);
        console.warn(`[rounds] round ${round_id} opened to ${teamIds.length} shortlisted teams`);
      } else {
        const { data: teams } = await supabaseServer
          .from('teams').select('id').eq('is_payment_verified', true);
        teamIds = (teams ?? []).map((t) => t.id);
        console.warn(`[rounds] round ${round_id} opened to all ${teamIds.length} verified teams — no shortlist frozen`);
      }

      if (teamIds.length > 0) {
        await supabaseServer.from('team_round_access')
          .update({ is_locked: false, started_at: startsAt })
          .in('team_id', teamIds)
          .eq('round_id', round_id);
      }

      // Broadcast to clients
      supabaseClient.channel('round_status').send({
        type: 'broadcast',
        event: 'unlock',
        payload: { round_id, team_id: 'all' }
      });
    }

    return NextResponse.json({ success: true, newStatus });
  }

  if (action === 'extend' && minutes) {
    const { data: round } = await supabaseServer.from('rounds').select('ends_at, time_allotted').eq('id', round_id).single();
    if (round && round.ends_at) {
      const newEndsAt = new Date(new Date(round.ends_at).getTime() + minutes * 60000).toISOString();
      await supabaseServer.from('rounds').update({ ends_at: newEndsAt, time_allotted: round.time_allotted + minutes }).eq('id', round_id);
      return NextResponse.json({ success: true });
    }
  }

  if (action === 'toggle_boss') {
    const { data: round } = await supabaseServer.from('rounds').select('guardian_unlocked').eq('id', round_id).single();
    if (!round) return NextResponse.json({ success: false, error: 'Round not found' }, { status: 404 });
    const newStatus = !round.guardian_unlocked;
    await supabaseServer.from('rounds').update({ guardian_unlocked: newStatus }).eq('id', round_id);
    return NextResponse.json({ success: true, newStatus: newStatus ? 'boss unlocked' : 'boss locked' });
  }

  return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
}
