import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * Post-registration status check. Payment happens BEFORE submit (see
 * /api/payment/qr), so this only reports verification progress — it never
 * shows a pay-QR.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const team_code = searchParams.get('team');

  if (!team_code) {
    return NextResponse.json({ success: false, error: 'Team code is required' }, { status: 400 });
  }

  const { data: team } = await supabaseServer
    .from('teams')
    .select('id, team_code, team_name, status, is_payment_verified, payments (amount, status, transaction_id, sender_name, verified_at)')
    .eq('team_code', team_code.toUpperCase())
    .single();

  if (!team || !team.payments) {
    return NextResponse.json({ success: false, error: 'Team or payment not found' }, { status: 404 });
  }

  const payment = team.payments;

  return NextResponse.json({
    success: true,
    data: {
      team_code: team.team_code,
      team_name: team.team_name,
      amount: payment.amount,
      payment_status: payment.status,
      transaction_id: payment.transaction_id,
      sender_name: payment.sender_name,
      verified_at: payment.verified_at,
    }
  });
}
