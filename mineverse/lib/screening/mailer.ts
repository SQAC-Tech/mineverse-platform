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
}

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

/** The lead is who the OTP goes to, so it is the address the team actually reads. */
function leadEmail(team: TeamWithLead): string | null {
  const lead = team.members?.find((member) => member.is_team_lead) ?? team.members?.[0];
  return lead?.college_email ?? null;
}

/**
 * Sends one type to a set of teams, one at a time.
 *
 * Sequential rather than parallel on purpose: Resend rate-limits, and a burst of
 * 43 that half-fails is worse than a slower run that reports honestly.
 */
async function run(
  kind: MailKind,
  teams: TeamWithLead[],
  send: (team: TeamWithLead, to: string) => Promise<{ success: boolean; error?: string }>,
): Promise<MailRun> {
  const done = await alreadyMailed(kind);
  const result: MailRun = { attempted: 0, sent: 0, skipped: 0, failed: 0, errors: [] };

  for (const team of teams) {
    if (done.has(team.id)) { result.skipped += 1; continue; }

    const to = leadEmail(team);
    if (!to) {
      result.skipped += 1;
      result.errors.push(`${team.team_code}: no lead email`);
      continue;
    }

    result.attempted += 1;
    try {
      const outcome = await send(team, to);
      if (outcome.success) result.sent += 1;
      else {
        result.failed += 1;
        result.errors.push(`${team.team_code}: ${outcome.error ?? 'send failed'}`);
      }
    } catch (error) {
      result.failed += 1;
      result.errors.push(`${team.team_code}: ${(error as Error).message}`);
    }
  }

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
  });

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
  });

  return { shortlisted, rejected };
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
