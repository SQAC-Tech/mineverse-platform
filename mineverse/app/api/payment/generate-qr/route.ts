import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  try {
    const { amount, team_name } = await req.json();

    if (!amount || !team_name) {
      return NextResponse.json({ success: false, error: 'Missing amount or team name' }, { status: 400 });
    }

    const upi_string = `upi://pay?pa=${env.UPI_ID}&pn=${encodeURIComponent(env.UPI_PAYEE_NAME)}&am=${amount}&tn=Team-${encodeURIComponent(team_name)}&cu=INR`;
    const qr_image = await QRCode.toDataURL(upi_string, { width: 400, margin: 2 });

    return NextResponse.json({ success: true, qr_image });
  } catch (error) {
    console.error('Error generating QR:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate QR code' }, { status: 500 });
  }
}
