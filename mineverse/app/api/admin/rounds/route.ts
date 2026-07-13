import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET() {
  const { data: rounds } = await supabaseServer
    .from('rounds')
    .select('*')
    .order('sequence', { ascending: true });

  return NextResponse.json({ success: true, data: rounds });
}
