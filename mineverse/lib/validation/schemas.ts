import { z } from 'zod';
import { REGISTRATION_NO } from '@/lib/registration-no';

export { REGISTRATION_NO };

const collegeDomain = process.env.NEXT_PUBLIC_COLLEGE_EMAIL_DOMAIN || '@college.edu.in';

export const registrationNoSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(REGISTRATION_NO, { message: 'Pick your year and enter all 11 digits of your registration number' });

export const memberSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  college_email: z.string().email().refine(
    (e) => e.toLowerCase().endsWith(collegeDomain),
    { message: `Must be a ${collegeDomain} email` }
  ),
  phone: z.string().regex(/^[6-9]\d{9}$/, { message: 'Invalid Indian phone number' }),
  section: z.string().max(10).optional(),
  department: z.string().trim().min(1, { message: 'Enter your department' }).max(100),
  registration_no: registrationNoSchema,
  is_team_lead: z.boolean(),
});

export const otpSendSchema = z.object({
  college_email: z.string().email(),
  turnstile_token: z.string().min(1, { message: 'Complete the captcha' }),
});

export const otpVerifySchema = z.object({
  challenge_id: z.string().uuid(),
  otp: z.string().regex(/^\d{6}$/),
});

export const registrationSchema = z.object({
  honeypot: z.literal(''),
  challenge_id: z.string().uuid(),
  verification_token: z.string().uuid(),
  turnstile_token: z.string().min(1, { message: 'Complete the captcha' }),
  team_name: z.string().min(3).max(50),
  transaction_id: z.string()
    .trim()
    .min(6, { message: 'Enter the UPI transaction/reference ID' })
    .max(50)
    .regex(/^[A-Za-z0-9-]+$/, { message: 'Transaction ID can only contain letters, numbers and dashes' }),
  sender_name: z.string().trim().min(2, { message: 'Enter the name on the paying UPI account' }).max(50),
  // Solo entries are not accepted — a team is either a duo or a trio.
  members: z.array(memberSchema)
    .min(2, { message: 'A team needs at least 2 members — solo entries are not allowed' })
    .max(3, { message: 'A team can have at most 3 members' })
    .refine((m) => m.filter(x => x.is_team_lead).length === 1 && m[0].is_team_lead,
      { message: 'First member must be the team lead' })
    .refine((m) => new Set(m.map(x => x.college_email.toLowerCase())).size === m.length,
      { message: 'Duplicate college emails within team' })
    // `members` is UNIQUE (team_id, email), so a shared personal email is a
    // database error waiting to happen — catch it here where the message is
    // useful instead of letting the insert blow up mid-registration.
    .refine((m) => new Set(m.map(x => x.email.toLowerCase())).size === m.length,
      { message: 'Each member needs their own personal email' })
    .refine((m) => new Set(m.map(x => x.registration_no)).size === m.length,
      { message: 'Duplicate registration numbers within team' }),
});
