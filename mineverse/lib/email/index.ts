import { sendResendEmail } from './resend';
import { sendSmtpEmail } from './smtp';
import type { EmailAttachment } from './types';
import { supabaseServer } from '@/lib/supabase/server';
import { env } from '@/lib/env';

export type EmailResult = { success: boolean; error?: string };

async function logEmail(type: string, provider: 'resend'|'smtp', to: string, subject: string, success: boolean, err?: string, teamId?: string, memberId?: string) {
  await supabaseServer.from('email_logs').insert({
    team_id: teamId || null,
    member_id: memberId || null,
    email_type: type,
    provider,
    recipient: to,
    subject,
    status: success ? 'sent' : 'failed',
    error: err,
    sent_at: success ? new Date().toISOString() : null,
  });
}

/**
 * Sends through Resend, falling back to SMTP only if Resend refuses.
 *
 * Gmail SMTP caps daily sends, which is the wrong ceiling to sit under on
 * event day, so the transactional provider goes first and the mailbox is the
 * safety net. Each attempt is logged separately: a failed `resend` row
 * followed by a `smtp` row is how you spot the fallback carrying traffic
 * rather than it silently becoming the primary again.
 */
/**
 * Exported so the screening templates can live in their own file — index.ts is
 * already long, and those three are a self-contained set.
 */
export async function deliver({
  type, to, subject, html, attachments, teamId, memberId, via = 'auto',
}: {
  type: string;
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
  teamId?: string;
  memberId?: string;
  /**
   * Which transport to use.
   *
   * `auto` is Resend first, SMTP as the net — right for the one-at-a-time mail
   * (OTP, payment confirmations) where latency matters and volume does not.
   *
   * `smtp` skips Resend entirely, and is what the bulk sends use. Resend's
   * daily allowance is smaller than one run of ninety: on 22 Aug it took 206
   * and then refused 41 with `daily_quota_exceeded`, and every one of those
   * fell through to SMTP anyway, a second late and after a wasted API call.
   * Going straight to SMTP means a bulk run cannot spend the allowance the
   * OTPs need — a team that cannot receive a login code cannot play, and a
   * team that gets its result mail an hour later has lost nothing.
   */
  via?: 'auto' | 'smtp';
}): Promise<EmailResult> {
  if (via === 'smtp') {
    const only = await sendSmtpEmail({ to, subject, html, attachments });
    await logEmail(type, 'smtp', to, subject, only.success, only.error, teamId, memberId);
    return only.success ? { success: true } : { success: false, error: `SMTP: ${only.error}` };
  }

  const viaResend = await sendResendEmail({ to, subject, html, attachments });
  await logEmail(type, 'resend', to, subject, viaResend.success, viaResend.error, teamId, memberId);
  if (viaResend.success) return { success: true };

  const viaSmtp = await sendSmtpEmail({ to, subject, html, attachments });
  await logEmail(type, 'smtp', to, subject, viaSmtp.success, viaSmtp.error, teamId, memberId);
  if (viaSmtp.success) return { success: true };

  return { success: false, error: `Resend: ${viaResend.error} | SMTP: ${viaSmtp.error}` };
}

// ─── MINECRAFT THEME HELPERS (DARK MODE SAFE) ─────────────────────────────────
// By using pure black (#000000) and white (#ffffff), Gmail's dark mode
// will NOT invert the colors, guaranteeing perfect readability.

