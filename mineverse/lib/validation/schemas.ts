import { z } from 'zod';

const collegeDomain = process.env.NEXT_PUBLIC_COLLEGE_EMAIL_DOMAIN || '@college.edu.in';

export const memberSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  college_email: z.string().email().refine(
    (e) => e.toLowerCase().endsWith(collegeDomain),
    { message: `Must be a ${collegeDomain} email` }
  ),
  phone: z.string().regex(/^[6-9]\d{9}$/, { message: 'Invalid Indian phone number' }),
  section: z.string().max(10).optional(),
  department: z.enum(['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'OTHER']),
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
  team_name: z.string().min(3).max(50),
  members: z.array(memberSchema).min(1).max(3)
    .refine((m) => m.filter(x => x.is_team_lead).length === 1 && m[0].is_team_lead,
      { message: 'First member must be the team lead' })
    .refine((m) => new Set(m.map(x => x.college_email.toLowerCase())).size === m.length,
      { message: 'Duplicate college emails within team' }),
});
