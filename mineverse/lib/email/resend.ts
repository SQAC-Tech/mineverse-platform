import { Resend } from 'resend';
import { env } from '@/lib/env';

const resend = new Resend(env.RESEND_API_KEY);

export async function sendResendEmail({
  to,
  subject,
  html
}: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    const data = await resend.emails.send({
      from: env.RESEND_FROM,
      to,
      subject,
      html,
    });
    return { success: true, data };
  } catch (error: any) {
    console.error('Resend error:', error);
    return { success: false, error: error.message };
  }
}
