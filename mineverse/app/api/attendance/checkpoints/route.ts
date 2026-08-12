import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { requirePanelScope } from '@/lib/panel/require-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requirePanelScope('attendance');
  if (!guard.ok) return guard.response;

  const { data: checkpoints } = await supabaseServer
    .from('attendance_checkpoints')
    .select('*')
    .order('sequence', { ascending: true });

  return NextResponse.json({ success: true, data: checkpoints });
}
