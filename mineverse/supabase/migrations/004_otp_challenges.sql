create table otp_challenges (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    otp_hash text not null,                    -- sha256(otp || JWT_SECRET)
    purpose text not null check (purpose in ('registration', 'login')),
    team_id uuid references teams(id) on delete cascade,  -- null for registration
    attempts integer not null default 0,
    verified boolean not null default false,
    verification_token uuid not null default gen_random_uuid(),
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
);

create index idx_otp_email_purpose on otp_challenges(email, purpose);
create index idx_otp_expires on otp_challenges(expires_at);   -- for cleanup cron
