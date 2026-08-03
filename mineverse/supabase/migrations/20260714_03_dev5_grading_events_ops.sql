-- Migration 03: Dev 5 - Grading, World Events, Offline Results, Online PvP Operations
-- Depends on: 20260714_01 (resource_ledger, submissions, mutate_team_resources)
--             20260714_02 (structures, team_game_state)
--
-- Applied to the event project in two parts: the tables landed as
-- `20260714_03_dev5_grading_events_ops` and the RPC section at the bottom of this
-- file as `20260714_03b_dev5_operational_rpcs`. Applying this file whole against a
-- clean database produces the same result.

-- ---------------------------------------------------------------------------
-- Grading
-- ---------------------------------------------------------------------------

create table if not exists grading_runs (
    id uuid primary key default gen_random_uuid(),
    round_id integer not null references rounds(id) on delete cascade,
    state text not null default 'queued'
        check (state in ('queued', 'running', 'completed', 'failed', 'cancelled')),
    initiated_by text not null,
    cursor text,
    batch_size integer not null default 25,
    processed_count integer not null default 0,
    total_count integer not null default 0,
    manual_review_count integer not null default 0,
    provider text,
    model text,
    error text,
    created_at timestamptz not null default now(),
    started_at timestamptz,
    completed_at timestamptz
);

-- Only one active (queued/running) run per round.
create unique index if not exists idx_grading_runs_active_per_round
    on grading_runs(round_id)
    where state in ('queued', 'running');
create index if not exists idx_grading_runs_round_created on grading_runs(round_id, created_at desc);

