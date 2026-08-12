import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { requirePanelScope } from '@/lib/panel/require-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

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

/**
 * Removes a team outright — members, payment, round access, scores and every
 * gameplay row cascade with it. `email_logs` and a won `pvp_matches` row only
 * have their team_id nulled, so the audit trail outlives the team.
 *
 * There is no undo, so the caller has to echo back the team code as `confirm`.
 * A stray DELETE carrying only an id does nothing.
 */
export async function DELETE(req: Request) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const params = new URL(req.url).searchParams;
  const id = params.get('id');
  const confirm = params.get('confirm')?.trim().toUpperCase();

  if (!id) {
    return NextResponse.json({ success: false, error: 'Missing team id' }, { status: 400 });
  }

  const { data: team } = await supabaseServer
    .from('teams')
    .select('id, team_code, team_name')
    .eq('id', id)
    .maybeSingle();

  if (!team) {
    return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 });
  }

  if (confirm !== team.team_code) {
    return NextResponse.json(
      { success: false, error: `Type ${team.team_code} exactly to confirm the deletion` },
      { status: 400 },
    );
  }

  const { error } = await supabaseServer.from('teams').delete().eq('id', id);

  if (error) {
    console.error('Team delete failed:', error);
    return NextResponse.json({ success: false, error: 'Could not delete the team' }, { status: 500 });
  }

  console.warn(`Team ${team.team_code} (${team.team_name}) deleted from the admin panel`);
  return NextResponse.json({ success: true, data: { team_code: team.team_code } });
}
