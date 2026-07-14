import nodemailer from 'nodemailer';
import { env } from '@/lib/env';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export async function sendSmtpEmail({
  to,
  subject,
  html,
  attachments
}: {
  to: string;
  subject: string;
  html: string;
  attachments?: any[];
}) {
  try {
    const info = await transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      html,
      attachments,
    });
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('SMTP error:', error);
    return { success: false, error: error.message };
  }
}
