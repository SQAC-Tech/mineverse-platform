import { deliver, mcButton, mcLayout, mcRow, mcTitle, type EmailResult } from './index';
import { env } from '@/lib/env';

/**
 * The three screening mails.
 *
 * Kept out of index.ts because they are a self-contained set with a shared
 * constraint the others do not have: none of them may state how the paper was
 * scored. The weights, the first-year bonus and the tiebreak are organiser-only,
 * and a mail is the easiest place for them to leak.
 */

/** The window as a human would say it, in the timezone everyone reading is in. */
function istWindow(startsAt: string | null, endsAt: string | null) {
  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          weekday: 'short', day: 'numeric', month: 'short',
          hour: '2-digit', minute: '2-digit', hour12: true,
        })
      : '—';
  return `${fmt(startsAt)} to ${fmt(endsAt)} IST`;
}

/**
 * The pre-round announcement.
 *
 * States the mechanics and exactly one selection criterion — answer correctly,
 * submit early. Nothing about difficulty weights or bonuses: a team that learns
 * the five hard questions pay double will farm those and skip twenty.
 */
export async function sendScreeningAnnouncementEmail({
  to, team_id, team_name, team_code, starts_at, ends_at, duration_minutes, question_count,
}: {
  to: string; team_id: string; team_name: string; team_code: string;
  starts_at: string | null; ends_at: string | null;
  duration_minutes: number; question_count: number;
}): Promise<EmailResult> {
  const subject = `[MINEVERSE] Screening Round — ${question_count} questions, ${duration_minutes} minutes`;
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/login`;

  const html = mcLayout(`
    ${mcTitle('THE SCREENING ROUND')}
    <p>Team <strong style="color: #fca311;">${team_name} (${team_code})</strong> — before the event itself, there is one qualifier to clear.</p>

    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
      ${mcRow('Open', istWindow(starts_at, ends_at))}
      ${mcRow('Questions', `${question_count} multiple choice`)}
      ${mcRow('Time limit', `${duration_minutes} minutes`)}
      ${mcRow('Attempts', '1 per team')}
      ${mcRow('Coding required', 'None')}
    </table>

    <h3 class="pixel" style="color: #fca311; font-size: 24px; font-weight: normal; margin-top: 40px; border-bottom: 2px solid #333333; padding-bottom: 10px;">&gt; HOW TEAMS ARE PICKED</h3>
    <p><strong style="color: #4ade80;">Answer correctly, and submit early.</strong> Both count. Only a limited number of teams move on to the event, so do not leave it to the last hour.</p>

    <h3 class="pixel" style="color: #fca311; font-size: 24px; font-weight: normal; margin-top: 40px; border-bottom: 2px solid #333333; padding-bottom: 10px;">&gt; BEFORE YOU START</h3>
    <p>You may start any time inside the window, and your ${duration_minutes} minutes run from the moment you do — even if you start close to the end. You will not be cut off part-way.</p>
    <p>Sit it on a laptop, on a stable connection, with one member driving. The round runs in fullscreen and is proctored: tab switches, copy, paste and right-click are blocked and recorded.</p>
    <p>There is no negative marking, and answers save as you pick them, so a refresh will not lose your work.</p>

    ${mcButton('OPEN MINEVERSE', url)}

    <p style="color: #a3a3a3; font-size: 14px;">Log in with your team code. The OTP goes to the team lead&rsquo;s college email, as always.</p>
  `);

  return deliver({ type: 'screening_announcement', to, subject, html, teamId: team_id });
}

/** Congratulations, roster, attendance QR and what to bring. */
export async function sendScreeningShortlistedEmail({
  to, team_id, team_name, team_code, members, qr_image_data_url,
}: {
  to: string; team_id: string; team_name: string; team_code: string;
  members: Array<{ name: string; registration_no: string | null; is_team_lead: boolean }>;
  qr_image_data_url: string;
}): Promise<EmailResult> {
  const subject = `[MINEVERSE] You are in — Team ${team_code} qualified`;

  const roster = members
    .map((member) => `
      <tr>
        <td class="sans" style="padding: 10px 0; color: #ffffff; font-size: 15px; border-bottom: 1px dashed #333333;">
          ${member.name}${member.is_team_lead ? ' <span style="color:#4ade80; font-size:12px;">(LEAD)</span>' : ''}
        </td>
        <td class="pixel" style="padding: 10px 0; color: #a3a3a3; font-size: 18px; text-align: right; border-bottom: 1px dashed #333333;">
          ${member.registration_no ?? ''}
        </td>
      </tr>`)
    .join('');

  const qrBuffer = Buffer.from(qr_image_data_url.replace(/^data:image\/png;base64,/, ''), 'base64');

  const html = mcLayout(`
    ${mcTitle('YOU MADE THE CUT')}
    <p>Team <strong style="color: #fca311;">${team_name} (${team_code})</strong> cleared the screening round. You are through to MINEVERSE.</p>
    <p>Your opening resources are already in your team inventory — you will see them the moment Round 1 unlocks.</p>

    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
      ${mcRow('Date', process.env.NEXT_PUBLIC_EVENT_DATE_DISPLAY || '')}
      ${mcRow('Reporting time', process.env.NEXT_PUBLIC_EVENT_TIME || '')}
      ${mcRow('Venue', process.env.NEXT_PUBLIC_EVENT_VENUE || '')}
      ${mcRow('Team code', `<span class="pixel" style="color:#fde047; font-size:24px;">${team_code}</span>`)}
    </table>

    <h3 class="pixel" style="color: #fca311; font-size: 24px; font-weight: normal; margin-top: 40px; border-bottom: 2px solid #333333; padding-bottom: 10px;">&gt; YOUR TEAM</h3>
    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      ${roster}
    </table>

    <h3 class="pixel" style="color: #fca311; font-size: 24px; font-weight: normal; margin-top: 40px; border-bottom: 2px solid #333333; padding-bottom: 10px;">&gt; YOUR ATTENDANCE QR</h3>
    <p>Show this at the desk when you arrive. One scan checks in the whole team, so save it on the lead&rsquo;s phone.</p>
    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
      <tr>
        <td align="center">
          <img src="cid:attendance-qr" alt="Attendance QR for team ${team_code}" style="max-width:250px; border:2px solid #ffffff; padding:10px; background-color:#ffffff;" />
        </td>
      </tr>
    </table>

    <h3 class="pixel" style="color: #fca311; font-size: 24px; font-weight: normal; margin-top: 40px; border-bottom: 2px solid #333333; padding-bottom: 10px;">&gt; WHAT TO BRING</h3>
    <p>Your college ID, at least one charged laptop per team with its charger, and this QR. Everything else is on the platform.</p>
    <p>Arrive at the reporting time rather than the start time — check-in takes a few minutes, and Round 1 will not wait.</p>

    ${mcButton('JOIN WHATSAPP GROUP', env.WHATSAPP_GROUP_LINK, '#25D366')}
  `);

  return deliver({
    type: 'screening_shortlisted', to, subject, html, teamId: team_id,
    attachments: [{ filename: `attendance-${team_code}.png`, content: qrBuffer, cid: 'attendance-qr' }],
  });
}

/**
 * The one nobody enjoys sending.
 *
 * No score and no rank. A number invites an argument that cannot be won by
 * email on the 23rd, and it tells the team nothing they can act on.
 */
export async function sendScreeningRejectedEmail({
  to, team_id, team_name, team_code,
}: {
  to: string; team_id: string; team_name: string; team_code: string;
}): Promise<EmailResult> {
  const subject = `[MINEVERSE] Screening round result — Team ${team_code}`;

  const html = mcLayout(`
    ${mcTitle('NOT THIS TIME')}
    <p>Team <strong style="color: #fca311;">${team_name} (${team_code})</strong> — thank you for sitting the screening round.</p>
    <p>We had many more teams than seats, and this time you did not make the cut. That is a decision about one 30-minute paper, and nothing more than that.</p>
    <p>We would genuinely like to see you at the next one. Keep an eye on the club announcements — there will be another.</p>
    <p style="color: #a3a3a3; font-size: 14px; margin-top: 30px;">If something went wrong on the day — a crash, a power cut, anything — reply to this email and tell us. We would rather hear it than not.</p>
  `);

  return deliver({ type: 'screening_rejected', to, subject, html, teamId: team_id });
}
