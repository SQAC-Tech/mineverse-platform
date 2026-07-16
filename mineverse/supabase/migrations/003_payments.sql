create table payments (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null unique references teams(id) on delete cascade,
    amount integer not null,
    team_size integer not null,
    upi_string text,                           -- the upi:// deep link used for the QR
    transaction_id text not null unique,       -- UPI txn ref entered by the team before submit
    sender_name text not null,                 -- name on the paying UPI account
    status text not null default 'pending'
        check (status in ('pending', 'verified', 'rejected')),
    verified_at timestamptz,
    admin_notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_payments_status on payments(status);
