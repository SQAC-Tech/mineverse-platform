create table members (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references teams(id) on delete cascade,
    name text not null,
    email text not null,
    college_email text not null unique,
    phone text not null,
    section text,
    department text not null,
    is_team_lead boolean not null default false,
    email_verified boolean not null default false,  -- true for the lead (OTP-verified pre-submit)
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(team_id, email)
);

create index idx_members_team on members(team_id);
create index idx_members_college_email on members(college_email);
