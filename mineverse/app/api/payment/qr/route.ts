import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { env } from '@/lib/env';

/**
 * Pre-registration payment QR. The team does not exist yet — the flow is
 * pay first (scan QR, note transaction id) → then submit registration.
 * Amount is derived from team size; the UPI note carries the lead's team name
 * so admins can cross-reference during manual verification.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const size = Number(searchParams.get('size'));

  // Registration is duo or trio only, so there is no solo QR to hand out.
  if (![2, 3].includes(size)) {
    return NextResponse.json({ success: false, error: 'size must be 2 or 3' }, { status: 400 });
  }

  const amount = size === 2 ? env.FEE_DUO : env.FEE_TRIO;
  const upi_string = `upi://pay?pa=${env.UPI_ID}&pn=${encodeURIComponent(env.UPI_PAYEE_NAME)}&am=${amount}&tn=${encodeURIComponent('MINEVERSE Registration')}&cu=INR`;
  const qr_image = await QRCode.toDataURL(upi_string, { width: 400, margin: 2 });

  return NextResponse.json({
    success: true,
    data: { amount, upi_id: env.UPI_ID, payee_name: env.UPI_PAYEE_NAME, upi_string, qr_image },
  });
}
