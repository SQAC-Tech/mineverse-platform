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
 * Desk actions on a team.
 *
 * Only one so far: releasing the login pin. `POST /api/auth/login/verify` pins a
 * team to the first address it logs in from, so a team that logged in from home
 * the night before is refused when it arrives on campus — a different network is
 * a different address. Nothing in the login flow can clear that, and the team
 * cannot fix it themselves, so without this the only remedy during the event is
 * a hand-written database update.
 */
export async function POST(req: Request) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? '');
  const teamId = String(body?.team_id ?? '');

  /**
   * Clears every pin at once.
   *
   * One team at a time is the right shape for a desk fixing one arrival. It is
   * the wrong shape the morning of the event: teams pin themselves during the
   * screening two days earlier, from hostel wifi and mobile data, so on the day
   * every pin points at a network that is not the venue and the whole roster
   * needs clearing before the doors open. Ninety teams through a per-team
   * button, each behind a row expansion, is not a thing anyone will finish.
   *
   * Gated on an explicit confirm string rather than a bare action, because this
   * is the one call that opens every team to a new network simultaneously.
   */
  if (action === 'release_all_logins') {
    if (String(body?.confirm ?? '') !== 'RELEASE ALL') {
      return NextResponse.json(
        { success: false, error: 'Confirmation required' },
        { status: 400 },
      );
    }

    const { data: released, error: releaseAllErr } = await supabaseServer
      .from('teams')
      .update({ active_login_ip: null })
      .not('active_login_ip', 'is', null)
      .select('team_code');

    if (releaseAllErr) {
      console.error('Releasing all login pins failed:', releaseAllErr);
      return NextResponse.json(
        { success: false, error: 'Database error: ' + releaseAllErr.message },
        { status: 500 },
      );
    }

    const count = released?.length ?? 0;
    console.warn(`[teams] ALL login pins released (${count} teams) by panel-admin`);
    return NextResponse.json({ success: true, data: { released: count } });
  }

  if (action !== 'release_login') {
    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  }
  if (!teamId) {
    return NextResponse.json({ success: false, error: 'Missing team id' }, { status: 400 });
  }

  const { data: team } = await supabaseServer
    .from('teams')
    .select('id, team_code')
    .eq('id', teamId)
    .maybeSingle();

  if (!team) {
    return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 });
  }

  const { error } = await supabaseServer
    .from('teams')
    .update({ active_login_ip: null })
    .eq('id', teamId);

  if (error) {
    console.error('Releasing login pin failed:', error);
    return NextResponse.json({ success: false, error: 'Database error: ' + error.message }, { status: 500 });
  }

  // Worth a log line: this is the one action that lets a second network in.
  console.warn(`[teams] login pin released for ${team.team_code} by panel-admin`);
  return NextResponse.json({ success: true, data: { team_id: teamId, team_code: team.team_code } });
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
