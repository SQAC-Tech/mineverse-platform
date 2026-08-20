import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';
import { DEV_OPEN_SCREENING } from '@/lib/screening/config';
import { resetAttempt } from '@/lib/screening/service';

/**
 * Wipes the team's screening attempt so the Gauntlet can be re-sat.
 *
 * The screening is the pre-event qualifier: it decides who gets a seat. This
 * route shipped guarded by nothing but a session, and the "RE-TEST SCREENING"
 * button on the results screen called it — so any team that finished could
 * delete its attempt and sit the qualifier again, as many times as it liked.
 *
 * The admin route already had this right (`reset_attempt` in
 * app/api/admin/screening/route.ts): a reset is "the escape hatch for a genuine
 * technical failure", deliberately manual, per-team, logged, and refused once
 * the shortlist is committed. A team-facing route cannot be any of those things,
 * so this one only exists while the dev flag is on. In production it is a 403
 * and organisers use the admin panel, where the reset is attributable.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  if (!DEV_OPEN_SCREENING) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RESET_NOT_ALLOWED',
          message: 'The screening is sat once. Ask an organizer if something went wrong.',
        },
      },
      { status: 403 },
    );
  }

  // Even in dev mode, never re-open an attempt the shortlist was cut from — the
  // same guard the admin route applies. A reset after the cut would put a team
  // back in the pool it was already judged against.
  const { count } = await supabaseServer
    .from('screening_shortlist')
    .select('team_id', { count: 'exact', head: true });

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'SHORTLIST_FROZEN', message: 'The shortlist is committed. Clear it before resetting an attempt.' },
      },
      { status: 409 },
    );
  }

  const result = await resetAttempt(session.team_id);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: { code: result.code } }, { status: result.status });
  }

  console.warn(`[screening] attempt self-reset by team ${session.team_id} (dev mode)`);
  return NextResponse.json({ success: true, data: result.data });
}
