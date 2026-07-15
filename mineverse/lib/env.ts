import { z } from 'zod';

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM: z.string().min(1),
  // SMTP is optional until the team account is provisioned; smtp.ts degrades
  // to a logged failure instead of crashing every route at import time.
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().optional().default(465),
  SMTP_SECURE: z.string().optional().default('true').transform((val) => val === 'true'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().optional().default(''),
  TURNSTILE_SECRET_KEY: z.string().min(1),
  EVENT_DATE: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  WHATSAPP_GROUP_LINK: z.string().url(),
  UPI_ID: z.string().min(3),
  UPI_PAYEE_NAME: z.string().min(1),
  FEE_SOLO: z.coerce.number(),
  FEE_DUO: z.coerce.number(),
  FEE_TRIO: z.coerce.number(),
  JWT_SECRET: z.string().min(32),
  ATTENDANCE_QR_SECRET: z.string().min(32),
  ADMIN_PASSWORD: z.string().min(8),
  ATTENDANCE_PASSWORD: z.string().min(8),
  OTP_EXPIRY_MINUTES: z.coerce.number().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(3),
});

export const env = serverEnvSchema.parse(process.env);
