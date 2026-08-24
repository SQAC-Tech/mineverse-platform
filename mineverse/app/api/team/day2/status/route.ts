import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface Day2Snapshot {
  qualified: boolean;
  nether_core_count: number;
  has_fragment: boolean;
  is_repaired: boolean;
  diamond_count: number;
  last_attempt: unknown | null;
}

/**
 * The portal screen's whole world, in one request.
 *
 * This used to call `requireDay2Access` — which reads `team_game_state` — and
 * then four more tables beside it, and `PortalRepairUI` polled it every five
 * seconds. Five PostgREST round trips per team per tick made these the two
 * busiest tables in the edge log after the dashboard's.
 *
 * `day2_status_snapshot` reads the same five things in one statement. Nothing
 * about the qualification rule has moved: the function reports
 * `qualified`, this route still refuses on it, and a team that is not through
 * to Day 2 gets the same `DAY2_NOT_QUALIFIED` it always did — it just costs one
 * call to say so instead of two.
 *
 * The guard stays where it is for the write paths (`portal/repair`,
 * `final-boss/submit`). Those run once per team, not once per five seconds, and
 * they need the full `state` object rather than the handful of fields here.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await (supabaseServer as any).rpc('day2_status_snapshot', {
    p_team_id: session.team_id,
  });

  const snapshot = data as Day2Snapshot | null;

  if (error || !snapshot || !snapshot.qualified) {
    if (error) console.error('Day2 status snapshot failed:', error);
    return NextResponse.json({ success: false, error: 'DAY2_NOT_QUALIFIED' }, { status: 403 });
  }

  const { has_fragment: hasFragment, is_repaired: isRepaired } = snapshot;
  const diamondCount = snapshot.diamond_count ?? 0;
  const netherCoreCount = snapshot.nether_core_count ?? 0;

  // Unchanged from the version this replaces, deliberately — the strings are
  // rendered straight into the UI and a reworded "collecting" would read as a
  // new state to a team halfway through gathering.
  let portalState = 'locked';
  if (isRepaired) {
    portalState = 'repaired';
  } else if (netherCoreCount >= 1 && hasFragment && diamondCount >= 15) {
    portalState = 'ready';
  } else {
    const missing = [];
    if (netherCoreCount < 1) missing.push('core missing');
    if (!hasFragment) missing.push('fragment missing');
    if (diamondCount < 15) missing.push('diamonds needed');
    portalState = missing.length > 0 ? missing.join(', ') : 'collecting';
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
      last_attempt: snapshot.last_attempt ?? null,
    },
  });
}
