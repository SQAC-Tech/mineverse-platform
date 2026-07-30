import { NextResponse } from 'next/server';
import { otpSendSchema } from '@/lib/validation/schemas';
import { rateLimit } from '@/lib/rate-limit';
import { supabaseServer } from '@/lib/supabase/server';
import { sendOtpEmail } from '@/lib/email';
import { generateOtp, hashOtp } from '@/lib/auth/otp';
import { env } from '@/lib/env';
import { verifyTurnstileToken } from '@/lib/turnstile';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const body = await req.json();
  const parsed = otpSendSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: (parsed.error as any).errors[0].message }, { status: 400 });
  }

  const { college_email, turnstile_token } = parsed.data;

  const collegeDomain = process.env.NEXT_PUBLIC_COLLEGE_EMAIL_DOMAIN || '@college.edu.in';
  if (!college_email.toLowerCase().endsWith(collegeDomain.toLowerCase())) {
    return NextResponse.json({ success: false, error: `Use your college email (${collegeDomain})` }, { status: 400 });
  }

  if (!rateLimit('otp:' + college_email, 3, 10 * 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many OTP requests. Wait a few minutes.' }, { status: 429 });
  }

  // Turnstile verification (canonical siteverify with remoteip)
  const turnstileOk = await verifyTurnstileToken(turnstile_token, ip);
  if (!turnstileOk) {
    return NextResponse.json({ success: false, error: 'Captcha verification failed' }, { status: 403 });
  }

  // Reject if already in members
  const { data: existingMember } = await supabaseServer
    .from('members')
    .select('id')
    .eq('college_email', college_email)
    .maybeSingle();

  if (existingMember) {
    return NextResponse.json({ success: false, error: 'This college email is already registered' }, { status: 409 });
  }

  // Delete previous unverified registration challenge for this email
  await supabaseServer.from('otp_challenges')
    .delete()
    .match({ email: college_email, purpose: 'registration' });

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60_000);

  const { data: challenge, error } = await supabaseServer.from('otp_challenges')
    .insert({
      email: college_email,
      otp_hash: hashOtp(otp),
      purpose: 'registration',
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single();

  if (error || !challenge) {
    console.error("OTP Insert Error:", error);
    return NextResponse.json({ success: false, error: 'Database error generating OTP' }, { status: 500 });
  }

  // Attempt to send email, but don't block if it fails during dev
  try {
    await sendOtpEmail({ to: college_email, otp, purpose: 'registration' });
  } catch (e) {
    console.error("Email send error:", e);
  }

  return NextResponse.json({
    success: true,
    challenge_id: challenge.id,
    expires_in: env.OTP_EXPIRY_MINUTES * 60,
    devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined
  });
}
