import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { requirePanelScope } from '@/lib/panel/require-admin';

export const dynamic = 'force-dynamic';

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
  const { data: teamMembers } = await supabaseServer
    .from('members')
    .select('id')
    .eq('team_id', team_id);

  if (!teamMembers) {
    return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 });
  }

  const validIds = new Set(teamMembers.map((m) => m.id));
  if (memberIds.some((id) => !validIds.has(id))) {
    return NextResponse.json(
      { success: false, error: 'One or more selected members do not belong to this team' },
      { status: 400 },
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
