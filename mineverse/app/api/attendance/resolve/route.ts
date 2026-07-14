import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { env } from '@/lib/env';
import { supabaseServer } from '@/lib/supabase/server';

const secret = new TextEncoder().encode(env.ATTENDANCE_QR_SECRET);

export async function POST(req: Request) {
  const { qr_token } = await req.json();

  if (!qr_token) return NextResponse.json({ success: false, error: 'No token provided' }, { status: 400 });

  try {
    const { payload } = await jwtVerify(qr_token, secret);
    const team_id = payload.team_id as string;

    const { data: team } = await supabaseServer
      .from('teams')
      .select('*, members(id, name, is_team_lead)')
      .eq('id', team_id)
      .single();

    if (!team) return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: team });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Invalid or expired QR token' }, { status: 400 });
  }
}
