import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { hashOtp } from '@/lib/auth/otp';
import { setSessionCookie, createSessionToken } from '@/lib/auth/session';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  const { challenge_id, otp } = await req.json();

  const { data: challenge } = await supabaseServer
    .from('otp_challenges')
    .select('*, teams(team_code, active_login_ip)')
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
  if (!challenge.team_id || !challenge.teams) {
    return NextResponse.json({ success: false, error: 'Challenge is not a login challenge' }, { status: 400 });
  }
  const token = await createSessionToken(challenge.team_id, challenge.teams.team_code);
  
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const teamIp = challenge.teams.active_login_ip;

  if (teamIp && teamIp !== ip && ip !== 'unknown') {
    return NextResponse.json({ success: false, error: 'Your team is already logged in from another device/network.' }, { status: 403 });
  }

  if (!teamIp && ip !== 'unknown') {
    await supabaseServer.from('teams').update({ active_login_ip: ip }).eq('id', challenge.team_id);
  }

  await setSessionCookie(token);

  // Intentionally NOT deleting the OTP here so that multiple teammates 
  // on the same network can still use it before it expires.

  return NextResponse.json({ success: true, redirect: '/dashboard' });
}
