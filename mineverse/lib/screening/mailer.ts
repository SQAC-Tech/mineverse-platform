import QRCode from 'qrcode';
import { supabaseServer } from '@/lib/supabase/server';
import {
  sendScreeningAnnouncementEmail,
  sendScreeningRejectedEmail,
  sendScreeningShortlistedEmail,
} from '@/lib/email/screening';
import { SCREENING_DURATION_MINUTES, SCREENING_QUESTION_COUNT } from './config';
import { getScreeningRound } from './service';

const db = supabaseServer as any;

export type MailKind = 'screening_announcement' | 'screening_shortlisted' | 'screening_rejected';

export interface MailRun {
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
  /**
   * Teams this run did not reach before it ran out of budget. Zero means the
   * list is finished; anything else means press the button again.
   */
  remaining: number;
}

/**
 * The gap between two sends.
 *
 * Gmail does not publish a per-second limit, it just starts refusing, and a
 * bulk run is the one place a burst is plausible. Five seconds is slow enough
 * that no provider treats ninety mails as a flood.
 */
const SEND_DELAY_MS = 5_000;

/**
 * How long one run may take before it hands the rest back.
 *
 * At five seconds a mail, ninety teams is seven and a half minutes, and every
 * serverless platform kills a request long before that. Rather than race the
 * timeout, a run stops on its own and reports what is left.
 *
 * Resuming is free and needs no state: `alreadyMailed` skips every team that
 * already has a successful send of this type, so pressing the button again
 * carries on exactly where this stopped. That was true before this budget
 * existed — it is what makes a second click safe — and it is what makes a
 * killed request survivable too.
 */
const RUN_BUDGET_MS = 240_000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Teams that already have a successful send of this type.
 *
 * `email_logs` gets a row per attempt, so this is the guard that stops a second
 * click mailing 43 teams again — the sort of mistake that is impossible to take
 * back and very easy to make on a tired 23rd.
 */
async function alreadyMailed(kind: MailKind): Promise<Set<string>> {
  const { data } = await db
    .from('email_logs')
    .select('team_id')
    .eq('email_type', kind)
    .eq('status', 'sent');
  return new Set((data ?? []).map((row: { team_id: string | null }) => row.team_id).filter(Boolean));
}

interface TeamWithLead {
  id: string;
  team_code: string;
  team_name: string;
  members: Array<{ name: string; college_email: string; registration_no: string | null; is_team_lead: boolean }>;
}

async function loadTeams(teamIds?: string[]): Promise<TeamWithLead[]> {
  let query = db
    .from('teams')
    .select('id, team_code, team_name, is_payment_verified, members(name, college_email, registration_no, is_team_lead)')
    .eq('is_payment_verified', true);

  if (teamIds) query = query.in('id', teamIds);

  const { data } = await query;
  return (data ?? []) as TeamWithLead[];
}

/**
 * The team lead, and nobody else.
 *
 * One address per team on purpose: the lead is who the OTP goes to, so it is
 * the address the team actually reads, and mailing three people the same
 * result triples a run that is already paced at five seconds a send.
 *
 * It used to fall back to `members[0]` when no member carried the lead flag,
 * which quietly mailed whoever the database happened to return first. All 94
 * verified teams have a flagged lead, so the fallback never fired in practice;
 * removing it means a team with a broken roster is reported as skipped instead
 * of having its result sent to an arbitrary member.
 */
function leadEmail(team: TeamWithLead): string | null {
  const lead = team.members?.find((member) => member.is_team_lead);
  return lead?.college_email ?? null;
}

/**
 * Sends one type to a set of teams, one at a time, five seconds apart.
 *
 * Sequential rather than parallel on purpose: a burst of ninety that half-fails
 * is worse than a slow run that reports honestly, and these go out over SMTP,
 * where the punishment for a burst is the provider throttling the account
 * rather than a clean per-message error.
 */
