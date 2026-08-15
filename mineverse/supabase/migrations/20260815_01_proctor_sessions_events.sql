-- Proctoring: an append-only record of what happened in a team's browser during a round.
--
-- The reference implementation (dbug-espionage) kept violation counts in a React
-- ref and posted them in the submit body, which meant the number that decides an
-- accusation was under the accused party's control, and vanished entirely if they
-- closed the tab. Both tables here are written only by server routes that read
-- `team_id` from the session cookie, so neither the identity nor the timing of an
-- event comes from the client.
--
-- Keyed per device, not per team. A three-person team on three laptops is normal
-- play here; without `device_id` their honest browsers would look like one machine
-- switching tabs constantly.

create table if not exists proctor_sessions (
    id                    uuid primary key default gen_random_uuid(),
    team_id               uuid not null references teams(id) on delete cascade,
    round_id              int  not null references rounds(id),
    device_id             text not null,
    user_agent            text,

    -- What the browser could actually enforce. A clean record from a browser with
    -- no Fullscreen API means "we could not watch", not "they behaved".
    capabilities          jsonb not null default '{}'::jsonb,

    started_at            timestamptz not null default now(),
    last_seen_at          timestamptz not null default now(),
    ended_at              timestamptz,

    -- Denormalised so the live console can sort without aggregating the event
    -- table. `proctor_events` stays the truth if the two ever disagree.
    warning_count         int not null default 0,
    key_violation_count   int not null default 0,

    status                text not null default 'active'
                          check (status in ('active', 'flagged', 'ended')),

    unique (team_id, round_id, device_id)
);

create table if not exists proctor_events (
    id          bigserial primary key,
    session_id  uuid not null references proctor_sessions(id) on delete cascade,

    -- Denormalised from the session so the admin feed can filter a round without
    -- a join, and so an event survives being read in isolation.
    team_id     uuid not null references teams(id) on delete cascade,
    round_id    int  not null references rounds(id),

    kind        text not null check (kind in (
        'session_start',
        'tab_hidden',
        'tab_visible',
        'window_blur',
        'fullscreen_exit',
        'fullscreen_restored',
        'copy',
        'paste',
        'context_menu',
        'blocked_key',
        'reload_attempt',
        'heartbeat',
        'session_end'
    )),

    -- 'warning'       — counts against the warning budget (tab/fullscreen)
    -- 'key_violation' — counts against the key budget (blocked shortcuts)
    -- 'info'          — recorded but never escalates (heartbeats, restores)
    severity    text not null check (severity in ('warning', 'key_violation', 'info')),

    detail      jsonb not null default '{}'::jsonb,

    -- Server clock. The client sends a relative offset in `detail` for ordering
    -- within a batch, but never the authoritative timestamp.
    occurred_at timestamptz not null default now()
);

create index if not exists proctor_events_round_time_idx
    on proctor_events (round_id, occurred_at desc);

create index if not exists proctor_events_session_idx
    on proctor_events (session_id, occurred_at desc);

create index if not exists proctor_sessions_round_seen_idx
    on proctor_sessions (round_id, last_seen_at desc);

-- Deny-all, like every other table. All access goes through server routes
-- holding the service-role key.
alter table proctor_sessions enable row level security;
alter table proctor_events   enable row level security;
