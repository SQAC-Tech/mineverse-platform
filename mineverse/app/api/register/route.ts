import { NextResponse } from 'next/server';
import { registrationSchema } from '@/lib/validation/schemas';
import { rateLimit } from '@/lib/rate-limit';
import { supabaseServer } from '@/lib/supabase/server';
import { sendRegistrationReceivedEmail } from '@/lib/email';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit('reg:' + ip, 5, 60 * 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many registrations from this IP' }, { status: 429 });
  }

  const body = await req.json();
  const parsed = registrationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: (parsed.error as any).errors[0].message }, { status: 400 });
  }

  const { challenge_id, verification_token, team_name, members } = parsed.data;
  const lead = members.find((m) => m.is_team_lead)!;

  // Verify challenge
  const { data: challenge } = await supabaseServer.from('otp_challenges')
    .select('*')
    .eq('id', challenge_id)
    .single();

  if (!challenge || challenge.purpose !== 'registration' || !challenge.verified || 
      challenge.verification_token !== verification_token || new Date(challenge.expires_at) < new Date() ||
      challenge.email !== lead.college_email) {
    return NextResponse.json({ success: false, error: 'Invalid or expired verification' }, { status: 400 });
  }

  // Check all emails for duplicates
  const collegeEmails = members.map(m => m.college_email);
  const { data: duplicates } = await supabaseServer.from('members')
    .select('college_email')
    .in('college_email', collegeEmails);

  if (duplicates && duplicates.length > 0) {
    return NextResponse.json({ success: false, error: 'One or more college emails are already registered' }, { status: 409 });
  }

  // Generate team code via RPC
  const { data: teamCode } = await supabaseServer.rpc('generate_team_code');

  const teamSize = members.length;
  const amount = teamSize === 1 ? env.FEE_SOLO : teamSize === 2 ? env.FEE_DUO : env.FEE_TRIO;

  // Insert Team
  const { data: team, error: teamErr } = await supabaseServer.from('teams')
    .insert({
      team_code: teamCode,
      team_name,
      team_size: teamSize,
      status: 'payment_pending',
    })
    .select('id').single();

  if (teamErr) return NextResponse.json({ success: false, error: 'Error creating team' }, { status: 500 });

  // Insert Members
  const membersToInsert = members.map(m => ({
    ...m,
    team_id: team.id,
    email_verified: m.is_team_lead,
  }));
  await supabaseServer.from('members').insert(membersToInsert);

  // Insert Payment
  await supabaseServer.from('payments').insert({
    team_id: team.id,
    amount,
    team_size: teamSize,
    status: 'pending',
  });

  // Insert Round Access
  // Get all rounds first
  const { data: rounds } = await supabaseServer.from('rounds').select('id');
  if (rounds && rounds.length > 0) {
    const accessRows = rounds.map(r => ({ team_id: team.id, round_id: r.id, is_locked: true }));
    await supabaseServer.from('team_round_access').insert(accessRows);
  }

  // Delete consumed OTP challenge
  await supabaseServer.from('otp_challenges').delete().eq('id', challenge_id);

  // Send Email
  await sendRegistrationReceivedEmail({
    to: lead.email, // or lead.college_email? PRD says lead, usually they have a preferred email and college email. We will use email.
    team_name,
    team_code: teamCode,
    amount,
    team_id: team.id,
  });

  return NextResponse.json({
    success: true,
    team_code: teamCode,
    payment_amount: amount,
    redirect: '/payment?team=' + teamCode,
  });
}
