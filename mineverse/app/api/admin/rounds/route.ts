import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { requirePanelScope } from '@/lib/panel/require-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const { data: rounds, error } = await supabaseServer
    .from('rounds')
    .select('*')
    .order('sequence', { ascending: true });

  if (error) {
    console.error('Supabase error fetching rounds:', error);
    return NextResponse.json({ success: false, error: 'Database error: ' + error.message });
  }

  return NextResponse.json({ success: true, data: rounds || [] });
}
