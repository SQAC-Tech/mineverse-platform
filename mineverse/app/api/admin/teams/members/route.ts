import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { requirePanelScope } from '@/lib/panel/require-admin';

export const dynamic = 'force-dynamic';

/** `teams_team_size_check` caps a team at 3, so that is the slot ceiling. */
const MAX_TEAM_SIZE = 3;

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/**
 * Adds a member to an existing team, provided the team still has a free slot.
 *
 * This is an organizer override for the desk — someone turns up who was left
 * off the form, or a duo wants to become a trio on the day. Deliberately looser
 * than public registration: no OTP, and the college-email domain is not
 * enforced, because the escape hatch exists precisely for the cases the public
 * form rejects. The fee is NOT recalculated; the payment row keeps the amount
 * the team actually paid, and any top-up is collected off-platform.
 */
export async function POST(req: Request) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));

  const teamId = str(body.team_id);
  const name = str(body.name);
  const email = str(body.email).toLowerCase();
  const collegeEmail = str(body.college_email).toLowerCase();
  const phone = str(body.phone);
  const department = str(body.department);
  const section = str(body.section);

  if (!teamId) {
    return NextResponse.json({ success: false, error: 'Missing team' }, { status: 400 });
  }
  if (name.length < 2) {
    return NextResponse.json({ success: false, error: 'Enter the full name' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, error: 'Enter a valid personal email' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(collegeEmail)) {
    return NextResponse.json({ success: false, error: 'Enter a valid college email' }, { status: 400 });
  }
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return NextResponse.json({ success: false, error: 'Phone must be a 10-digit Indian number' }, { status: 400 });
  }
  if (!department) {
    return NextResponse.json({ success: false, error: 'Enter the department' }, { status: 400 });
  }

  const { data: team, error: teamErr } = await supabaseServer
    .from('teams')
    .select('id, team_code, team_name, team_size, members(id)')
    .eq('id', teamId)
    .single();

  if (teamErr || !team) {
    return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 });
  }

  const current = team.members?.length ?? 0;
  if (current >= MAX_TEAM_SIZE) {
    return NextResponse.json(
      { success: false, error: `${team.team_code} is already full (${MAX_TEAM_SIZE} members)` },
      { status: 409 },
    );
  }

  const { data: member, error: insertErr } = await supabaseServer
    .from('members')
    .insert({
      team_id: teamId,
      name,
      email,
      college_email: collegeEmail,
      phone,
      department,
      section: section || null,
      is_team_lead: false,
      // No OTP was sent for this one — an organizer vouched for them instead.
      email_verified: false,
    })
    .select('id, name, email, phone')
    .single();

  if (insertErr) {
    // 23505 is a unique violation: college_email is unique platform-wide and
    // (team_id, email) is unique per team.
    if (insertErr.code === '23505') {
      const onCollege = insertErr.message?.includes('college_email');
      return NextResponse.json(
        {
          success: false,
          error: onCollege
            ? 'That college email is already registered to a team'
            : 'That personal email is already on this team',
        },
        { status: 409 },
      );
    }
    console.error('Admin add member failed:', insertErr);
    return NextResponse.json({ success: false, error: 'Could not add the member' }, { status: 500 });
  }

  // team_size drives the attendance checklist ("Mark 2/3"), so keep it in step
  // with the real headcount.
  const { error: sizeErr } = await supabaseServer
    .from('teams')
    .update({ team_size: current + 1 })
    .eq('id', teamId);

  if (sizeErr) {
    console.error('Team size update failed after adding member:', sizeErr);
  }

  return NextResponse.json({ success: true, data: member });
}
