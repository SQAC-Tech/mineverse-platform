import { NextRequest, NextResponse } from 'next/server';
import { requirePanelScope, PANEL_ADMIN_ACTOR } from '@/lib/panel/require-admin';
import { supabaseServer } from '@/lib/supabase/server';
import {
  SCREENING_DURATION_MINUTES,
  SCREENING_GRANT,
  SCREENING_QUESTION_COUNT,
  windowState,
} from '@/lib/screening/config';
import { getScreeningRound, sweepExpiredAttempts } from '@/lib/screening/service';
import { clearShortlist, commitShortlist, previewShortlist, rankTeams } from '@/lib/screening/shortlist';
import { GAUNTLET_MAX_SCORE, listAttemptDetails } from '@/lib/screening/attempts';
import { mailCounts, sendAnnouncement, sendResults } from '@/lib/screening/mailer';

const db = supabaseServer as any;

/**
 * The screening console's data.
 *
 * `proxy.ts` already gates `/api/admin/*`, but every admin route verifies the
 * scope itself as well — a page-level proxy is never sufficient on its own.
 */
export async function GET(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  // Any attempt whose deadline passed while nobody was looking gets graded now,
  // so the ranking below includes the team that closed its laptop at question 20.
  const swept = await sweepExpiredAttempts();

  const round = await getScreeningRound();
  const cut = Number(req.nextUrl.searchParams.get('cut') ?? 0);

  const [ranked, counts, teamTotal, inProgress, attempts] = await Promise.all([
    rankTeams(),
    mailCounts(),
    db.from('teams').select('id', { count: 'exact', head: true }).eq('is_payment_verified', true),
    db.from('screening_attempts').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
    // Every attempt, including the ones still running — `ranked` cannot carry
    // those, because an unfinished attempt has no score to rank it by.
    listAttemptDetails(),
  ]);

  const preview = cut > 0 ? await previewShortlist(cut) : null;

  return NextResponse.json({
    success: true,
    data: {
      window: {
        starts_at: round?.starts_at ?? null,
        ends_at: round?.ends_at ?? null,
        state: windowState({ startsAt: round?.starts_at ?? null, endsAt: round?.ends_at ?? null }),
      },
      config: {
        duration_minutes: SCREENING_DURATION_MINUTES,
        question_count: SCREENING_QUESTION_COUNT,
        grant: SCREENING_GRANT,
        max_score: GAUNTLET_MAX_SCORE,
      },
      stats: {
        eligible_teams: teamTotal.count ?? 0,
        in_progress: inProgress.count ?? 0,
        submitted: ranked.length,
        not_started: Math.max(0, (teamTotal.count ?? 0) - ranked.length - (inProgress.count ?? 0)),
        swept,
      },
      ranked,
      attempts,
      preview,
      mail: counts,
      committed: ranked.some((team) => team.result !== null),
    },
  });
}

/** Every mutating action on this screen, named. */
export async function POST(req: NextRequest) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const action = String(body?.action ?? '');

    switch (action) {
      case 'commit_shortlist': {
        const cut = Number(body.cut);
        if (!Number.isInteger(cut) || cut < 1) {
          return NextResponse.json({ success: false, error: { code: 'BAD_CUT', message: 'Pick how many teams to take.' } }, { status: 400 });
        }
        const result = await commitShortlist(cut, PANEL_ADMIN_ACTOR);
        if (!result.ok) {
          return NextResponse.json({ success: false, error: { code: result.code, message: result.message } }, { status: 409 });
        }
        return NextResponse.json({ success: true, data: result });
      }

      case 'clear_shortlist': {
        // Resources already granted are not clawed back — the ledger is an
        // audit trail, not a scratchpad. Re-committing is idempotent per team.
        const cleared = await clearShortlist();
        return NextResponse.json({ success: cleared, data: { cleared } });
      }

      case 'send_announcement': {
        const result = await sendAnnouncement();
        return NextResponse.json({ success: true, data: result });
      }

      case 'send_results': {
        const result = await sendResults();
        if (!result) {
          return NextResponse.json(
            { success: false, error: { code: 'NO_SHORTLIST', message: 'Commit a shortlist first.' } },
            { status: 409 },
          );
        }
        return NextResponse.json({ success: true, data: result });
      }

      case 'reset_attempt': {
        // The escape hatch for a genuine technical failure — a power cut at
        // question 3 otherwise costs a team its only attempt. Deliberately
        // manual, per-team, and logged by whoever pressed it.
        const teamId = String(body.team_id ?? '');
        if (!teamId) {
          return NextResponse.json({ success: false, error: { code: 'BAD_TEAM' } }, { status: 400 });
        }
        const { count } = await db
          .from('screening_shortlist')
          .select('team_id', { count: 'exact', head: true });
        if ((count ?? 0) > 0) {
          return NextResponse.json(
            { success: false, error: { code: 'SHORTLIST_FROZEN', message: 'The shortlist is committed. Clear it before resetting an attempt.' } },
            { status: 409 },
          );
        }
        const { error } = await db.from('screening_attempts').delete().eq('team_id', teamId);
        if (error) {
          return NextResponse.json({ success: false, error: { code: 'RESET_FAILED' } }, { status: 500 });
        }
        console.warn(`[screening] attempt reset for team ${teamId} by ${PANEL_ADMIN_ACTOR}`);
        return NextResponse.json({ success: true, data: { team_id: teamId } });
      }

      default:
        return NextResponse.json({ success: false, error: { code: 'UNKNOWN_ACTION' } }, { status: 400 });
    }
  } catch (error) {
    console.error('Screening admin error:', error);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR' } }, { status: 500 });
  }
}
