import nodemailer from 'nodemailer';
import { env } from '@/lib/env';
import type { EmailAttachment, TransportResult } from './types';

const smtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    })
  : null;

export async function sendSmtpEmail({
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
  if (!transporter) {
    console.warn(`SMTP not configured — skipping email "${subject}" to ${to}`);
    return { success: false, error: 'SMTP not configured' };
  }
  try {
    const info = await transporter.sendMail({
      from: env.SMTP_FROM || env.SMTP_USER,
      to,
      subject,
      html,
      attachments,
    });
    return { success: true, id: info.messageId };
  } catch (error: any) {
    console.error('SMTP error:', error);
    return { success: false, error: error?.message ?? 'SMTP send failed' };
  }
}
