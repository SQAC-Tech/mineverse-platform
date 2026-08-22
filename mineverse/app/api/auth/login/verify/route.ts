import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { hashOtp } from '@/lib/auth/otp';
import { setSessionCookie, createSessionToken } from '@/lib/auth/session';
import { env } from '@/lib/env';

// We still use this to populate the field so we know *where* they logged in from.
function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

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
  
  const ip = clientIp(req);
  const teamIp = challenge.teams.active_login_ip;

  if (teamIp) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Your team has already logged in. Per rules, only one device is allowed. If your device crashed, an organizer must release your login from the admin Teams screen.',
      },
      { status: 403 },
    );
  }

  // Record the IP to lock out any further logins
  await supabaseServer.from('teams').update({ active_login_ip: ip !== 'unknown' ? ip : 'recorded' }).eq('id', challenge.team_id);

  await setSessionCookie(token);

  // We delete the OTP challenge here to prevent multiple uses of the same OTP.
  await supabaseServer.from('otp_challenges').delete().eq('id', challenge_id);

  return NextResponse.json({ success: true, redirect: '/dashboard' });
}
