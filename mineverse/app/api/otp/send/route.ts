import { NextResponse } from 'next/server';
import { otpSendSchema } from '@/lib/validation/schemas';
import { rateLimit } from '@/lib/rate-limit';
import { supabaseServer } from '@/lib/supabase/server';
import { sendOtpEmail } from '@/lib/email';
import { generateOtp, hashOtp } from '@/lib/auth/otp';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const body = await req.json();
  const parsed = otpSendSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: (parsed.error as any).errors[0].message }, { status: 400 });
  }

  const { college_email, turnstile_token } = parsed.data;

  if (!rateLimit('otp:' + college_email, 3, 10 * 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many OTP requests. Wait a few minutes.' }, { status: 429 });
  }

  // Turnstile verification
  const formData = new URLSearchParams();
  formData.append('secret', env.TURNSTILE_SECRET_KEY);
  formData.append('response', turnstile_token);

  const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
  });
  const turnstileData = await turnstileRes.json();
  
  // NOTE: For local dev without real turnstile, we might need a bypass, but sticking to PRD
  if (!turnstileData.success && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, error: 'Captcha verification failed' }, { status: 400 });
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

  const { data: challenge } = await supabaseServer.from('otp_challenges')
    .insert({
      email: college_email,
      otp_hash: hashOtp(otp),
      purpose: 'registration',
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single();

  await sendOtpEmail({ to: college_email, otp, purpose: 'registration' });

  return NextResponse.json({
    success: true,
    challenge_id: challenge!.id,
    expires_in: env.OTP_EXPIRY_MINUTES * 60,
  });
}
