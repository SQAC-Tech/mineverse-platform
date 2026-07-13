import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { data: team } = await supabaseServer.from('teams').select('*').eq('id', session.team_id).single();
  
  const { data: rounds } = await supabaseServer
    .from('team_round_access')
    .select('*, rounds(name, day, sequence, description, time_allotted)')
    .eq('team_id', session.team_id)
    .order('round_id', { ascending: true });

  return NextResponse.json({ success: true, team, rounds });
}
