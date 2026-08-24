import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getSafeQuestionsForRound } from '@/lib/gameplay/questions/service';
import { getTeamResources, getResourceHistory } from '@/lib/gameplay/resources/service';

export const dynamic = 'force-dynamic';

/**
 * Everything a round screen redraws itself from, in one request.
 *
 * The shells polled four endpoints every tick — questions, resources, the
 * dashboard snapshot and the ledger feed — which at 45 teams was around 1,400
 * requests a minute and is what took the hosting plan over its limit during an
 * event. They are all read-only, all keyed on the same session, and all wanted
 * at the same moment, so the split bought nothing.
 *
 * ## Why the failures stay separate
 *
 * `Promise.allSettled`, not `Promise.all`. The questions decide whether the
 * round is playable at all and their failure must reach the client as a real
 * error; the ledger feed only decorates a notification tray, and losing it must
 * never blank a team's paper mid-round. Collapsing four requests into one would
 * otherwise collapse four independent failure modes into one, which is a worse
 * screen than the one this replaces.
 *
 * ## What is deliberately not here
 *
 * The team/progress half still comes from `/api/dashboard/data`, which carries
 * its own login-lease heartbeat. Folding that in would either duplicate the
 * lease write or drop it, and the one-device rule depends on it.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ round_id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const { round_id } = await params;
  const roundId = Number.parseInt(round_id, 10);
  if (!Number.isInteger(roundId)) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_ROUND' } }, { status: 400 });
  }

  const limit = Math.min(Number.parseInt(req.nextUrl.searchParams.get('limit') ?? '12', 10) || 12, 50);

  try {
    const [questions, resources, history] = await Promise.allSettled([
      getSafeQuestionsForRound(session.team_id, roundId),
      getTeamResources(session.team_id),
      getResourceHistory(session.team_id, null, limit),
    ]);

    // The round gate is the one failure that must surface: a team refused entry
    // has to be told, not shown an empty paper.
    if (questions.status === 'rejected') throw questions.reason;
    if (!questions.value.ok) {
      return NextResponse.json(
        { success: false, error: { code: questions.value.code, message: questions.value.message } },
        { status: questions.value.status },
      );
    }

    if (resources.status === 'rejected') console.error('Snapshot resources failed:', resources.reason);
    if (history.status === 'rejected') console.error('Snapshot history failed:', history.reason);

    return NextResponse.json({
      success: true,
      data: {
        round: questions.value.data,
        // Null rather than absent, so the client can tell "not loaded this tick"
        // from "loaded and empty" and keep its last good value either way.
        resources: resources.status === 'fulfilled' ? resources.value : null,
        history: history.status === 'fulfilled' ? history.value : null,
      },
    });
  } catch (error) {
    console.error('Round Snapshot Error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