create table if not exists grading_items (
    id uuid primary key default gen_random_uuid(),
    run_id uuid references grading_runs(id) on delete set null,
    submission_id uuid not null references submissions(id) on delete cascade,
    revision integer not null,
    path text not null check (path in ('deterministic', 'rubric')),
    state text not null default 'queued'
        check (state in ('queued', 'running', 'completed', 'failed', 'manual_review')),
    -- Protected provider payload. Never returned to a team response.
    provider_metadata jsonb,
    validated_result jsonb,
    final_score numeric,
    error text,
    ledger_id uuid references resource_ledger(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    -- Exactly-once finalization for a given submission revision.
    unique (submission_id, revision)
);

create index if not exists idx_grading_items_run_state on grading_items(run_id, state);
create index if not exists idx_grading_items_submission on grading_items(submission_id);
create index if not exists idx_grading_items_ledger on grading_items(ledger_id);

-- ---------------------------------------------------------------------------
-- World events
-- ---------------------------------------------------------------------------

create table if not exists world_events (
    id uuid primary key default gen_random_uuid(),
    event_key text not null check (event_key in (
        'heavy_rain', 'fertile_marsh', 'creeper_explosion',
        'gold_rush', 'lava_eruption', 'ghast_bombardment'
    )),
    round_id integer not null references rounds(id) on delete cascade,
    scope text not null default 'all' check (scope in ('all', 'targeted')),
    target_team_ids uuid[] not null default '{}',
    effect jsonb not null default '{}'::jsonb,
    status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
    starts_at timestamptz not null default now(),
    ends_at timestamptz,
    triggered_by text not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_world_events_round_window on world_events(round_id, starts_at desc);
create unique index if not exists idx_world_events_active_key
    on world_events(event_key, round_id)
    where status = 'active';

create table if not exists team_event_effects (
    id uuid primary key default gen_random_uuid(),
    world_event_id uuid not null references world_events(id) on delete cascade,
    team_id uuid not null references teams(id) on delete cascade,
    -- Multiplier modifiers ({"wood": 2}) surface to the team as active modifiers.
    modifier jsonb not null default '{}'::jsonb,
    -- Recorded protection outcome, e.g. bat_cave / bastion absorbed the event.
    protection text,
    resolution text,
    ledger_id uuid references resource_ledger(id),
    applied_at timestamptz not null default now(),
    expires_at timestamptz,
    unique (world_event_id, team_id)
);

create index if not exists idx_team_event_effects_team_expiry
    on team_event_effects(team_id, expires_at desc);
create index if not exists idx_team_event_effects_event on team_event_effects(world_event_id);
create index if not exists idx_team_event_effects_ledger on team_event_effects(ledger_id);

-- ---------------------------------------------------------------------------
-- Offline (physical game) results
-- ---------------------------------------------------------------------------

create table if not exists offline_results (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references teams(id) on delete cascade,
    round_id integer not null references rounds(id) on delete cascade,
    activity text not null,
    award jsonb not null default '{}'::jsonb,
    volunteer_name text,
    recorded_by text not null,
    idempotency_key uuid not null,
    ledger_id uuid references resource_ledger(id),
    notes text,
    created_at timestamptz not null default now(),
    -- Pays once per team/activity/round, and retries of the same request are inert.
    unique (team_id, activity, round_id),
    unique (team_id, idempotency_key)
);

create index if not exists idx_offline_results_round on offline_results(round_id, created_at desc);
create index if not exists idx_offline_results_ledger on offline_results(ledger_id);

-- ---------------------------------------------------------------------------
-- Online Round 3 PvP (private duel, not a bracket)
-- ---------------------------------------------------------------------------

create table if not exists pvp_matches (
    id uuid primary key default gen_random_uuid(),
    round_id integer not null references rounds(id) on delete cascade,
    pack_id text not null,
    pack_version text not null default 'v1',
    status text not null default 'draft'
        check (status in ('draft', 'live', 'resolved', 'expired', 'cancelled', 'voided')),
    duration_seconds integer not null default 600,
    started_at timestamptz,
    deadline_at timestamptz,
    resolved_at timestamptz,
    winner_team_id uuid references teams(id) on delete set null,
    result_summary jsonb,
    created_by text not null,
    started_by text,
    resolved_by text,
    voided_by text,
    void_reason text,
    replay_of_match_id uuid references pvp_matches(id) on delete set null,
    audit_correlation_id uuid not null default gen_random_uuid(),
    created_at timestamptz not null default now()
);

create index if not exists idx_pvp_matches_status on pvp_matches(status, created_at desc);
create index if not exists idx_pvp_matches_round on pvp_matches(round_id);
create index if not exists idx_pvp_matches_winner on pvp_matches(winner_team_id);
create index if not exists idx_pvp_matches_replay_of on pvp_matches(replay_of_match_id);

create table if not exists pvp_match_teams (
    id uuid primary key default gen_random_uuid(),
    match_id uuid not null references pvp_matches(id) on delete cascade,
    team_id uuid not null references teams(id) on delete cascade,
    status text not null default 'pending'
        check (status in ('pending', 'live', 'completed', 'void')),
    eligibility_snapshot jsonb not null default '{}'::jsonb,
    completion_at timestamptz,
    elapsed_ms integer,
    outcome text check (outcome in ('won', 'lost')),
    created_at timestamptz not null default now(),
    unique (match_id, team_id)
);

create index if not exists idx_pvp_match_teams_match on pvp_match_teams(match_id);
create index if not exists idx_pvp_match_teams_team_created
    on pvp_match_teams(team_id, created_at desc);
-- A team may sit in at most one unresolved match at a time.
create unique index if not exists idx_pvp_match_teams_one_active
    on pvp_match_teams(team_id)
    where status in ('pending', 'live');

-- A private duel is exactly two distinct teams; reject a third participant.
create or replace function enforce_pvp_match_pair()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    participant_count integer;
begin
    select count(*) into participant_count
    from pvp_match_teams
    where match_id = new.match_id;

    if participant_count >= 2 then
        raise exception 'pvp match already has two teams' using errcode = 'check_violation';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_pvp_match_pair on pvp_match_teams;
create trigger trg_pvp_match_pair
    before insert on pvp_match_teams
    for each row execute function enforce_pvp_match_pair();

create table if not exists pvp_match_questions (
    id uuid primary key default gen_random_uuid(),
    match_id uuid not null references pvp_matches(id) on delete cascade,
    source_question_id uuid references questions(id) on delete set null,
    display_order integer not null,
    type text not null,
    prompt text not null,
    content jsonb not null default '{}'::jsonb,
    language_options text[] not null default '{}'::text[],
    time_limit_seconds integer,
    -- Sealed pack snapshot. Server-only; never selected into a team response.
    expected_answer jsonb,
    created_at timestamptz not null default now(),
    unique (match_id, display_order)
);

create index if not exists idx_pvp_match_questions_match on pvp_match_questions(match_id, display_order);
create index if not exists idx_pvp_match_questions_source on pvp_match_questions(source_question_id);

create table if not exists pvp_match_submissions (
    id uuid primary key default gen_random_uuid(),
    match_id uuid not null references pvp_matches(id) on delete cascade,
    team_id uuid not null references teams(id) on delete cascade,
    match_question_id uuid not null references pvp_match_questions(id) on delete cascade,
    answer_text text not null,
    revision integer not null default 1,
    status text not null default 'submitted'
        check (status in ('submitted', 'correct', 'incorrect')),
    is_correct boolean,
    validated_at timestamptz,
    idempotency_key uuid not null,
    submitted_at timestamptz not null default now(),
    unique (team_id, idempotency_key),
    unique (match_id, team_id, match_question_id, revision)
);

create index if not exists idx_pvp_match_submissions_match_team
    on pvp_match_submissions(match_id, team_id);
create index if not exists idx_pvp_match_submissions_question
    on pvp_match_submissions(match_question_id);

-- Immutable resolved projection consumed by qualification.
create table if not exists pvp_results (
    id uuid primary key default gen_random_uuid(),
    match_id uuid not null unique references pvp_matches(id) on delete cascade,
    winner_team_id uuid not null references teams(id) on delete cascade,
    loser_team_id uuid not null references teams(id) on delete cascade,
    winner_elapsed_ms integer,
    award_ledger_id uuid references resource_ledger(id),
    source text not null default 'online_pvp',
    resolved_at timestamptz not null default now(),
    constraint pvp_results_distinct_teams check (winner_team_id <> loser_team_id)
);

-- One final Round 3 PvP result per team, on either side of the duel.
create unique index if not exists idx_pvp_results_winner_once on pvp_results(winner_team_id);
create unique index if not exists idx_pvp_results_loser_once on pvp_results(loser_team_id);
create index if not exists idx_pvp_results_award_ledger on pvp_results(award_ledger_id);

-- ---------------------------------------------------------------------------
-- Manual adjustments
-- ---------------------------------------------------------------------------

create table if not exists manual_adjustments (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references teams(id) on delete cascade,
    delta jsonb not null,
    reason text not null check (length(btrim(reason)) > 0),
    admin_id text not null,
    balance_before jsonb,
    balance_after jsonb,
    ledger_id uuid references resource_ledger(id),
    idempotency_key uuid not null,
    created_at timestamptz not null default now(),
    unique (team_id, idempotency_key)
);

create index if not exists idx_manual_adjustments_team on manual_adjustments(team_id, created_at desc);
create index if not exists idx_manual_adjustments_ledger on manual_adjustments(ledger_id);

-- ---------------------------------------------------------------------------
-- Deny-all RLS. Phase 2 tables are server-only via the service role.
-- ---------------------------------------------------------------------------

alter table grading_runs enable row level security;
alter table grading_items enable row level security;
alter table world_events enable row level security;
alter table team_event_effects enable row level security;
alter table offline_results enable row level security;
alter table pvp_matches enable row level security;
alter table pvp_match_teams enable row level security;
alter table pvp_match_questions enable row level security;
alter table pvp_match_submissions enable row level security;
alter table pvp_results enable row level security;
alter table manual_adjustments enable row level security;

-- ---------------------------------------------------------------------------
-- Operational RPCs
-- ---------------------------------------------------------------------------

-- Start a draft match: validates the pair, stamps the server clock, goes live.
create or replace function start_pvp_match(
    p_match_id uuid,
    p_admin_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    match_row pvp_matches%rowtype;
    participant_count integer;
    question_count integer;
    now_ts timestamptz := now();
begin
    select * into match_row from pvp_matches where id = p_match_id for update;
    if not found then
        raise exception 'match not found' using errcode = 'no_data_found';
    end if;

    if match_row.status = 'live' then
        return jsonb_build_object(
            'match_id', match_row.id,
            'status', match_row.status,
            'started_at', match_row.started_at,
            'deadline_at', match_row.deadline_at,
            'idempotent', true
        );
    end if;

    if match_row.status <> 'draft' then
        raise exception 'match is not a startable draft' using errcode = 'check_violation';
    end if;

    select count(*) into participant_count from pvp_match_teams where match_id = p_match_id;
    if participant_count <> 2 then
        raise exception 'match requires exactly two teams' using errcode = 'check_violation';
    end if;

    select count(*) into question_count from pvp_match_questions where match_id = p_match_id;
    if question_count = 0 then
        raise exception 'match has no sealed question pack' using errcode = 'check_violation';
    end if;

    update pvp_matches
    set status = 'live',
        started_at = now_ts,
        deadline_at = now_ts + make_interval(secs => match_row.duration_seconds),
        started_by = p_admin_id
    where id = p_match_id;

    update pvp_match_teams
    set status = 'live'
    where match_id = p_match_id;

    return jsonb_build_object(
        'match_id', p_match_id,
        'status', 'live',
        'started_at', now_ts,
        'deadline_at', now_ts + make_interval(secs => match_row.duration_seconds),
        'idempotent', false
    );
end;
$$;

-- Resolve a live match from server-recorded completion times only.
-- The winner award is the canonical Round 3 PvP reward from the event brief.
create or replace function resolve_pvp_match(
    p_match_id uuid,
    p_admin_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    match_row pvp_matches%rowtype;
    winner pvp_match_teams%rowtype;
    loser pvp_match_teams%rowtype;
    existing_result pvp_results%rowtype;
    award jsonb := '{"gold": 20, "iron": 15, "stone": 25, "emerald": 4}'::jsonb;
    mutation jsonb;
    now_ts timestamptz := now();
begin
    select * into match_row from pvp_matches where id = p_match_id for update;
    if not found then
        raise exception 'match not found' using errcode = 'no_data_found';
    end if;

    select * into existing_result from pvp_results where match_id = p_match_id;
    if found then
        return jsonb_build_object(
            'match_id', p_match_id,
            'winner_team_id', existing_result.winner_team_id,
            'loser_team_id', existing_result.loser_team_id,
            'idempotent', true
        );
    end if;

    if match_row.status <> 'live' then
        raise exception 'match is not live' using errcode = 'check_violation';
    end if;

    -- Shortest server-recorded elapsed time wins; a team with no completion cannot win.
    select * into winner
    from pvp_match_teams
    where match_id = p_match_id and completion_at is not null
    order by elapsed_ms asc nulls last, completion_at asc
    limit 1;

    if not found then
        raise exception 'no team has completed the pack' using errcode = 'check_violation';
    end if;

    select * into loser
    from pvp_match_teams
    where match_id = p_match_id and id <> winner.id
    limit 1;

    if not found then
        raise exception 'match is missing its second team' using errcode = 'check_violation';
    end if;

    mutation := mutate_team_resources(
        winner.team_id,
        award,
        'pvp_victory',
        p_match_id::text,
        match_row.audit_correlation_id,
        'Won the Round 3 PvP duel',
        'admin',
        p_admin_id
    );

    update pvp_match_teams
    set status = 'completed', outcome = 'won'
    where id = winner.id;

    update pvp_match_teams
    set status = 'completed', outcome = 'lost'
    where id = loser.id;

    update pvp_matches
    set status = 'resolved',
        resolved_at = now_ts,
        resolved_by = p_admin_id,
        winner_team_id = winner.team_id,
        result_summary = jsonb_build_object(
            'winner_elapsed_ms', winner.elapsed_ms,
            'award', award
        )
    where id = p_match_id;

    insert into pvp_results (
        match_id, winner_team_id, loser_team_id,
        winner_elapsed_ms, award_ledger_id, resolved_at
    ) values (
        p_match_id, winner.team_id, loser.team_id,
        winner.elapsed_ms, (mutation ->> 'ledger_id')::uuid, now_ts
    );

    -- Nether Core x1 per PvP win, per the event brief.
    insert into team_game_state (team_id, nether_core_count, updated_at)
    values (winner.team_id, 1, now_ts)
    on conflict (team_id) do update
    set nether_core_count = team_game_state.nether_core_count + 1,
        updated_at = now_ts;

    return jsonb_build_object(
        'match_id', p_match_id,
        'winner_team_id', winner.team_id,
        'loser_team_id', loser.team_id,
        'winner_elapsed_ms', winner.elapsed_ms,
        'award_ledger_id', mutation ->> 'ledger_id',
        'idempotent', false
    );
end;
$$;

-- Void a match. A resolved result is immutable and is never rewritten.
create or replace function void_pvp_match(
    p_match_id uuid,
    p_admin_id text,
    p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    match_row pvp_matches%rowtype;
begin
    if p_reason is null or length(btrim(p_reason)) = 0 then
        raise exception 'void reason is required' using errcode = 'check_violation';
    end if;

    select * into match_row from pvp_matches where id = p_match_id for update;
    if not found then
        raise exception 'match not found' using errcode = 'no_data_found';
    end if;

    if match_row.status = 'resolved' then
        raise exception 'a resolved match cannot be voided' using errcode = 'check_violation';
    end if;

    if match_row.status = 'voided' then
        return jsonb_build_object('match_id', p_match_id, 'status', 'voided', 'idempotent', true);
    end if;

    update pvp_matches
    set status = 'voided', voided_by = p_admin_id, void_reason = p_reason
    where id = p_match_id;

    -- Frees both teams for a replay match; no award is issued.
    update pvp_match_teams set status = 'void' where match_id = p_match_id;

    return jsonb_build_object('match_id', p_match_id, 'status', 'voided', 'idempotent', false);
end;
$$;

-- Audited manual resource adjustment.
create or replace function apply_manual_adjustment(
    p_team_id uuid,
    p_delta jsonb,
    p_reason text,
    p_admin_id text,
    p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    existing manual_adjustments%rowtype;
    before_row resources%rowtype;
    mutation jsonb;
begin
    if p_reason is null or length(btrim(p_reason)) = 0 then
        raise exception 'adjustment reason is required' using errcode = 'check_violation';
    end if;

    select * into existing
    from manual_adjustments
    where team_id = p_team_id and idempotency_key = p_idempotency_key;

    if found then
        return jsonb_build_object(
            'adjustment_id', existing.id,
            'ledger_id', existing.ledger_id,
            'balance_before', existing.balance_before,
            'balance_after', existing.balance_after,
            'idempotent', true
        );
    end if;

    select * into before_row from resources where team_id = p_team_id;

    mutation := mutate_team_resources(
        p_team_id,
        p_delta,
        'manual_adjustment',
        null,
        p_idempotency_key,
        p_reason,
        'admin',
        p_admin_id
    );

    insert into manual_adjustments (
        team_id, delta, reason, admin_id,
        balance_before, balance_after, ledger_id, idempotency_key
    ) values (
        p_team_id,
        p_delta,
        p_reason,
        p_admin_id,
        case when before_row.team_id is null then null
             else dev4_resource_snapshot(before_row.wood, before_row.stone, before_row.iron,
                                         before_row.gold, before_row.diamond, before_row.emerald,
                                         before_row.obsidian)
        end,
        mutation -> 'balance',
        (mutation ->> 'ledger_id')::uuid,
        p_idempotency_key
    );

    return jsonb_build_object(
        'ledger_id', mutation ->> 'ledger_id',
        'balance_after', mutation -> 'balance',
        'idempotent', false
    );
end;
$$;

-- Record a verified offline (physical game) result exactly once.
create or replace function record_offline_result(
    p_team_id uuid,
    p_round_id integer,
    p_activity text,
    p_award jsonb,
    p_volunteer_name text,
    p_admin_id text,
    p_idempotency_key uuid,
    p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    existing offline_results%rowtype;
    mutation jsonb;
begin
    select * into existing
    from offline_results
    where team_id = p_team_id and idempotency_key = p_idempotency_key;

    if found then
        return jsonb_build_object(
            'offline_result_id', existing.id,
            'ledger_id', existing.ledger_id,
            'idempotent', true
        );
    end if;

    if exists (
        select 1 from offline_results
        where team_id = p_team_id and activity = p_activity and round_id = p_round_id
    ) then
        raise exception 'offline result already recorded' using errcode = 'unique_violation';
    end if;

    mutation := mutate_team_resources(
        p_team_id,
        p_award,
        'offline_result',
        p_activity,
        p_idempotency_key,
        'Offline game: ' || p_activity,
        'admin',
        p_admin_id
    );

    insert into offline_results (
        team_id, round_id, activity, award, volunteer_name,
        recorded_by, idempotency_key, ledger_id, notes
    ) values (
        p_team_id, p_round_id, p_activity, p_award, p_volunteer_name,
        p_admin_id, p_idempotency_key, (mutation ->> 'ledger_id')::uuid, p_notes
    );

    return jsonb_build_object(
        'ledger_id', mutation ->> 'ledger_id',
        'balance', mutation -> 'balance',
        'idempotent', false
    );
end;
$$;
