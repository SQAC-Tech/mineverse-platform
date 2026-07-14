import { NextResponse } from 'next/server';
import { otpVerifySchema } from '@/lib/validation/schemas';
import { supabaseServer } from '@/lib/supabase/server';
import { hashOtp } from '@/lib/auth/otp';
import { env } from '@/lib/env';

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
