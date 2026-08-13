import { NextResponse } from 'next/server';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { supabaseServer } from '@/lib/supabase/server';

const db = supabaseServer as any;

export async function GET() {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  try {
    const { data, error } = await db
      .from('team_game_state')
      .select('team_id, qualified_for_day2, nether_core_count, teams(id, team_code, team_name), resources(wood, stone, iron, gold, diamond, emerald, obsidian, version)')
      .eq('qualified_for_day2', true)
      .order('team_id', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ success: true, data: { teams: data ?? [] } });
  } catch (error) {
    console.error('Day2 Team List Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}

