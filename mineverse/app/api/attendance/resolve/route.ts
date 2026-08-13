import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { requirePanelScope } from '@/lib/panel/require-admin';

export const dynamic = 'force-dynamic';

/**
 * The attendance QR encodes the plain team code (MNV-XXX), so a scan and a
 * manual keystroke arrive here in exactly the same shape — there is no token to
 * verify. Anything that is not a well-formed team code is rejected outright.
 */
const TEAM_CODE = /^MNV-\d{3}$/;

function normaliseTeamCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return TEAM_CODE.test(code) ? code : null;
}

export async function POST(req: Request) {
  const guard = await requirePanelScope('attendance');
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const code = normaliseTeamCode(body.code ?? body.team_code);
  const checkpointId = Number(body.checkpoint_id);

  if (!code) {
    return NextResponse.json(
      { success: false, error: 'Enter or scan a valid team code (MNV-000).' },
      { status: 400 },
    );
  }

  const { data: team } = await supabaseServer
    .from('teams')
    // registration_no comes back so the panel knows who still needs to be asked
    // for one — teams registered before the field existed have none.
    .select('id, team_code, team_name, team_size, is_payment_verified, members(id, name, is_team_lead, registration_no)')
    .eq('team_code', code)
    .single();

  if (!team) {
    return NextResponse.json({ success: false, error: `No team found for ${code}.` }, { status: 404 });
  }

  const members = [...(team.members ?? [])].sort(
    (a, b) => Number(b.is_team_lead) - Number(a.is_team_lead) || a.name.localeCompare(b.name),
  );

  // Pre-fill the checkboxes when this team was already marked at this checkpoint.
  let existing: { member_ids: string[]; members_present: number } | null = null;
  if (Number.isInteger(checkpointId)) {
    const { data: record } = await supabaseServer
      .from('attendance_records')
      .select('id, members_present, attendance_member_records(member_id)')
      .eq('team_id', team.id)
      .eq('checkpoint_id', checkpointId)
      .maybeSingle();

    if (record) {
      existing = {
        members_present: record.members_present,
        member_ids: (record.attendance_member_records ?? []).map((r) => r.member_id),
      };
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      id: team.id,
      team_code: team.team_code,
      team_name: team.team_name,
      team_size: team.team_size,
      is_payment_verified: team.is_payment_verified,
      members,
      existing,
    },
  });
}
