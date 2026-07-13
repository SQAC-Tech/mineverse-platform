create table attendance_checkpoints (
    id serial primary key,
    code text not null unique,        -- stable machine name
    label text not null,              -- shown in the /attendance dropdown
    round_id integer references rounds(id) on delete set null,
    day integer not null check (day in (1, 2)),
    sequence integer not null,        -- global ordering for reports
    created_at timestamptz not null default now()
);

insert into attendance_checkpoints (code, label, round_id, day, sequence) values
('ROUND_1',         'Round 1 — Forest & Grasslands', 1, 1, 1),
('ROUND_2',         'Round 2 — Cave Biome',          2, 1, 2),
('ROUND_3',         'Round 3 — Mountain Biome',      3, 1, 3),
('ROUND_4_PHASE_1', 'Round 4 — Phase 1',             4, 2, 4),
('ROUND_4_PHASE_2', 'Round 4 — Phase 2',             4, 2, 5);

create table attendance_records (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references teams(id) on delete cascade,
    checkpoint_id integer not null references attendance_checkpoints(id) on delete cascade,
    members_present integer not null check (members_present >= 0),
    method text not null check (method in ('qr_scan', 'manual')),
    notes text,
    marked_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(team_id, checkpoint_id)
);

create index idx_att_rec_team on attendance_records(team_id);
create index idx_att_rec_checkpoint on attendance_records(checkpoint_id);
