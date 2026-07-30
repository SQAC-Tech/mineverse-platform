import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { sendOtpEmail } from '@/lib/email';
import { generateOtp, hashOtp, isEventDay } from '@/lib/auth/otp';
import { env } from '@/lib/env';
import { verifyTurnstileToken } from '@/lib/turnstile';

/**
 * Normalise team-code to canonical MNV-XXX format on the server side.
 * Strips all non-alphanumeric chars, uppercases, and re-inserts the dash.
 */
function normalizeTeamCode(raw: string): string {
  const stripped = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (stripped.length > 3 && stripped.startsWith('MNV')) {
    return `${stripped.slice(0, 3)}-${stripped.slice(3)}`;
  }
  return stripped;
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit('login-otp:' + ip, 5, 10 * 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
  }

  const { team_code: rawTeamCode, turnstile_token } = await req.json();
  if (!rawTeamCode) return NextResponse.json({ success: false, error: 'Team code required' }, { status: 400 });

  const team_code = normalizeTeamCode(rawTeamCode);

  // MNV-000 is the seeded demo team: fixed OTP 000000, no email, no gates.
  // It always has dashboard access (developer mode) — no event-day restriction.
  const isDemoTeam = team_code === 'MNV-000';

  // Turnstile verification — skip for demo team so devs can test without CAPTCHA
  if (!isDemoTeam) {
    if (!turnstile_token) {
      return NextResponse.json({ success: false, error: 'Captcha token required' }, { status: 400 });
    }
    const turnstileOk = await verifyTurnstileToken(turnstile_token, ip);
    if (!turnstileOk) {
      return NextResponse.json({ success: false, error: 'Captcha verification failed' }, { status: 403 });
    }
  }

  // Event-day gate applies only to real teams, never to the demo team
  if (!isDemoTeam && !isEventDay() && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, error: 'Login is only available on event day.' }, { status: 403 });
  }

  const { data: team } = await supabaseServer
    .from('teams')
    .select('id, is_payment_verified, members(email, college_email, is_team_lead)')
    .eq('team_code', team_code)
    .single();

  if (!team) return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 });
  if (!isDemoTeam && !team.is_payment_verified) return NextResponse.json({ success: false, error: 'Payment not verified' }, { status: 403 });

  const lead = team.members.find(m => m.is_team_lead);
  if (!lead) return NextResponse.json({ success: false, error: 'Team lead not found' }, { status: 500 });

  const otp = isDemoTeam ? '000000' : generateOtp();
  const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60_000);

  // Delete old challenge
  await supabaseServer.from('otp_challenges').delete().match({ team_id: team.id, purpose: 'login' });

  const { data: challenge, error } = await supabaseServer.from('otp_challenges')
    .insert({
      email: lead.college_email,
      otp_hash: hashOtp(otp),
      purpose: 'login',
      team_id: team.id,
      expires_at: expiresAt.toISOString(),
    }).select('id').single();

  if (error || !challenge) {
    console.error("Login OTP Insert Error:", error);
    return NextResponse.json({ success: false, error: 'Database error generating OTP' }, { status: 500 });
  }

  if (!isDemoTeam) {
    try {
      await sendOtpEmail({ to: lead.college_email, otp, purpose: 'login', team_id: team.id });
    } catch (e) {
      console.error("Email send error:", e);
    }
  }

  return NextResponse.json({
    success: true,
    challenge_id: challenge.id,
    lead_email_masked: lead.college_email.replace(/^(.{2})(.*)(@.*)$/, '$1***$3'),
    expires_in: env.OTP_EXPIRY_MINUTES * 60,
    devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined
  });
}

