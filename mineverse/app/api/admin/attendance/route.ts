import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { requirePanelScope } from '@/lib/panel/require-admin';

export const dynamic = 'force-dynamic';

const db = supabaseServer as any;

interface TeamRow {
  team_id: string;
  team_code: string;
  team_name: string;
  team_size: number;
  present: boolean;
  members_present: number;
  member_names: string[];
  method: string | null;
  notes: string | null;
  marked_at: string | null;
}

/**
 * Which teams are in the room, per checkpoint.
 *
 * Distinct from `/admin/staff-attendance`, which logs the volunteers working the
 * desks. This is the one the round gates read: `attendanceGate` refuses a round
 * to any team without a record at the checkpoint covering it, so an organiser
 * needs to see the absentees, not only the arrivals — a team missing from this
 * list cannot start, and on event day that is a queue at the desk rather than a
 * line in a log.
 *
 * Every payment-verified team is returned whether or not it has been marked, so
 * the absent list is the actual absent list.
 */

export async function GET(req: Request) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const checkpointParam = url.searchParams.get('checkpoint_id');

  try {
    const { data: checkpoints, error: checkpointError } = await db
      .from('attendance_checkpoints')
      .select('id, code, label, round_id, day, sequence, covers_rounds')
      .order('day', { ascending: true })
      .order('sequence', { ascending: true });
    if (checkpointError) throw checkpointError;

    const list = checkpoints ?? [];
    if (list.length === 0) {
      return NextResponse.json({ success: true, data: { checkpoints: [], teams: [], summary: null } });
    }

    const checkpointId = checkpointParam ? Number(checkpointParam) : list[0].id;
    const checkpoint = list.find((row: any) => row.id === checkpointId) ?? list[0];

    // Unverified teams never reach a round, so listing them here would inflate
    // the absent count with teams that were never expected.
    const [{ data: teams, error: teamsError }, { data: records, error: recordsError }] = await Promise.all([
      db
        .from('teams')
        .select('id, team_code, team_name, team_size, status')
        .eq('is_payment_verified', true)
        .order('team_code', { ascending: true }),
      db
        .from('attendance_records')
        .select('id, team_id, members_present, method, notes, marked_at')
        .eq('checkpoint_id', checkpoint.id),
    ]);
    if (teamsError) throw teamsError;
    if (recordsError) throw recordsError;

    const recordByTeam = new Map((records ?? []).map((row: any) => [row.team_id, row]));

    // Who was actually ticked off, so a half-present team can be told apart from
    // one whose headcount was typed in without names.
    const recordIds = (records ?? []).map((row: any) => row.id);
    const { data: memberRows } = recordIds.length > 0
      ? await db
          .from('attendance_member_records')
          .select('attendance_record_id, member_id, members(name, is_team_lead)')
          .in('attendance_record_id', recordIds)
      : { data: [] };

    const namesByRecord = new Map<string, string[]>();
    for (const row of memberRows ?? []) {
      const bucket = namesByRecord.get(row.attendance_record_id) ?? [];
      const name = (row as any).members?.name;
      if (name) bucket.push(name);
      namesByRecord.set(row.attendance_record_id, bucket);
    }

    const teamRows: TeamRow[] = (teams ?? []).map((team: any) => {
      const record = recordByTeam.get(team.id) as any;
      return {
        team_id: team.id,
        team_code: team.team_code,
        team_name: team.team_name,
        team_size: team.team_size ?? 0,
        present: Boolean(record),
        members_present: record?.members_present ?? 0,
        member_names: record ? namesByRecord.get(record.id) ?? [] : [],
        method: record?.method ?? null,
        notes: record?.notes ?? null,
        marked_at: record?.marked_at ?? null,
      };
    });

    const present = teamRows.filter((row: TeamRow) => row.present);

    return NextResponse.json({
      success: true,
      data: {
        checkpoints: list,
        checkpoint,
        teams: teamRows,
        summary: {
          total_teams: teamRows.length,
          present: present.length,
          absent: teamRows.length - present.length,
          heads_present: present.reduce((sum: number, row: TeamRow) => sum + Number(row.members_present ?? 0), 0),
          heads_expected: teamRows.reduce((sum: number, row: TeamRow) => sum + Number(row.team_size ?? 0), 0),
          // A team marked present with fewer people than it registered. Worth
          // seeing on its own: it is the case a headcount total hides.
          partial: present.filter((row: TeamRow) => row.members_present > 0 && row.members_present < row.team_size).length,
        },
      },
    });
  } catch (error) {
    console.error('Admin attendance error:', error);
    return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
  }
}
