import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data: teams, error } = await supabaseServer
    .from('teams')
    .select('*, members(*), attendance_records(checkpoint_id, members_present)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase error fetching teams:', error);
    return NextResponse.json({ success: false, error: 'Database error: ' + error.message });
  }

  return NextResponse.json({ success: true, data: teams || [] });
}
