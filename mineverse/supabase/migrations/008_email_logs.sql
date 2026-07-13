create table email_logs (
    id uuid primary key default gen_random_uuid(),
    team_id uuid references teams(id) on delete set null,
    member_id uuid references members(id) on delete set null,
    email_type text not null,
        -- 'otp_registration' | 'otp_login' | 'reg_pending' | 'payment_verified'
        -- | 'payment_issue' | 'event_reminder'
    provider text not null check (provider in ('resend', 'smtp')),
    recipient text not null,
    subject text not null,
    status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
    error text,
    sent_at timestamptz,
    created_at timestamptz not null default now()
);

create index idx_email_team on email_logs(team_id);
create index idx_email_type on email_logs(email_type);
create index idx_email_provider on email_logs(provider);
