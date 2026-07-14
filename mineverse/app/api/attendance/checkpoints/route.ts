import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { isEventDay } from '@/lib/auth/otp';

export async function GET() {
  const { data: checkpoints } = await supabaseServer
    .from('attendance_checkpoints')
    .select('*')
    .order('sequence', { ascending: true });

  return NextResponse.json({ success: true, data: checkpoints });
}
