-- Attendance moves from a head count to a per-member record.
-- attendance_records.members_present is kept as a derived count so existing
-- admin/report reads keep working; the source of truth is now one row per
-- member marked present.
create table if not exists attendance_member_records (
    id uuid primary key default gen_random_uuid(),
    attendance_record_id uuid not null references attendance_records(id) on delete cascade,
    member_id uuid not null references members(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (attendance_record_id, member_id)
);

-- The unique constraint already indexes (attendance_record_id, member_id), which
-- serves the record_id FK lookup as a leftmost prefix. Only member_id needs its own.
create index if not exists idx_att_member_rec_member on attendance_member_records(member_id);

alter table attendance_member_records enable row level security;
-- No policies on purpose: deny-all for anon & authenticated, service-role only.

-- NOTE: teams.qr_token is now unused. The attendance QR encodes the plain
-- team_code (MNV-XXX), so there is no token to store or revoke. The column is
-- left in place rather than dropped to keep this migration non-destructive.
