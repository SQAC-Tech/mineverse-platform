import { NextResponse } from 'next/server';
import { requireDay2Access, Day2Session } from '@/lib/day2/access/guard';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST() {
  const guardResult = await requireDay2Access();
  if (guardResult instanceof NextResponse) {
    return guardResult;
  }

  const session = guardResult as Day2Session;

  // Check Nether Core from team_game_state
  if (session.state.nether_core_count < 1) {
    return NextResponse.json({ success: false, error: 'MISSING_NETHER_CORE' }, { status: 400 });
  }

  // Check if already repaired
  const { data: existingRepair, error: existingRepairError } = await supabaseServer
    .from('day2_portal_repair')
    .select('*')
    .eq('team_id', session.team_id)
    .maybeSingle();

  if (existingRepairError) {
    return NextResponse.json({ success: false, error: 'DATABASE_ERROR' }, { status: 500 });
  }

  if (existingRepair) {
    return NextResponse.json({ success: true, repaired_at: existingRepair.repaired_at });
  }

  // Check Portal Fragment
  const { data: fragment, error: fragmentError } = await supabaseServer
    .from('day2_portal_fragments')
    .select('*')
    .eq('team_id', session.team_id)
    .maybeSingle();

  if (fragmentError) {
    return NextResponse.json({ success: false, error: 'DATABASE_ERROR' }, { status: 500 });
  }

  if (!fragment) {
    return NextResponse.json({ success: false, error: 'MISSING_PORTAL_FRAGMENT' }, { status: 400 });
  }

  // Check Diamonds
  const { data: resources, error: resourcesError } = await supabaseServer
    .from('resources')
    .select('diamond')
    .eq('team_id', session.team_id)
    .maybeSingle();

  if (resourcesError || !resources) {
    return NextResponse.json({ success: false, error: 'DATABASE_ERROR' }, { status: 500 });
  }

  if (resources.diamond < 15) {
    return NextResponse.json({ success: false, error: 'INSUFFICIENT_DIAMONDS' }, { status: 400 });
  }

  // Record repair
  const { data: repair, error: insertError } = await supabaseServer
    .from('day2_portal_repair')
    .insert({ team_id: session.team_id })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === '23505') { // Unique violation, already repaired
      const { data: retryRepair } = await supabaseServer
        .from('day2_portal_repair')
        .select('*')
        .eq('team_id', session.team_id)
        .single();
      if (retryRepair) {
         return NextResponse.json({ success: true, repaired_at: retryRepair.repaired_at });
      }
    }
    return NextResponse.json({ success: false, error: 'REPAIR_FAILED' }, { status: 500 });
  }

  return NextResponse.json({ success: true, repaired_at: repair.repaired_at });
}
