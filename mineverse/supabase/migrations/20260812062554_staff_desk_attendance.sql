-- Duty log for the volunteer desks (C2C and Helpdesk). Unrelated to team
-- attendance: this records which staffer showed up, when, and for how long.
create table if not exists staff_attendance (
    id uuid primary key default gen_random_uuid(),
    desk text not null check (desk in ('c2c', 'helpdesk')),
    person_name text not null check (length(btrim(person_name)) > 0),
    reported_at timestamptz not null default now(),
    hours numeric(4, 2) not null check (hours > 0 and hours <= 24),
    notes text,
    created_at timestamptz not null default now()
);

-- The page always reads "one desk, newest first".
create index if not exists idx_staff_attendance_desk_time
    on staff_attendance (desk, reported_at desc);

alter table staff_attendance enable row level security;
-- No policies on purpose: deny-all for anon & authenticated, service-role only.
