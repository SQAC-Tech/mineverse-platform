import { Resend } from 'resend';
import { env } from '@/lib/env';
import type { EmailAttachment, TransportResult } from './types';

const resend = new Resend(env.RESEND_API_KEY);

export async function sendResendEmail({
  to,
  subject,
  html,
  attachments,
}: {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<TransportResult> {
  try {
    const { data, error } = await resend.emails.send({
      from: env.RESEND_FROM,
      to,
      subject,
      html,
      // Nodemailer calls it `cid`, Resend calls it `contentId`; both render the
      // image inline where the HTML references `cid:<value>`.
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentId: a.cid,
      })),
    });

    // The SDK resolves rather than throws on an API-level rejection (bad
    // domain, rate limit, suppressed recipient), so the error object has to be
    // checked explicitly — otherwise a refused send looks like a delivery and
    // the SMTP fallback never runs.
    if (error) {
      console.error('Resend rejected the send:', error);
      return { success: false, error: `${error.name}: ${error.message}` };
    }

    return { success: true, id: data?.id };
  } catch (error: any) {
    console.error('Resend error:', error);
    return { success: false, error: error?.message ?? 'Resend request failed' };
  }
}
