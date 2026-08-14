import { NextResponse } from 'next/server';
import { registrationSchema } from '@/lib/validation/schemas';
import { rateLimit } from '@/lib/rate-limit';
import { supabaseServer } from '@/lib/supabase/server';
import { sendRegistrationReceivedEmail } from '@/lib/email';
import { env } from '@/lib/env';
import { verifyTurnstileToken } from '@/lib/turnstile';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit('reg:' + ip, 5, 60 * 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many registrations from this IP' }, { status: 429 });
  }

  const body = await req.json();
  const parsed = registrationSchema.safeParse(body);

  if (!parsed.success) {
    // Zod 4 exposes `issues`; reading `.errors` here threw and turned every
    // validation failure into a 500.
    return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { challenge_id, verification_token, turnstile_token, team_name, members, transaction_id, sender_name } = parsed.data;

  // Turnstile verification (canonical siteverify with remoteip)
  const turnstileOk = await verifyTurnstileToken(turnstile_token, ip);
  if (!turnstileOk) {
    return NextResponse.json({ success: false, error: 'Captcha verification failed' }, { status: 403 });
  }

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

  // Reject reused transaction IDs before creating anything
  const { data: existingTxn } = await supabaseServer.from('payments')
    .select('id')
    .eq('transaction_id', transaction_id)
    .maybeSingle();

  if (existingTxn) {
    return NextResponse.json({ success: false, error: 'This transaction ID has already been used' }, { status: 409 });
  }

  // Generate team code via RPC
  const { data: teamCode } = await supabaseServer.rpc('generate_team_code');
  if (!teamCode) {
    return NextResponse.json({ success: false, error: 'Error generating team code' }, { status: 500 });
  }

  // Duo or trio only — the schema already rejects solo, this is the last guard.
  const teamSize = members.length;
  const amount = teamSize === 2 ? env.FEE_DUO : env.FEE_TRIO;

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
  const { error: membersErr } = await supabaseServer.from('members').insert(membersToInsert);

  if (membersErr) {
    // This error used to be discarded, so a rejected insert still produced a
    // team, a payment row and a confirmation email — a paying team with nobody
    // on it, which then cannot log in at all ("Team lead not found"). Roll the
    // team back instead so the user can retry cleanly.
    await supabaseServer.from('teams').delete().eq('id', team.id);

    if (membersErr.code === '23505') {
      const detail = membersErr.message ?? '';
      const reason = detail.includes('registration_no')
        ? 'A registration number is already registered to someone else'
        : detail.includes('college_email')
          ? 'One or more college emails are already registered'
          : 'Each member needs their own personal email';
      return NextResponse.json({ success: false, error: reason }, { status: 409 });
    }

    console.error('Registration member insert failed:', membersErr);
    return NextResponse.json({ success: false, error: 'Error saving team members' }, { status: 500 });
  }

  // Insert Payment — payment happened before submit; txn details await admin verification
  const { error: paymentErr } = await supabaseServer.from('payments').insert({
    team_id: team.id,
    amount,
    team_size: teamSize,
    transaction_id,
    sender_name,
    status: 'pending',
  });

  if (paymentErr) {
    // Unique violation on transaction_id (raced past the pre-check) or other failure:
    // roll back the team so the user can retry cleanly (members/access cascade).
    await supabaseServer.from('teams').delete().eq('id', team.id);
    const isDupTxn = paymentErr.code === '23505';
    return NextResponse.json(
      { success: false, error: isDupTxn ? 'This transaction ID has already been used' : 'Error saving payment details' },
      { status: isDupTxn ? 409 : 500 }
    );
  }

  // Insert Round Access
  // Get all rounds first
  const { data: rounds } = await supabaseServer.from('rounds').select('id');
  if (rounds && rounds.length > 0) {
    const accessRows = rounds.map(r => ({ team_id: team.id, round_id: r.id, is_locked: true }));
    const { error: accessErr } = await supabaseServer.from('team_round_access').insert(accessRows);
    // Payment is already recorded, so rolling the team back here would be worse
    // than the gap. Log it loudly instead — access can be repaired from the panel.
    if (accessErr) console.error('Round access insert failed for team', teamCode, accessErr);
  }

  // Delete consumed OTP challenge
  await supabaseServer.from('otp_challenges').delete().eq('id', challenge_id);

  await sendRegistrationReceivedEmail({
    to: lead.college_email, // All communication goes to the college email
    team_name,
    team_code: teamCode,
    amount,
    team_id: team.id,
    transaction_id,
  });

  return NextResponse.json({
    success: true,
    team_code: teamCode,
    payment_amount: amount,
    redirect: '/payment?team=' + teamCode,
  });
}
