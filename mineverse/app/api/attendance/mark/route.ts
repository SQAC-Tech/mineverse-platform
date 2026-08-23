import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { REGISTRATION_NO } from '@/lib/validation/schemas';
import { markingEntitlement } from '@/lib/attendance/gates';

export const dynamic = 'force-dynamic';

/**
 * Registration numbers typed at the desk, keyed by member id. Teams that
 * registered before the field existed have none on file, so the panel collects
 * them on the first check-in instead of chasing everyone by email.
 */
function readRegistrationNumbers(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [memberId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim().toUpperCase();
    if (trimmed) out[memberId] = trimmed;
  }
  return out;
}

/**
 * Attendance is recorded per member: the volunteer ticks who is standing in
 * front of them. `attendance_records.members_present` is kept in sync as a
 * derived count so admin roster reads stay cheap.
 */
export async function POST(req: Request) {
  const guard = await requirePanelScope('attendance');
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const { team_id, checkpoint_id, notes } = body;
  const method = body.method === 'manual' ? 'manual' : 'qr_scan';
  const rawMemberIds: unknown[] = Array.isArray(body.member_ids) ? body.member_ids : [];
  const memberIds: string[] = [
    ...new Set(rawMemberIds.filter((id): id is string => typeof id === 'string')),
  ];

  if (!team_id || !Number.isInteger(Number(checkpoint_id))) {
    return NextResponse.json({ success: false, error: 'Team and checkpoint are required' }, { status: 400 });
  }

  // Every ticked member must actually belong to this team.
  const { data: teamMembers, error: membersError } = await supabaseServer
    .from('members')
    .select('id, name, registration_no')
    .eq('team_id', team_id);

  if (membersError || !teamMembers) {
    console.error('Loading team members failed:', membersError);
    return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 });
  }

  const validIds = new Set(teamMembers.map((m) => m.id));
  if (memberIds.some((id) => !validIds.has(id))) {
    return NextResponse.json(
      { success: false, error: 'One or more selected members do not belong to this team' },
      { status: 400 },
    );
  }

  // ── Registration numbers collected at the desk ──────────────────────────
  const submitted = readRegistrationNumbers(body.registration_numbers);
  const byId = new Map(teamMembers.map((m) => [m.id, m]));

  // Only fill blanks. An existing number is corrected from the admin panel, not
  // by whoever happens to be holding the scanner.
  const toSave = Object.entries(submitted).filter(
    ([memberId]) => validIds.has(memberId) && !byId.get(memberId)?.registration_no,
  );

  const malformed = toSave.find(([, value]) => !REGISTRATION_NO.test(value));
  if (malformed) {
    const who = byId.get(malformed[0])?.name ?? 'that member';
    return NextResponse.json(
      { success: false, error: `${who}'s registration number must look like RA2211003011234` },
      { status: 400 },
    );
  }

  // Everyone being marked present has to have one on file by the time they walk
  // away from the desk — that is the whole point of asking here.
  const missing = memberIds.filter(
    (id) => !byId.get(id)?.registration_no && !submitted[id],
  );
  if (missing.length > 0) {
    const names = missing.map((id) => byId.get(id)?.name ?? 'Unknown').join(', ');
    return NextResponse.json(
      { success: false, error: `Enter a registration number for ${names}` },
      { status: 400 },
    );
  }

  // Written before the attendance row so a duplicate is caught while the
  // student is still standing there, rather than silently dropped.
  for (const [memberId, registration_no] of toSave) {
    const { error: regError } = await supabaseServer
      .from('members')
      .update({ registration_no })
      .eq('id', memberId);

    if (regError) {
      const duplicate = regError.code === '23505';
      console.error('Saving registration number failed:', regError);
      return NextResponse.json(
        {
          success: false,
          error: duplicate
            ? `${registration_no} is already registered to someone else — check the digits`
            : 'Could not save the registration number',
        },
        { status: duplicate ? 409 : 500 },
      );
    }
  }

  /**
   * The gate, enforced.
   *
   * `/resolve` warns the volunteer on the scan; this is what actually refuses,
   * because attendance is the thing that opens a round and it must not be
   * possible to mark a team that has no seat. Day 1 asks the screening
   * shortlist and the RSVP, day 2 asks the day-2 shortlist.
   *
   * An organizer who wants to let an unconfirmed team in marks its RSVP in the
   * screening console first — a deliberate act on a screen that records who did
   * it, rather than a checkbox at a busy desk.
   */
  const { data: checkpoint } = await supabaseServer
    .from('attendance_checkpoints')
    .select('day, label')
    .eq('id', Number(checkpoint_id))
    .maybeSingle();

  const entitlement = await markingEntitlement(String(team_id), Number(checkpoint?.day ?? 1));
  if (!entitlement.ok) {
    console.warn(`[attendance] refused ${team_id} at ${checkpoint?.label ?? checkpoint_id}: ${entitlement.reason}`);
    return NextResponse.json(
      { success: false, error: entitlement.message ?? 'This team cannot be marked present.' },
      { status: 403 },
    );
  }

  const { data: prior } = await supabaseServer
    .from('attendance_records')
    .select('id')
    .eq('team_id', team_id)
    .eq('checkpoint_id', checkpoint_id)
    .maybeSingle();

  const { data: record, error } = await supabaseServer
    .from('attendance_records')
    .upsert(
      {
        team_id,
        checkpoint_id,
        members_present: memberIds.length,
        method,
        notes: notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'team_id, checkpoint_id' },
    )
    .select('id')
    .single();

  if (error || !record) {
    console.error('Attendance upsert failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to mark attendance' }, { status: 500 });
  }

  // Replace the per-member rows wholesale — re-marking a checkpoint is an edit,
  // so members unticked on the second pass must disappear.
  const { error: clearError } = await supabaseServer
    .from('attendance_member_records')
    .delete()
    .eq('attendance_record_id', record.id);

  if (clearError) {
    console.error('Clearing member attendance failed:', clearError);
    return NextResponse.json({ success: false, error: 'Failed to mark attendance' }, { status: 500 });
  }

  if (memberIds.length > 0) {
    const { error: insertError } = await supabaseServer
      .from('attendance_member_records')
      .insert(memberIds.map((member_id) => ({ attendance_record_id: record.id, member_id })));

    if (insertError) {
      console.error('Inserting member attendance failed:', insertError);
      return NextResponse.json({ success: false, error: 'Failed to mark attendance' }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    updated: Boolean(prior),
    members_present: memberIds.length,
  });
}
