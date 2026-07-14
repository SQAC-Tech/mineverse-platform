import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseClient } from '@/lib/supabase/client'; // For broadcasting

export async function POST(req: Request) {
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

    // If making active, unlock for all verified teams
    if (newStatus === 'active') {
      const { data: teams } = await supabaseServer.from('teams').select('id').eq('is_payment_verified', true);
      if (teams) {
        const teamIds = teams.map(t => t.id);
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

  return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
}
