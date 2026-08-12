import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { requirePanelScope } from '@/lib/panel/require-admin';

export const dynamic = 'force-dynamic';

const DESKS = ['c2c', 'helpdesk'] as const;
type Desk = (typeof DESKS)[number];

function isDesk(value: unknown): value is Desk {
  return typeof value === 'string' && (DESKS as readonly string[]).includes(value);
}

const DESK_LABELS: Record<Desk, string> = { c2c: 'C2C', helpdesk: 'Helpdesk' };

/**
 * Excel and Sheets treat a bare leading =, +, - or @ as a formula, so a name
 * like "-Ravi" would execute on open. Prefixing a quote neutralises it.
 */
function csvCell(value: string | number | null) {
  const raw = value === null ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const params = new URL(req.url).searchParams;
  const desk = params.get('desk');

  let query = supabaseServer
    .from('staff_attendance')
    .select('*')
    .order('reported_at', { ascending: false });

  if (isDesk(desk)) query = query.eq('desk', desk);

  const { data, error } = await query;

  if (error) {
    console.error('Staff attendance read failed:', error);
    return NextResponse.json({ success: false, error: 'Could not load the duty log' }, { status: 500 });
  }

  const rows = data ?? [];

  if (params.get('format') === 'csv') {
    const header = ['Name', 'Desk', 'Date', 'Time', 'Hours', 'Notes'];
    const body = rows.map((r) => {
      const at = new Date(r.reported_at);
      return [
        csvCell(r.person_name),
        csvCell(DESK_LABELS[r.desk as Desk] ?? r.desk),
        csvCell(at.toLocaleDateString('en-GB')),
        csvCell(at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })),
        csvCell(Number(r.hours).toFixed(2)),
        csvCell(r.notes),
      ].join(',');
    });

    const totalHours = rows.reduce((acc, r) => acc + Number(r.hours), 0);
    body.push(['', '', '', csvCell('TOTAL'), csvCell(totalHours.toFixed(2)), ''].join(','));

    const suffix = isDesk(desk) ? `-${desk}` : '';
    const stamp = new Date().toISOString().slice(0, 10);

    // The BOM is what makes Excel read the file as UTF-8 rather than ANSI.
    return new NextResponse('﻿' + [header.join(','), ...body].join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="desk-attendance${suffix}-${stamp}.csv"`,
      },
    });
  }

  return NextResponse.json({ success: true, data: rows });
}

export async function POST(req: Request) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const desk = body.desk;
  const personName = typeof body.person_name === 'string' ? body.person_name.trim() : '';
  const hours = Number(body.hours);

  if (!isDesk(desk)) {
    return NextResponse.json({ success: false, error: 'Pick C2C or Helpdesk' }, { status: 400 });
  }
  if (!personName) {
    return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
  }
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
    return NextResponse.json({ success: false, error: 'Hours must be between 0 and 24' }, { status: 400 });
  }

  // An explicit reported_at lets an organizer backfill a shift they forgot to
  // log; omitting it defaults to now().
  const reportedAt = typeof body.reported_at === 'string' ? new Date(body.reported_at) : new Date();
  if (Number.isNaN(reportedAt.getTime())) {
    return NextResponse.json({ success: false, error: 'Invalid date and time' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('staff_attendance')
    .insert({
      desk,
      person_name: personName,
      hours,
      reported_at: reportedAt.toISOString(),
      notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Staff attendance insert failed:', error);
    return NextResponse.json({ success: false, error: 'Could not save the entry' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

export async function DELETE(req: Request) {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ success: false, error: 'Missing entry id' }, { status: 400 });
  }

  const { error } = await supabaseServer.from('staff_attendance').delete().eq('id', id);

  if (error) {
    console.error('Staff attendance delete failed:', error);
    return NextResponse.json({ success: false, error: 'Could not remove the entry' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
