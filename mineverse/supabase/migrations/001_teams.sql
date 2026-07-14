create table teams (
    id uuid primary key default gen_random_uuid(),
    team_code text not null unique,            -- Format: MNV-XXX
    team_name text not null,
    team_size integer not null check (team_size between 1 and 3),
    status text not null default 'payment_pending'
        check (status in ('payment_pending', 'verified', 'active', 'eliminated', 'champion')),
    is_payment_verified boolean not null default false,
    qr_token text unique,                      -- attendance QR JWT, set on payment verification
    total_score integer not null default 0,    -- Phase 2
    completion_time integer not null default 0,-- Phase 2, seconds
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_teams_status on teams(status);
create index idx_teams_payment on teams(is_payment_verified);
