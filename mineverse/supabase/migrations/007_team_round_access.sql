create table team_round_access (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references teams(id) on delete cascade,
    round_id integer not null references rounds(id) on delete cascade,
    is_locked boolean not null default true,
    started_at timestamptz,
    completed_at timestamptz,
    score integer not null default 0,
    created_at timestamptz not null default now(),
    unique(team_id, round_id)
);

create index idx_tra_team on team_round_access(team_id);
create index idx_tra_round on team_round_access(round_id);
