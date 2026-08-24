import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

const db = supabaseServer as any;

/**
 * How long the CDN may serve one copy of the standings to everybody.
 *
 * This is the only endpoint on the platform whose answer does not depend on who
 * is asking — no session, no cookie, no team id — which makes it the only one
 * that can be cached in front of the function rather than inside it. The page
 * polls every thirty seconds, so without this the origin cost scales with the
 * number of screens showing the leaderboard: a projector in the hall, the
 * organisers' laptops and every team's second tab each pay their own database
 * query for a row set that is identical.
 *
 * With it, the whole hall costs at most one query every twenty seconds, and
 * `stale-while-revalidate` means the refresh happens behind a copy that is
 * already being served rather than in front of a spinner.
 *
 * Twenty seconds is under the poll interval on purpose. Longer than the poll
 * and a team would see the same numbers twice in a row and assume the board had
 * frozen; the standings are meant to look live even when they have not moved.
 */
const LEADERBOARD_CDN_HEADER = 'public, s-maxage=20, stale-while-revalidate=60';

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

    // Check for Dev 3's certified champion (read-only — we never certify)
    let certifiedChampion: { team_name: string; team_code: string; certified_at: string } | null = null;
    let isProvisional = true;

    try {
      const { data: certRow, error: certError } = await db
        .from('day2_champion_certifications')
        .select('team_id, certified_at')
        .limit(1)
        .single();

      if (!certError && certRow) {
        const champTeam = (data ?? []).find((t: any) => t.id === certRow.team_id);
        if (champTeam) {
          certifiedChampion = {
            team_name: champTeam.team_name,
            team_code: champTeam.team_code,
            certified_at: certRow.certified_at,
          };
          isProvisional = false;
        }
      }
    } catch {
      // Table may not exist yet or be empty — stay provisional
    }

    return NextResponse.json({
      success: true,
      data: {
        rows,
        ranking_basis: 'organizer_approved_total_score',
        is_provisional: isProvisional,
        certified_champion: certifiedChampion,
        note: isProvisional
          ? 'Results are provisional until the organizer certifies a champion.'
          : `Champion certified: ${certifiedChampion?.team_name}`,
        last_updated: new Date().toISOString(),
      },
    }, {
      // Only the success path. A cached 500 would outlive the fault that caused
      // it and keep the board broken for everyone until the TTL ran out.
      headers: { 'Cache-Control': LEADERBOARD_CDN_HEADER },
    });
  } catch (error) {
    console.error('Dev4 Leaderboard Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
