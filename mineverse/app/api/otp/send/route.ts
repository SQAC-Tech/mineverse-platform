import { NextResponse } from 'next/server';
import { otpSendSchema } from '@/lib/validation/schemas';
import { consumeRateLimit, retryHint, tooManyRequests } from '@/lib/rate-limit';
import { clientIp } from '@/lib/request-ip';
import { supabaseServer } from '@/lib/supabase/server';
import { sendOtpEmail } from '@/lib/email';
import { generateOtp, hashOtp } from '@/lib/auth/otp';
import { env } from '@/lib/env';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { isRegistrationOpen } from '@/lib/platform/settings';

export async function POST(req: Request) {
  const ip = clientIp(req);

  /**
   * Step one of registration, so it closes when registration does.
   *
   * `/api/register` was gated and this was not, which left the door open one
   * step further back: a closed form still mailed a verification code to
   * anybody who asked, and only refused at the final submit. That spends real
   * mail on people who cannot register, and tells them registration is live.
   *
   * Checked before the rate limit and before the body is read — the same order
   * as `/api/register`, because a closed form has nothing to say about a
   * malformed payload or a spent budget.
   */
  if (!(await isRegistrationOpen())) {
    return NextResponse.json(
      { success: false, error: 'Registrations are closed. Contact the organizers if you think this is a mistake.' },
      { status: 403 },
    );
  }

  const body = await req.json();
  const parsed = otpSendSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { college_email, turnstile_token } = parsed.data;

  const collegeDomain = process.env.NEXT_PUBLIC_COLLEGE_EMAIL_DOMAIN || '@college.edu.in';
  if (!college_email.toLowerCase().endsWith(collegeDomain.toLowerCase())) {
    return NextResponse.json({ success: false, error: `Use your college email (${collegeDomain})` }, { status: 400 });
  }

  // Keyed on the mailbox we are about to send to, which is the right axis: it
  // survives the whole campus sharing one public IP, and the thing being
  // rationed is somebody's inbox. Lowercased, or the same address in a different
  // case would hand out a fresh budget.
  const perEmail = consumeRateLimit(`otp:${college_email.toLowerCase()}`, 3, 10 * 60_000);
  if (!perEmail.allowed) {
    return tooManyRequests(
      `Too many OTP requests for this email. Try again in ${retryHint(perEmail.retryAfterSeconds)}.`,
      perEmail.retryAfterSeconds,
    );
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
    expires_in: env.OTP_EXPIRY_MINUTES * 60
  });
}
