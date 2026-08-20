create table if not exists relay_screening_attempts (
    id             uuid primary key default gen_random_uuid(),
    team_id        uuid not null unique references teams(id) on delete cascade,
    
    word_assigned  text not null,
    
    -- Status of the two years' questions
    year1_status   text not null default 'pending' check (year1_status in ('pending', 'completed')),
    year1_answer   text,
    
    year2_status   text not null default 'pending' check (year2_status in ('pending', 'completed')),
    year2_answer   text,
    
    -- Overall completion
    is_completed   boolean not null default false,
    
    started_at     timestamptz not null default now(),
    submitted_at   timestamptz,
    
    created_at     timestamptz not null default now()
);

alter table relay_screening_attempts enable row level security;

-- Only authenticated users (or maybe just admins) should view all. Teams should only view their own.
create policy "Teams can view their own relay attempt"
    on relay_screening_attempts for select
    to authenticated
    using (team_id in (
        select team_id from members where id = auth.uid()
    ));

-- Since we might have an API or Server Action acting as a service role, we don't necessarily need RLS insert policies for the user.
-- But if we do client side inserts:
create policy "Teams can insert their own relay attempt"
    on relay_screening_attempts for insert
    to authenticated
    with check (team_id in (
        select team_id from members where id = auth.uid()
    ));

create policy "Teams can update their own relay attempt"
    on relay_screening_attempts for update
    to authenticated
    using (team_id in (
        select team_id from members where id = auth.uid()
    ));
