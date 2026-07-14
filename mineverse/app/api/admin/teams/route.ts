import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET() {
  const { data: teams } = await supabaseServer
    .from('teams')
    .select('*, members(*), attendance_records(checkpoint_id, members_present)')
    .order('created_at', { ascending: false });

  return NextResponse.json({ success: true, data: teams });
}
