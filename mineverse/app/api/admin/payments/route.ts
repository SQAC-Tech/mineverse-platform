import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
import { sendPaymentVerifiedEmail } from '@/lib/email';
import QRCode from 'qrcode';
import { requirePanelScope } from '@/lib/panel/require-admin';

export async function GET() {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const { data: payments, error } = await supabaseServer
    .from('payments')
    .select('*, teams(team_code, team_name, is_payment_verified)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase error fetching payments:', error);
    return NextResponse.json({ success: false, error: 'Database error: ' + error.message });
  }

  return NextResponse.json({ success: true, data: payments || [] });
}

export async function POST(req: Request) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const { payment_id, action } = await req.json();

  if (action === 'verify') {
    const { data: payment } = await supabaseServer.from('payments').select('*, teams(*)').eq('id', payment_id).single();
    if (!payment) return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });

    // Update payment status
    await supabaseServer.from('payments')
      .update({ status: 'verified', verified_at: new Date().toISOString() })
      .eq('id', payment_id);

    // Fetch members to send email
    const { data: members } = await supabaseServer.from('members').select('*').eq('team_id', payment.team_id);

    // The attendance QR is just the team code. A volunteer whose camera fails
    // can type the same string by hand, so scan and manual entry never diverge.
    const qr_image_data_url = await QRCode.toDataURL(payment.teams.team_code, { width: 400, margin: 2 });

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
