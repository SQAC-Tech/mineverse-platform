import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { markingEntitlement } from '@/lib/attendance/gates';

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

  /**
   * Whether this team should be standing here at all.
   *
   * Surfaced on the scan rather than only at round entry, so the volunteer is
   * told while the team is in front of them — a team that never RSVP'd can be
   * sent to an organizer there and then, instead of discovering it when a round
   * refuses to open.
   *
   * A warning, not a refusal: `POST /mark` is what enforces it. A scan that
   * returns nothing at all would leave the desk with no idea why.
   */
  const { data: checkpointRow } = Number.isInteger(checkpointId)
    ? await supabaseServer
        .from('attendance_checkpoints')
        .select('day')
        .eq('id', checkpointId)
        .maybeSingle()
    : { data: null };

  const entitlement = await markingEntitlement(team.id, Number(checkpointRow?.day ?? 1));

  const members = [...(team.members ?? [])].sort(
    (a, b) => Number(b.is_team_lead) - Number(a.is_team_lead) || a.name.localeCompare(b.name),
  );

  // Pre-fill the checkboxes when this team was already marked at this checkpoint.
  let existing: {
    member_ids: string[];
    members_present: number;
    marked_at: string;
    method: string;
  } | null = null;
  if (Number.isInteger(checkpointId)) {
    const { data: record } = await supabaseServer
      .from('attendance_records')
      .select('id, members_present, method, marked_at, updated_at, attendance_member_records(member_id)')
      .eq('team_id', team.id)
      .eq('checkpoint_id', checkpointId)
      .maybeSingle();

    if (record) {
      existing = {
        members_present: record.members_present,
        // The later of the two: re-marking is an edit, and "marked at 9:02" is
        // misleading once someone has corrected it at 9:40.
        marked_at: record.updated_at ?? record.marked_at,
        method: record.method,
        member_ids: (record.attendance_member_records ?? []).map((r) => r.member_id),
      };
    }
  }

  /**
   * Where else this team has been marked today.
   *
   * A desk covering Round 3 wants to know the team was seen in the morning; a
   * team appearing at the second desk having skipped the first is worth a
   * question, not a silent tick.
   */
  const { data: otherRecords } = await supabaseServer
    .from('attendance_records')
    .select('checkpoint_id, members_present, attendance_checkpoints(label, day, sequence)')
    .eq('team_id', team.id);

  const history = (otherRecords ?? [])
    .map((row) => ({
      checkpoint_id: row.checkpoint_id,
      members_present: row.members_present,
      label: (row.attendance_checkpoints as unknown as { label: string } | null)?.label ?? '',
      sequence: (row.attendance_checkpoints as unknown as { sequence: number } | null)?.sequence ?? 0,
    }))
    .sort((a, b) => a.sequence - b.sequence);

  return NextResponse.json({
    success: true,
    data: {
      id: team.id,
      team_code: team.team_code,
      team_name: team.team_name,
      team_size: team.team_size,
      is_payment_verified: team.is_payment_verified,
      entitled: entitlement.ok,
      entitlement_message: entitlement.message ?? null,
      /**
       * The roster length, not `teams.team_size`.
       *
       * They disagree: two teams carry a size of 1 and have two members on the
       * roster, which rendered as "Mark 2/1" at the desk. The people standing
       * there are the roster, so that is the denominator; the declared size is
       * passed through beside it so a mismatch is visible rather than silently
       * papered over.
       */
      roster_size: members.length,
      size_mismatch: members.length !== team.team_size,
      members,
      existing,
      history,
    },
  });
}
