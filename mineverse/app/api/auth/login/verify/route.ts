import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { hashOtp } from '@/lib/auth/otp';
import { setSessionCookie, createSessionToken } from '@/lib/auth/session';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  const { challenge_id, otp } = await req.json();

  const { data: challenge } = await supabaseServer
    .from('otp_challenges')
    .select('*, teams(team_code)')
    .eq('id', challenge_id)
    .single();

  if (!challenge || new Date(challenge.expires_at) < new Date()) {
    return NextResponse.json({ success: false, error: 'Challenge expired or invalid' }, { status: 400 });
  }

  if (challenge.attempts >= env.OTP_MAX_ATTEMPTS) {
    await supabaseServer.from('otp_challenges').delete().eq('id', challenge_id);
    return NextResponse.json({ success: false, error: 'Too many attempts' }, { status: 400 });
  }

  if (challenge.otp_hash !== hashOtp(otp)) {
    await supabaseServer.from('otp_challenges').update({ attempts: challenge.attempts + 1 }).eq('id', challenge_id);
    return NextResponse.json({ success: false, error: 'Invalid OTP' }, { status: 400 });
  }

  // Create session
  const token = await createSessionToken(challenge.team_id, challenge.teams.team_code);
  await setSessionCookie(token);

  await supabaseServer.from('otp_challenges').delete().eq('id', challenge_id);

  return NextResponse.json({ success: true, redirect: '/dashboard' });
}
