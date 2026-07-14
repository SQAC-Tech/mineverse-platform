import { sendResendEmail } from './resend';
import { sendSmtpEmail } from './smtp';
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

/** OTP mail — Resend. purpose: 'registration' | 'login' */
export async function sendOtpEmail({
  to, otp, purpose, team_id
}: {
  to: string; otp: string; purpose: 'registration' | 'login';
  team_id?: string;
}): Promise<EmailResult> {
  const subject = purpose === 'registration' 
    ? `Your MINEVERSE Registration OTP: ${otp}`
    : `Your MINEVERSE Login OTP: ${otp}`;
    
  const html = `
    <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; padding: 32px; border-radius: 8px;">
      <h1 style="color: #34d399; margin-bottom: 24px;">MINEVERSE Authentication</h1>
      <p style="font-size: 16px; margin-bottom: 24px;">Your One-Time Password for ${purpose} is:</p>
      <div style="background: #1e293b; padding: 16px; font-size: 32px; font-weight: bold; text-align: center; letter-spacing: 4px; border-radius: 4px; margin-bottom: 24px;">
        ${otp}
      </div>
      <p style="font-size: 14px; color: #94a3b8;">This code expires in ${env.OTP_EXPIRY_MINUTES} minutes. If you did not request this, please ignore this email.</p>
    </div>
  `;

  const res = await sendResendEmail({ to, subject, html });
  await logEmail(`otp_${purpose}`, 'resend', to, subject, res.success, res.error, team_id);
  return res;
}

/** SMTP — registration received (payment pending). */
export async function sendRegistrationReceivedEmail({
  to, team_name, team_code, amount, team_id
}: {
  to: string; team_name: string; team_code: string; amount: number; team_id: string;
}): Promise<EmailResult> {
  const subject = `Registration Received - MINEVERSE (Team ${team_code})`;
  const html = `
    <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; padding: 20px;">
      <h2>Welcome to MINEVERSE, ${team_name}!</h2>
      <p>We have received your registration details. Your team code is <strong>${team_code}</strong>.</p>
      <p>Please complete your payment of <strong>₹${amount}</strong> to finalize your registration.</p>
      <p>You can check your payment status and get the payment QR here:</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/payment?team=${team_code}" style="display:inline-block;background:#10b981;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Go to Payment Page</a>
    </div>
  `;

  const res = await sendSmtpEmail({ to, subject, html });
  await logEmail('reg_pending', 'smtp', to, subject, res.success, res.error, team_id);
  return res;
}

/** SMTP — payment verified, sent to every member. Includes QR + WhatsApp + venue. */
export async function sendPaymentVerifiedEmail({
  to, member_id, team_id, team_name, team_code, qr_image_data_url
}: {
  to: string; member_id: string; team_id: string; team_name: string; team_code: string;
  qr_image_data_url: string;
}): Promise<EmailResult> {
  const subject = `Payment Verified - MINEVERSE 2026`;
  
  // Convert Data URL to Buffer
  const base64Data = qr_image_data_url.replace(/^data:image\/png;base64,/, "");
  const qrBuffer = Buffer.from(base64Data, 'base64');

  const html = `
    <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; padding: 20px;">
      <h2>Payment Verified! 🎉</h2>
      <p>Hello! The payment for team <strong>${team_name} (${team_code})</strong> has been successfully verified.</p>
      <p>Please join our official WhatsApp group for all announcements:</p>
      <a href="${env.WHATSAPP_GROUP_LINK}" style="display:inline-block;background:#25D366;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Join WhatsApp Group</a>
      
      <h3 style="margin-top:30px;">Your Attendance QR Code</h3>
      <p>This QR code is required for attendance on the day of the event. Keep it safe!</p>
      <img src="cid:attendance-qr" alt="Attendance QR" style="max-width:250px;border:1px solid #ccc;border-radius:10px;padding:10px;" />
      
      <div style="margin-top:30px;padding:15px;background:#f8fafc;border-left:4px solid #3b82f6;">
        <p><strong>Date:</strong> ${process.env.NEXT_PUBLIC_EVENT_DATE_DISPLAY}</p>
        <p><strong>Time:</strong> ${process.env.NEXT_PUBLIC_EVENT_TIME}</p>
        <p><strong>Venue:</strong> ${process.env.NEXT_PUBLIC_EVENT_VENUE}</p>
      </div>
    </div>
  `;

  const attachments = [{
    filename: `attendance-${team_code}.png`,
    content: qrBuffer,
    cid: 'attendance-qr'
  }];

  const res = await sendSmtpEmail({ to, subject, html, attachments });
  await logEmail('payment_verified', 'smtp', to, subject, res.success, res.error, team_id, member_id);
  return res;
}

/** SMTP — payment problem / unverified notice. */
export async function sendPaymentIssueEmail({
  to, team_id, team_code, reason
}: {
  to: string; team_id: string; team_code: string; reason?: string;
}): Promise<EmailResult> {
  const subject = `Payment Issue - MINEVERSE (Team ${team_code})`;
  const html = `
    <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; padding: 20px;">
      <h2>Payment Issue</h2>
      <p>We noticed an issue verifying the payment for team <strong>${team_code}</strong>.</p>
      ${reason ? `<p><strong>Note from admin:</strong> ${reason}</p>` : ''}
      <p>Please contact us at ${process.env.NEXT_PUBLIC_CONTACT_EMAIL} for assistance or try paying again.</p>
    </div>
  `;

  const res = await sendSmtpEmail({ to, subject, html });
  await logEmail('payment_issue', 'smtp', to, subject, res.success, res.error, team_id);
  return res;
}
