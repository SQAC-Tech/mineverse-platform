import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { noteDevUnlockBypass } from '@/lib/gameplay/dev-mode';
import {
  DEV_OPEN_SCREENING,
  LATE_START_WARNING_MS,
  SCREENING_DURATION_MINUTES,
  SCREENING_QUESTION_COUNT,
  windowState,
} from '@/lib/screening/config';
import { getScreeningRound, getTeamYear } from '@/lib/screening/service';
import { academicYearLabel } from '@/lib/registration-no';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * What the login card and the instructions screen need to know.
 *
 * Everything here is safe for a player: the window, the duration, the question
 * count, and whether this team has already played. Nothing about scoring —
 * weights, the first-year bonus and the tiebreak are organiser-only.
 */
export async function GET() {
  const round = await getScreeningRound();
  const now = Date.now();
  const realState = windowState({ startsAt: round?.starts_at ?? null, endsAt: round?.ends_at ?? null, status: round?.status ?? null }, now);

  // Dev only. The login card and the instructions screen both gate on this, so
  // without it a local walk through stops at "opens on 22 Aug" even though
  // `start` would let you in.
  const state = DEV_OPEN_SCREENING && realState !== 'open' ? 'open' : realState;
  if (state !== realState) noteDevUnlockBypass('screening status');

  const closesInMs = round?.ends_at ? new Date(round.ends_at).getTime() - now : null;

  const payload: Record<string, unknown> = {
    state,
    starts_at: round?.starts_at ?? null,
    ends_at: round?.ends_at ?? null,
    duration_minutes: SCREENING_DURATION_MINUTES,
    question_count: SCREENING_QUESTION_COUNT,
    // Starting inside the last half hour still buys the full 30 minutes. Saying
    // so up front is the difference between a team trusting the clock and a
    // team refusing to start at 23:50.
    late_start: state === 'open' && closesInMs !== null && closesInMs <= LATE_START_WARNING_MS,
  };

  // The team's own state, when there is a session. The card renders logged out
  // too, so this is additive rather than a 401.
  const session = await getSession();
  if (session) {
    const { data: attempt } = await (supabaseServer as any)
      .from('screening_attempts')
      .select('status, submitted_at')
      .eq('team_id', session.team_id)
      .maybeSingle();

    const { data: team } = await (supabaseServer as any)
      .from('teams')
      .select('is_payment_verified')
      .eq('id', session.team_id)
      .single();

    // Shown, not asked. The instructions screen used to put a pair of radio
    // buttons here and post the answer to `start`; the year is read off the
    // roster now, and this is the team seeing what was read rather than
    // choosing it. Safe to expose — it is their own registration numbers.
    const year = await getTeamYear(session.team_id);

    payload.team = {
      attempt_status: attempt?.status ?? null,
      submitted_at: attempt?.submitted_at ?? null,
      payment_verified: Boolean(team?.is_payment_verified),
      year,
      year_label: academicYearLabel(year),
    };
  }

  return NextResponse.json({ success: true, data: payload });
}
