import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { hashOtp } from '@/lib/auth/otp';
import { setSessionCookie, createSessionToken, ensureDeviceId } from '@/lib/auth/session';
import { checkLoginLease, claimLoginLease } from '@/lib/auth/login-lease';
import { clientIp } from '@/lib/request-ip';
import { isDemoTeamCode } from '@/lib/gameplay/demo-teams';
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

  if (!challenge.team_id || !challenge.teams) {
    return NextResponse.json({ success: false, error: 'Challenge is not a login challenge' }, { status: 400 });
  }

  /**
   * The one-device rule.
   *
   * Checked after the OTP so the answer depends on who is asking — the device
   * has to be established before we can tell "the same laptop again" from "a
   * second laptop", and only a verified request should be able to take a seat.
   *
   * The refusal deliberately leaves the challenge in place. A team that is told
   * to wait for an idle device should not also have to request a fresh code
   * when it retries a minute later.
   */
  const deviceId = await ensureDeviceId();

  /**
   * Demo teams are exempt, because the rule would be backwards for them.
   * Several organizers walk the floor signed in as one demo code to check
   * rounds; a one-seat rule would have them evicting each other all morning.
   * They already skip the round gates and the event-day gate for the same
   * reason — see lib/gameplay/demo-teams.
   */
  const lease = isDemoTeamCode(challenge.teams.team_code)
    ? ({ ok: true, takeover: false } as const)
    : await checkLoginLease(challenge.team_id, deviceId);

  if (!lease.ok) {
    return NextResponse.json(
      { success: false, error: lease.message, retry_after: lease.retryAfterSeconds },
      { status: 403, headers: { 'Retry-After': String(lease.retryAfterSeconds) } },
    );
  }

  if (lease.takeover) {
    console.warn(`[login] ${challenge.teams.team_code} taken over by a new device after the previous one went idle`);
  }

  if (!isDemoTeamCode(challenge.teams.team_code)) {
    await claimLoginLease(challenge.team_id, deviceId, clientIp(req));
  }

  const token = await createSessionToken(challenge.team_id, challenge.teams.team_code);
  await setSessionCookie(token);

  // Deleted here so the same OTP cannot be used twice.
  await supabaseServer.from('otp_challenges').delete().eq('id', challenge_id);

  return NextResponse.json({ success: true, redirect: '/dashboard' });
}
