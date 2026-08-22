import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { hashOtp } from '@/lib/auth/otp';
import { setSessionCookie, createSessionToken } from '@/lib/auth/session';
import { env } from '@/lib/env';

/**
 * The caller's address, as one value.
 *
 * `x-forwarded-for` is a *list* — `client, proxy1, proxy2` — and the client sits
 * first. Comparing the whole header meant a request that traversed one more hop
 * than the last one produced a different string for the same person and locked
 * their team out, which is not a failure anybody at a desk could diagnose.
 *
 * Note what this pin can and cannot do here. Every machine in the venue reaches
 * us through a single SRMIST NAT address, so teammates on the venue network all
 * match each other and a team that shares its OTP inside the hall is not stopped
 * by it at all — that is why the OTP is deliberately left alive below. What it
 * does stop is a login from somewhere else entirely, and what it risks is a team
 * that logged in from home first arriving on campus to a 403. Hence the release
 * action on the admin Teams screen: `POST /api/admin/teams` with
 * `{ action: 'release_login' }`.
 */
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

  if (teamIp && teamIp !== ip && ip !== 'unknown') {
    return NextResponse.json(
      {
        success: false,
        error:
          'Your team is already logged in from another device or network. An organizer can release it from the admin Teams screen.',
      },
      { status: 403 },
    );
  }

  if (!teamIp && ip !== 'unknown') {
    await supabaseServer.from('teams').update({ active_login_ip: ip }).eq('id', challenge.team_id);
  }

  await setSessionCookie(token);

  // Intentionally NOT deleting the OTP here so that multiple teammates 
  // on the same network can still use it before it expires.

  return NextResponse.json({ success: true, redirect: '/dashboard' });
}
