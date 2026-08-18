import { supabaseServer } from '@/lib/supabase/server';
import { requirePanelScope } from '@/lib/panel/require-admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Offline snapshot of the registration data — one row per member, carrying the
 * team and payment columns alongside. Flat rather than three files because the
 * point is to be able to rebuild a team from a single row after a bad delete.
 *
 * `qr_token` is deliberately left out: attendance QRs carry the plain team code,
 * so the token buys the holder nothing and a downloadable copy of it is a
 * liability rather than a backup.
 */
const COLUMNS = [
  'team_code',
  'team_name',
  'team_size',
  'status',
  'is_payment_verified',
  'total_score',
  'team_created_at',
  'member_name',
  'member_email',
  'member_college_email',
  'member_phone',
  'member_registration_no',
  'member_department',
  'member_section',
  'is_team_lead',
  'email_verified',
  'payment_amount',
  'payment_transaction_id',
  'payment_sender_name',
  'payment_sender_upi_id',
  'payment_status',
  'payment_verified_at',
] as const;

/** RFC 4180: wrap everything, double up embedded quotes. Excel-safe. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

export async function GET() {
  const guard = await requirePanelScope('admin');
  if (!guard.ok) return guard.response;

  const { data: teams, error } = await supabaseServer
    .from('teams')
    .select('*, members(*), payments(*)')
    .order('team_code');

  if (error) {
    console.error('Export failed:', error);
    return NextResponse.json({ success: false, error: 'Database error: ' + error.message }, { status: 500 });
  }

  const lines = [COLUMNS.join(',')];

  for (const team of teams ?? []) {
    // A team with no members still gets a row, otherwise it would vanish from a
    // backup taken mid-registration.
    const members = team.members?.length ? team.members : [null];
    // One payment row per team, so PostgREST embeds it as an object, not a list.
    const payment = team.payments ?? null;

    for (const member of members) {
      lines.push(
        [
          team.team_code,
          team.team_name,
          team.team_size,
          team.status,
          team.is_payment_verified,
          team.total_score,
          team.created_at,
          member?.name,
          member?.email,
          member?.college_email,
          member?.phone,
          member?.registration_no,
          member?.department,
          member?.section,
          member?.is_team_lead,
          member?.email_verified,
          payment?.amount,
          payment?.transaction_id,
          payment?.sender_name,
          payment?.sender_upi_id,
          payment?.status,
          payment?.verified_at,
        ]
          .map(csvCell)
          .join(','),
      );
    }
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  // ﻿ so Excel reads the file as UTF-8 and does not mangle names.
  return new NextResponse('﻿' + lines.join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="mineverse-teams-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
