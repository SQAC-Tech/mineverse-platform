import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

const db = supabaseServer as any;

export async function GET() {
  try {
    const { data, error } = await db
      .from('teams')
      .select('id, team_name, team_code, total_score')
      .eq('is_payment_verified', true)
      .order('total_score', { ascending: false })
      .order('team_name', { ascending: true })
      .limit(100);

    if (error) throw error;

    const rows = (data ?? []).map((team: any, index: number) => ({
      rank: index + 1,
      team_name: team.team_name,
      team_code: team.team_code,
      score: team.total_score ?? 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        rows,
        ranking_basis: 'organizer_approved_total_score',
        note: 'Leaderboard is informational and does not determine Day 2 qualification.',
        last_updated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Dev4 Leaderboard Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}