async function run(
  kind: MailKind,
  teams: TeamWithLead[],
  send: (team: TeamWithLead, to: string) => Promise<{ success: boolean; error?: string }>,
  /**
   * Shared wall-clock deadline, passed in rather than computed here.
   *
   * `sendResults` calls this twice. Two runs each budgeting from their own
   * start would together take twice the budget and blow the request limit the
   * budget exists to stay inside — so both halves spend one.
   */
  deadline: number,
): Promise<MailRun> {
  const done = await alreadyMailed(kind);
  const result: MailRun = { attempted: 0, sent: 0, skipped: 0, failed: 0, errors: [], remaining: 0 };

  const pending = teams.filter((team) => !done.has(team.id));
  result.skipped += teams.length - pending.length;

  for (let index = 0; index < pending.length; index += 1) {
    const team = pending[index];

    // Checked before the send, not after: stopping with the budget already
    // spent risks the platform killing the request mid-flight, and a mail cut
    // off between sending and logging is the one outcome this cannot report.
    if (Date.now() > deadline) {
      result.remaining = pending.length - index;
      console.warn(`[mail] ${kind} paused on budget — ${result.remaining} teams still to go`);
      break;
    }

    const to = leadEmail(team);
    if (!to) {
      result.skipped += 1;
      result.errors.push(`${team.team_code}: no team lead on the roster`);
      console.warn(`[mail] ${kind} skipped — ${team.team_code} has no flagged team lead`);
      continue;
    }

    // Paced before the send rather than after, so the loop never sleeps once
    // more after the last mail has already gone.
    if (result.attempted > 0) await wait(SEND_DELAY_MS);

    result.attempted += 1;
    try {
      const outcome = await send(team, to);
      if (outcome.success) {
        result.sent += 1;
        console.log(`[mail] ${kind} sent — ${team.team_code} <${to}>`);
      } else {
        result.failed += 1;
        result.errors.push(`${team.team_code}: ${outcome.error ?? 'send failed'}`);
        console.error(`[mail] ${kind} FAILED — ${team.team_code} <${to}>: ${outcome.error ?? 'send failed'}`);
      }
    } catch (error) {
      result.failed += 1;
      result.errors.push(`${team.team_code}: ${(error as Error).message}`);
      console.error(`[mail] ${kind} THREW — ${team.team_code} <${to}>: ${(error as Error).message}`);
    }
  }

  /**
   * One line per run, whatever happened.
   *
   * A send of ninety takes minutes and the only report used to be a toast that
   * disappears. If nobody is looking at the tab when it lands, the run may as
   * well not have happened — this is the copy that survives in the platform
   * logs and can be read afterwards.
   */
  console.log(
    `[mail] ${kind} run complete — ${result.sent} sent, ${result.skipped} skipped, ` +
    `${result.failed} failed, ${result.remaining} left`,
  );

  return result;
}

/** To every paid-up team, before the window opens. */
export async function sendAnnouncement(): Promise<MailRun> {
  const round = await getScreeningRound();
  const teams = await loadTeams();

  return run('screening_announcement', teams, (team, to) =>
    sendScreeningAnnouncementEmail({
      to,
      team_id: team.id,
      team_name: team.team_name,
      team_code: team.team_code,
      starts_at: round?.starts_at ?? null,
      ends_at: round?.ends_at ?? null,
      duration_minutes: SCREENING_DURATION_MINUTES,
      question_count: SCREENING_QUESTION_COUNT,
    }),
    Date.now() + RUN_BUDGET_MS,
  );
}

/**
 * Both result mails, from the frozen shortlist.
 *
 * Reads `screening_shortlist` rather than re-ranking, so what goes out is
 * exactly what an organiser looked at and committed.
 */
