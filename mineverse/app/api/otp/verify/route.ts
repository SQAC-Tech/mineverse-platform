import { NextResponse } from 'next/server';
import { otpVerifySchema } from '@/lib/validation/schemas';
import { supabaseServer } from '@/lib/supabase/server';
import { hashOtp } from '@/lib/auth/otp';
import { env } from '@/lib/env';
import { isRegistrationOpen } from '@/lib/platform/settings';

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = otpVerifySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
  }

  const { challenge_id, otp } = parsed.data;

  const { data: challenge } = await supabaseServer
    .from('otp_challenges')
    .select('*')
    .eq('id', challenge_id)
    .single();

  if (!challenge || new Date(challenge.expires_at) < new Date()) {
    return NextResponse.json({ success: false, error: 'Challenge expired or missing' }, { status: 400 });
  }

  /**
   * Step two of registration, and it closes with it.
   *
   * Scoped to registration challenges rather than gated at the top: this route
   * looks a challenge up by id alone, so tying it to `registration_open`
   * unconditionally would break any other purpose that ever routes through
   * here. A code issued in the last minutes before closing stops here rather
   * than at the final submit, which is a clearer place to be told.
   */
  if (challenge.purpose === 'registration' && !(await isRegistrationOpen())) {
    return NextResponse.json(
      { success: false, error: 'Registrations are closed. Contact the organizers if you think this is a mistake.' },
      { status: 403 },
    );
  }

  if (challenge.attempts >= env.OTP_MAX_ATTEMPTS) {
    await supabaseServer.from('otp_challenges').delete().eq('id', challenge_id);
    return NextResponse.json({ success: false, error: 'Too many attempts. Request a new OTP.' }, { status: 400 });
  }

  if (challenge.otp_hash !== hashOtp(otp)) {
    await supabaseServer.from('otp_challenges')
      .update({ attempts: challenge.attempts + 1 })
      .eq('id', challenge_id);
    return NextResponse.json({ 
      success: false, 
      error: 'Invalid OTP', 
      attempts_left: env.OTP_MAX_ATTEMPTS - (challenge.attempts + 1) 
    }, { status: 400 });
  }

  const { data: updated } = await supabaseServer.from('otp_challenges')
    .update({ verified: true })
    .eq('id', challenge_id)
    .select('verification_token')
    .single();

  return NextResponse.json({ success: true, verification_token: updated!.verification_token });
}
