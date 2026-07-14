import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { sendOtpEmail } from '@/lib/email';
import { generateOtp, hashOtp, isEventDay } from '@/lib/auth/otp';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit('login-otp:' + ip, 5, 10 * 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
  }

  const { team_code } = await req.json();
  if (!team_code) return NextResponse.json({ success: false, error: 'Team code required' }, { status: 400 });

  if (!isEventDay() && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, error: 'Login is only available on event day.' }, { status: 403 });
  }

  const { data: team } = await supabaseServer
    .from('teams')
    .select('id, is_payment_verified, members(email, college_email, is_team_lead)')
    .eq('team_code', team_code.toUpperCase())
    .single();

  if (!team) return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 });
  if (!team.is_payment_verified) return NextResponse.json({ success: false, error: 'Payment not verified' }, { status: 403 });

  const lead = team.members.find(m => m.is_team_lead);
  if (!lead) return NextResponse.json({ success: false, error: 'Team lead not found' }, { status: 500 });

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60_000);

  // Delete old challenge
  await supabaseServer.from('otp_challenges').delete().match({ team_id: team.id, purpose: 'login' });

  const { data: challenge } = await supabaseServer.from('otp_challenges')
    .insert({
      email: lead.college_email,
      otp_hash: hashOtp(otp),
      purpose: 'login',
      team_id: team.id,
      expires_at: expiresAt.toISOString(),
    }).select('id').single();

  await sendOtpEmail({ to: lead.college_email, otp, purpose: 'login', team_id: team.id });

  return NextResponse.json({
    success: true,
    challenge_id: challenge!.id,
    lead_email_masked: lead.college_email.replace(/^(.{2})(.*)(@.*)$/, '$1***$3'),
    expires_in: env.OTP_EXPIRY_MINUTES * 60,
  });
}
