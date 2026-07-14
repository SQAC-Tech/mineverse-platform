import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import QRCode from 'qrcode';
import { env } from '@/lib/env';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const team_code = searchParams.get('team');

  if (!team_code) {
    return NextResponse.json({ success: false, error: 'Team code is required' }, { status: 400 });
  }

  const { data: team } = await supabaseServer
    .from('teams')
    .select('id, team_code, status, is_payment_verified, payments (amount, upi_string, status)')
    .eq('team_code', team_code.toUpperCase())
    .single();

  if (!team || !team.payments || team.payments.length === 0) {
    return NextResponse.json({ success: false, error: 'Team or payment not found' }, { status: 404 });
  }

  const payment = team.payments[0] as any; // Due to array return on join
  let upi_string = payment.upi_string;

  if (payment.status === 'pending' && !upi_string) {
    upi_string = `upi://pay?pa=${env.UPI_ID}&pn=${encodeURIComponent(env.UPI_PAYEE_NAME)}&am=${payment.amount}&tn=Team-${team.team_code}&cu=INR`;
    
    // Optimistically save the upi_string back to the database
    await supabaseServer.from('payments').update({ upi_string }).eq('team_id', team.id);
  }

  let qr_image = null;
  if (upi_string) {
    qr_image = await QRCode.toDataURL(upi_string, { width: 400, margin: 2 });
  }

  return NextResponse.json({
    success: true,
    data: {
      team_code: team.team_code,
      amount: payment.amount,
      payment_status: payment.status,
      qr_image,
    }
  });
}
