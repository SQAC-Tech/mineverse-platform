import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';
import { Dev3TeamGameState } from '@/lib/gameplay/types';

export interface Day2Session {
  team_id: string;
  team_code: string;
  state: Dev3TeamGameState;
}

export async function requireDay2Access(): Promise<Day2Session | NextResponse> {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { data: state, error } = await supabaseServer
    .from('team_game_state')
    .select('*')
    .eq('team_id', session.team_id)
    .single();

  if (error || !state || !state.qualified_for_day2) {
    return NextResponse.json(
      { success: false, error: 'DAY2_NOT_QUALIFIED' },
      { status: 403 }
    );
  }

  return {
    team_id: session.team_id,
    team_code: session.team_code,
    state: state as unknown as Dev3TeamGameState,
  };
}