export function mcLayout(inner: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MINEVERSE</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
  .pixel { font-family: 'VT323', 'Courier New', Courier, monospace !important; }
  .sans { font-family: system-ui, -apple-system, sans-serif !important; }
</style>
</head>
<body style="margin: 0; padding: 0; background-color: #000000;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#000000" style="background-color: #000000;">
    <tr>
      <td align="center" style="padding: 40px 10px;">
        
        <!-- MAIN CONTAINER -->
        <table border="0" cellpadding="0" cellspacing="0" bgcolor="#111111" style="max-width: 600px; width: 100%; background-color: #111111; border: 2px solid #333333;">
          
          <!-- HEADER -->
          <tr>
            <td align="center" bgcolor="#0a0a0a" style="padding: 40px 20px; background-color: #0a0a0a; border-bottom: 2px solid #333333;">
              <h1 class="pixel" style="margin: 0; color: #ffffff; font-size: 48px; font-weight: normal; letter-spacing: 6px;">MINEVERSE</h1>
              <p class="pixel" style="margin: 10px 0 0 0; color: #fca311; font-size: 20px; letter-spacing: 4px;">A CODING ADVENTURE</p>
            </td>
          </tr>
          
          <!-- CONTENT -->
          <tr>
            <td class="sans" style="padding: 40px 30px; color: #ffffff; font-size: 16px; line-height: 1.6;">
              ${inner}
            </td>
          </tr>
          
          <!-- FOOTER -->
          <tr>
            <td align="center" bgcolor="#0a0a0a" class="pixel" style="padding: 30px; background-color: #0a0a0a; border-top: 2px solid #333333; color: #888888; font-size: 18px; letter-spacing: 2px;">
              GEAR UP. CODE ON. CONQUER.<br>
              <a href="mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL || ''}" style="color: #4ade80; text-decoration: none; margin-top: 10px; display: inline-block;">CONTACT SUPPORT</a>
            </td>
          </tr>
          
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function mcTitle(text: string) {
  return `<h2 class="pixel" style="color: #4ade80; font-size: 32px; margin: 0 0 20px 0; font-weight: normal; letter-spacing: 2px;">> ${text}</h2>`;
}

function mcCodeBox(code: string) {
  return `
<table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
  <tr>
    <td align="center" bgcolor="#000000" style="background-color: #000000; border: 2px solid #333333; padding: 24px;">
      <div class="pixel" style="color: #fde047; font-size: 48px; letter-spacing: 12px; font-weight: bold;">
        ${code}
      </div>
    </td>
  </tr>
</table>
`;
}

export function mcButton(text: string, url: string, color = '#3e8e2b') {
  return `
<table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
  <tr>
    <td align="center">
      <a href="${url}" class="pixel" style="background-color: ${color}; color: #ffffff; padding: 16px 32px; text-decoration: none; font-size: 24px; display: inline-block; border: 2px solid #ffffff;">
        ${text}
      </a>
    </td>
  </tr>
</table>
`;
}

export function mcRow(label: string, value: string) {
  return `
<tr>
  <td class="pixel" style="padding: 12px 0; color: #a3a3a3; font-size: 20px; border-bottom: 1px dashed #333333;">${label}</td>
  <td class="sans" style="padding: 12px 0; color: #ffffff; font-size: 16px; font-weight: bold; text-align: right; border-bottom: 1px dashed #333333;">${value}</td>
</tr>
`;
}

// ══════════════════════════════════════════════════════════════════════════════
//  EMAIL FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

export async function sendOtpEmail({
  to, otp, purpose, team_id
}: {
  to: string; otp: string; purpose: 'registration' | 'login';
  team_id?: string;
}): Promise<EmailResult> {
  const isReg = purpose === 'registration';
  const subject = isReg 
    ? `[MINEVERSE] Registration OTP: ${otp}`
    : `[MINEVERSE] Login OTP: ${otp}`;
    
  const html = mcLayout(`
    ${mcTitle(isReg ? 'EMAIL VERIFICATION' : 'LOGIN VERIFICATION')}
    <p>You're one step away from ${isReg ? 'registering for' : 'logging into'} MINEVERSE! Use the code below to verify your college email address.</p>
    
    ${mcCodeBox(otp)}
    
    <p style="color: #a3a3a3; font-size: 14px;">This code expires in <strong style="color: #fca311;">${env.OTP_EXPIRY_MINUTES} minutes</strong>. Do not share it with anyone.</p>
  `);

  return deliver({ type: `otp_${purpose}`, to, subject, html, teamId: team_id });
}

export async function sendRegistrationReceivedEmail({
  to, team_name, team_code, amount, team_id, transaction_id
}: {
  to: string; team_name: string; team_code: string; amount: number; team_id: string;
  transaction_id: string;
}): Promise<EmailResult> {
  const subject = `[MINEVERSE] Registration Received — Team ${team_code}`;
  const statusUrl = `${process.env.NEXT_PUBLIC_APP_URL}/payment?team=${team_code}`;
  
  const html = mcLayout(`
    ${mcTitle('QUEST ACCEPTED')}
    <p>Welcome to MINEVERSE, team <strong style="color: #fca311;">${team_name}</strong>!</p>
    <p>Your registration has been received. Your payment is currently being verified by the organizers.</p>
    
    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
      ${mcRow('Team Code', `<span class="pixel" style="color:#fde047; font-size:24px;">${team_code}</span>`)}
      ${mcRow('Amount Paid', `₹${amount}`)}
      ${mcRow('Transaction ID', transaction_id)}
      ${mcRow('Status', '<span style="color:#f97316;">Pending Verification ⏳</span>')}
    </table>
    
    <p style="margin-top: 30px;">You can check your team's verification status below:</p>
    
    ${mcButton('CHECK STATUS', statusUrl)}
  `);

  return deliver({ type: 'reg_pending', to, subject, html, teamId: team_id });
}

export async function sendPaymentVerifiedEmail({
  to, member_id, team_id, team_name, team_code, qr_image_data_url
}: {
  to: string; member_id: string; team_id: string; team_name: string; team_code: string;
  qr_image_data_url: string;
}): Promise<EmailResult> {
  const subject = `[MINEVERSE] ✅ Payment Verified — Team ${team_code}`;
  
  const base64Data = qr_image_data_url.replace(/^data:image\/png;base64,/, "");
  const qrBuffer = Buffer.from(base64Data, 'base64');

  const html = mcLayout(`
    ${mcTitle('PAYMENT VERIFIED')}
    <p>The payment for team <strong style="color: #fca311;">${team_name} (${team_code})</strong> has been verified. You are now officially registered!</p>
    
    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
      ${mcRow('Date', process.env.NEXT_PUBLIC_EVENT_DATE_DISPLAY || '')}
      ${mcRow('Time', process.env.NEXT_PUBLIC_EVENT_TIME || '')}
      ${mcRow('Venue', process.env.NEXT_PUBLIC_EVENT_VENUE || '')}
    </table>
    
    <h3 class="pixel" style="color: #fca311; font-size: 24px; font-weight: normal; margin-top: 40px; border-bottom: 2px solid #333333; padding-bottom: 10px;">> YOUR ATTENDANCE QR</h3>
    <p>Present this QR code at the event entrance. Keep it safe!</p>
    
    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
      <tr>
        <td align="center">
          <img src="cid:attendance-qr" alt="Attendance QR" style="max-width:250px; border:2px solid #ffffff; padding:10px; background-color:#ffffff;" />
        </td>
      </tr>
    </table>
    
    ${mcButton('JOIN WHATSAPP GROUP', env.WHATSAPP_GROUP_LINK, '#25D366')}
  `);

  const attachments = [{
    filename: `attendance-${team_code}.png`,
    content: qrBuffer,
    cid: 'attendance-qr'
  }];

  return deliver({
    type: 'payment_verified', to, subject, html, attachments,
    teamId: team_id, memberId: member_id,
  });
}

export async function sendPaymentIssueEmail({
  to, team_id, team_code, reason
}: {
  to: string; team_id: string; team_code: string; reason?: string;
}): Promise<EmailResult> {
  const subject = `[MINEVERSE] ⚠️ Payment Issue — Team ${team_code}`;
  const html = mcLayout(`
    ${mcTitle('PAYMENT ISSUE')}
    <p>We noticed an issue verifying the payment for team <strong style="color: #fca311;">${team_code}</strong>.</p>
    
    ${reason ? `
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
        <tr>
          <td bgcolor="#220000" style="background-color: #220000; border: 2px solid #ff4444; padding: 24px;">
            <strong class="pixel" style="color: #ff4444; font-size: 20px;">NOTE FROM ADMIN:</strong><br><br>
            <span style="color: #ffffff;">${reason}</span>
          </td>
        </tr>
      </table>
    ` : ''}
    
    <p>Please contact us at <strong style="color: #4ade80;">${process.env.NEXT_PUBLIC_CONTACT_EMAIL}</strong> for assistance or try paying again.</p>
  `);

  return deliver({ type: 'payment_issue', to, subject, html, teamId: team_id });
}
