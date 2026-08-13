import { NextResponse } from 'next/server';
import { requireDay2Access, Day2Session } from '@/lib/day2/access/guard';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET() {
  const guardResult = await requireDay2Access();
  if (guardResult instanceof NextResponse) {
    return guardResult;
  }
  const session = guardResult as Day2Session;

  // Fetch all necessary status for Day 2
  const [fragmentResult, repairResult, resourcesResult, bossAttemptResult] = await Promise.all([
    supabaseServer.from('day2_portal_fragments').select('*').eq('team_id', session.team_id).maybeSingle(),
    supabaseServer.from('day2_portal_repair').select('*').eq('team_id', session.team_id).maybeSingle(),
    supabaseServer.from('resources').select('*').eq('team_id', session.team_id).maybeSingle(),
    supabaseServer.from('day2_final_boss_attempts').select('*').eq('team_id', session.team_id).order('started_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const hasFragment = !!fragmentResult.data;
  const isRepaired = !!repairResult.data;
  const diamondCount = resourcesResult.data?.diamond ?? 0;
  const netherCoreCount = session.state.nether_core_count;

  // Determine portal state
  let portalState = 'locked';
  if (isRepaired) {
    portalState = 'repaired';
  } else if (netherCoreCount >= 1 && hasFragment && diamondCount >= 15) {
    portalState = 'ready';
  } else {
    // missing something
    const missing = [];
    if (netherCoreCount < 1) missing.push('core missing');
    if (!hasFragment) missing.push('fragment missing');
    if (diamondCount < 15) missing.push('diamonds needed');
    if (missing.length > 0) {
      portalState = missing.join(', ');
    } else {
      portalState = 'collecting';
    }
  }

  return NextResponse.json({
    success: true,
    team_id: session.team_id,
    portal: {
      state: portalState,
      has_fragment: hasFragment,
      is_repaired: isRepaired,
      diamond_count: diamondCount,
      nether_core_count: netherCoreCount,
    },
    final_boss: {
      last_attempt: bossAttemptResult.data,
    },
  });
}
