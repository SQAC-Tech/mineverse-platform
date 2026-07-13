import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const { team_id, checkpoint_id, members_present, method, notes } = await req.json();

  const { data: team } = await supabaseServer.from('teams').select('team_size').eq('id', team_id).single();
  if (!team) return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 });

  if (members_present < 0 || members_present > team.team_size) {
    return NextResponse.json({ success: false, error: 'Invalid members present count' }, { status: 400 });
  }

  // Upsert pattern
  const { error } = await supabaseServer.from('attendance_records').upsert({
    team_id,
    checkpoint_id,
    members_present,
    method,
    notes
  }, { onConflict: 'team_id, checkpoint_id' });

  if (error) {
    return NextResponse.json({ success: false, error: 'Failed to mark attendance' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
