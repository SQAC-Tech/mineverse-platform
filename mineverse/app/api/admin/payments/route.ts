import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { sendPaymentVerifiedEmail } from '@/lib/email';
import { SignJWT } from 'jose';
import { env } from '@/lib/env';
import QRCode from 'qrcode';

export async function GET() {
  const { data: payments } = await supabaseServer
    .from('payments')
    .select('*, teams(team_code, team_name, is_payment_verified)')
    .order('created_at', { ascending: false });

  return NextResponse.json({ success: true, data: payments });
}

export async function POST(req: Request) {
  const { payment_id, action } = await req.json();

  if (action === 'verify') {
    const { data: payment } = await supabaseServer.from('payments').select('*, teams(*)').eq('id', payment_id).single();
    if (!payment) return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });

    // Generate Attendance QR JWT
    const secret = new TextEncoder().encode(env.ATTENDANCE_QR_SECRET);
    const qr_token = await new SignJWT({ team_id: payment.team_id, team_code: payment.teams.team_code })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(secret);

    // Update team QR token
    await supabaseServer.from('teams').update({ qr_token }).eq('id', payment.team_id);

    // Update payment status
    await supabaseServer.from('payments')
      .update({ status: 'verified', verified_at: new Date().toISOString() })
      .eq('id', payment_id);

    // Fetch members to send email
    const { data: members } = await supabaseServer.from('members').select('*').eq('team_id', payment.team_id);
    
    // Generate QR image
    const qr_image_data_url = await QRCode.toDataURL(qr_token, { width: 400, margin: 2 });

    if (members) {
      for (const member of members) {
        await sendPaymentVerifiedEmail({
          to: member.email,
          member_id: member.id,
          team_id: payment.team_id,
          team_name: payment.teams.team_name,
          team_code: payment.teams.team_code,
          qr_image_data_url
        });
      }
    }
    
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
}
