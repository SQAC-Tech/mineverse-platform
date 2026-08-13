-- Migration 04: Dev 3 - Phase 3 Day 2 Portal Repair, Final Boss, Winner Tracking

create table if not exists day2_portal_fragments (
    team_id uuid primary key references teams(id) on delete cascade,
    awarded_at timestamptz not null default now(),
    source text not null
);

create table if not exists day2_portal_repair (
    team_id uuid primary key references teams(id) on delete cascade,
    repaired_at timestamptz not null default now()
);

create table if not exists day2_final_boss_attempts (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references teams(id) on delete cascade,
    started_at timestamptz not null default now(),
    completed_at timestamptz,
    status text not null check (status in ('active', 'won', 'lost')),
    cooldown_until timestamptz,
    question_payload jsonb not null default '{}'::jsonb,
    score_evidence jsonb
);

create table if not exists day2_provisional_winners (
    team_id uuid primary key references teams(id) on delete cascade,
    claimed_at timestamptz not null default now(),
    status text not null default 'pending' check (status in ('pending', 'pending_tiebreak', 'certified'))
);

create table if not exists day2_champion_certifications (
    team_id uuid primary key references teams(id) on delete cascade,
    certified_by text not null,
    certified_at timestamptz not null default now(),
    reason text not null,
    evidence jsonb not null default '{}'::jsonb
);

-- RLS
alter table day2_portal_fragments enable row level security;
alter table day2_portal_repair enable row level security;
alter table day2_final_boss_attempts enable row level security;
alter table day2_provisional_winners enable row level security;
alter table day2_champion_certifications enable row level security;

-- Index for attempts
create index if not exists idx_day2_final_boss_attempts_team on day2_final_boss_attempts(team_id, started_at desc);