export async function sendResults(): Promise<{ shortlisted: MailRun; rejected: MailRun } | null> {
  const { data: decided } = await db.from('screening_shortlist').select('team_id, result');
  if (!decided?.length) return null;

  const shortlistedIds = decided.filter((row: any) => row.result === 'shortlisted').map((row: any) => row.team_id);
  const rejectedIds = decided.filter((row: any) => row.result === 'rejected').map((row: any) => row.team_id);

  const shortlistedTeams = shortlistedIds.length ? await loadTeams(shortlistedIds) : [];
  const rejectedTeams = rejectedIds.length ? await loadTeams(rejectedIds) : [];

  // One deadline for both halves — see the note on `run`.
  const deadline = Date.now() + RUN_BUDGET_MS;

  const shortlisted = await run('screening_shortlisted', shortlistedTeams, async (team, to) => {
    // The attendance QR encodes the plain team code — the desk scanner resolves
    // it, so there is no token to sign or expire.
    const qr = await QRCode.toDataURL(team.team_code, { width: 500, margin: 2 });
    const outcome = await sendScreeningShortlistedEmail({
      to,
      team_id: team.id,
      team_name: team.team_name,
      team_code: team.team_code,
      members: (team.members ?? []).map((member) => ({
        name: member.name,
        registration_no: member.registration_no,
        is_team_lead: member.is_team_lead,
      })),
      qr_image_data_url: qr,
    });
    if (outcome.success) {
      await db
        .from('screening_shortlist')
        .update({ result_mailed_at: new Date().toISOString() })
        .eq('team_id', team.id);
    }
    return outcome;
  }, deadline);

  const rejected = await run('screening_rejected', rejectedTeams, async (team, to) => {
    const outcome = await sendScreeningRejectedEmail({
      to, team_id: team.id, team_name: team.team_name, team_code: team.team_code,
    });
    if (outcome.success) {
      await db
        .from('screening_shortlist')
        .update({ result_mailed_at: new Date().toISOString() })
        .eq('team_id', team.id);
    }
    return outcome;
  }, deadline);

  return { shortlisted, rejected };
}

export interface MailLogEntry {
  id: string;
  at: string;
  email_type: string;
  provider: string;
  recipient: string;
  status: string;
  error: string | null;
  team_code: string | null;
  team_name: string | null;
}

/**
 * The send history, newest first — what actually left the building.
 *
 * Every send already wrote a row here (`logEmail` in lib/email/index.ts); the
 * gap was that nothing ever read them back. A run reported itself in a toast
 * that vanishes, and `MailRun.errors` was returned to the console and dropped
 * on the floor, so three failures inside a run of ninety were indistinguishable
 * from none.
 *
 * Ordered on `created_at` rather than `sent_at`, deliberately: `sent_at` is
 * null on a failure, and the failures are the rows worth reading.
 *
 * Not filtered by type. The OTP mail is not sent from this screen, but it is
 * the one that has actually been failing — 45 `otp_login` sends fell through
 * Resend to SMTP — and hiding it here would hide exactly the signal that says
 * the provider is unwell before a bulk send goes out on top of it.
 */
export async function recentMailLog(limit = 60): Promise<MailLogEntry[]> {
  const { data, error } = await db
    .from('email_logs')
    .select('id, created_at, email_type, provider, recipient, status, error, teams(team_code, team_name)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Reading the mail log failed:', error);
    return [];
  }

  interface LogRow {
    id: string;
    created_at: string;
    email_type: string;
    provider: string;
    recipient: string;
    status: string;
    error: string | null;
    teams: { team_code: string; team_name: string } | null;
  }

  return ((data ?? []) as LogRow[]).map((row) => ({
    id: row.id,
    at: row.created_at,
    email_type: row.email_type,
    provider: row.provider,
    recipient: row.recipient,
    status: row.status,
    error: row.error,
    team_code: row.teams?.team_code ?? null,
    team_name: row.teams?.team_name ?? null,
  }));
}

/** How many teams each button would actually mail, for the confirm dialog. */
export async function mailCounts(): Promise<Record<string, number>> {
  const [announced, shortlistedSent, rejectedSent] = await Promise.all([
    alreadyMailed('screening_announcement'),
    alreadyMailed('screening_shortlisted'),
    alreadyMailed('screening_rejected'),
  ]);

  const teams = await loadTeams();
  const { data: decided } = await db.from('screening_shortlist').select('team_id, result');

  const shortlistedIds = (decided ?? []).filter((r: any) => r.result === 'shortlisted').map((r: any) => r.team_id);
  const rejectedIds = (decided ?? []).filter((r: any) => r.result === 'rejected').map((r: any) => r.team_id);

  return {
    announcement_pending: teams.filter((team) => !announced.has(team.id)).length,
    announcement_sent: announced.size,
    shortlisted_pending: shortlistedIds.filter((id: string) => !shortlistedSent.has(id)).length,
    rejected_pending: rejectedIds.filter((id: string) => !rejectedSent.has(id)).length,
    results_sent: shortlistedSent.size + rejectedSent.size,
  };
}
