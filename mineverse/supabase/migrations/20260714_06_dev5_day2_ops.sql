-- Migration 06: Dev 5 - Phase 3 Day 2 admin operations.
-- Additive only. Resource changes go through mutate_team_resources so every
-- accepted effect is tied to the Phase 2 resource_ledger contract.

create table if not exists day2_offline_results (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references teams(id) on delete cascade,
    round_id integer not null default 4 references rounds(id) on delete restrict,
    activity_key text not null check (activity_key in (
        'memory_challenge',
        'spot_the_difference',
        'insta_lollipop_soap',
        'crack_the_code',
        'cup_flip'
    )),
    outcome text not null check (outcome in ('completed', 'win', 'loss')),
    award jsonb not null default '{}'::jsonb,
    portal_fragment_delta integer not null default 0 check (portal_fragment_delta in (0, 1)),
    volunteer_identity text not null check (length(btrim(volunteer_identity)) > 0),
    recorded_by text not null,
    recorded_at timestamptz not null default now(),
    idempotency_key uuid not null,
    reason text not null check (length(btrim(reason)) > 0),
    notes text,
    ledger_id uuid not null references resource_ledger(id),
    qualification_snapshot jsonb not null default '{}'::jsonb,
    unique (team_id, activity_key),
    unique (team_id, idempotency_key)
);

create index if not exists idx_day2_offline_results_created
    on day2_offline_results(recorded_at desc);
create index if not exists idx_day2_offline_results_team
    on day2_offline_results(team_id, recorded_at desc);
create index if not exists idx_day2_offline_results_ledger
    on day2_offline_results(ledger_id);

create table if not exists day2_event_instances (
    id uuid primary key default gen_random_uuid(),
    event_key text not null check (event_key in (
        'chorus_fruit_blessing',
        'enderman_ambush',
        'dragons_fury'
    )),
    round_id integer not null default 5,
    scope text not null default 'targeted' check (scope in ('all_qualified', 'targeted')),
    target_team_ids uuid[] not null default '{}',
    effect jsonb not null default '{}'::jsonb,
    status text not null default 'active' check (status in ('active', 'completed', 'expired', 'cancelled')),
    starts_at timestamptz not null default now(),
    ends_at timestamptz,
    triggered_by text not null,
    triggered_at timestamptz not null default now(),
    idempotency_key uuid not null unique,
    reason text not null check (length(btrim(reason)) > 0),
    notes text
);

create unique index if not exists idx_day2_chorus_active_once
    on day2_event_instances(event_key)
    where event_key = 'chorus_fruit_blessing' and status = 'active';
create index if not exists idx_day2_event_instances_key_time
    on day2_event_instances(event_key, starts_at desc);

create table if not exists day2_event_effects (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references day2_event_instances(id) on delete cascade,
    team_id uuid not null references teams(id) on delete cascade,
    delta jsonb not null default '{}'::jsonb,
    protection text,
    resolution text not null check (resolution in (
        'window_opened',
        'applied',
        'protected',
        'insufficient_balance',
        'skipped_not_qualified'
    )),
    ledger_id uuid not null references resource_ledger(id),
    idempotency_key uuid not null,
    reason text not null check (length(btrim(reason)) > 0),
    applied_by text not null,
    applied_at timestamptz not null default now(),
    notes text,
    unique (event_id, team_id),
    unique (team_id, idempotency_key)
);

create index if not exists idx_day2_event_effects_team
    on day2_event_effects(team_id, applied_at desc);
create index if not exists idx_day2_event_effects_ledger
    on day2_event_effects(ledger_id);

create table if not exists day2_manual_adjustments (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references teams(id) on delete cascade,
    requested_delta jsonb not null,
    reason text not null check (length(btrim(reason)) > 0),
    admin_id text not null,
    requested_at timestamptz not null default now(),
    idempotency_key uuid not null,
    expected_balance_before jsonb not null,
    expected_balance_after jsonb not null,
    balance_before jsonb not null,
    balance_after jsonb not null,
    ledger_id uuid not null references resource_ledger(id),
    status text not null default 'completed' check (status in ('completed', 'blocked')),
    notes text,
    unique (team_id, idempotency_key)
);

create index if not exists idx_day2_manual_adjustments_team
    on day2_manual_adjustments(team_id, requested_at desc);
create index if not exists idx_day2_manual_adjustments_ledger
    on day2_manual_adjustments(ledger_id);

create table if not exists day2_reconciliations (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references teams(id) on delete cascade,
    state text not null check (state in ('completed', 'blocked')),
    qualification_snapshot jsonb not null,
    resource_balance jsonb not null,
    resource_version integer not null,
    latest_ledger_id uuid references resource_ledger(id),
    portal_repaired boolean not null,
    diamond_pickaxe_crafted boolean not null,
    final_boss_outcome jsonb not null,
    unresolved_adjustments jsonb not null default '[]'::jsonb,
    discrepancies jsonb not null default '[]'::jsonb,
    operator_notes text not null,
    reconciled_by text not null,
    reconciled_at timestamptz not null default now(),
    idempotency_key uuid not null,
    unique (team_id, idempotency_key)
);

create index if not exists idx_day2_reconciliations_team_time
    on day2_reconciliations(team_id, reconciled_at desc);
create index if not exists idx_day2_reconciliations_state
    on day2_reconciliations(state, reconciled_at desc);

alter table day2_offline_results enable row level security;
alter table day2_event_instances enable row level security;
alter table day2_event_effects enable row level security;
alter table day2_manual_adjustments enable row level security;
alter table day2_reconciliations enable row level security;

create or replace function dev5_jsonb_has_nonzero_number(p_delta jsonb)
returns boolean
language sql
immutable
as $$
    select exists (
        select 1
        from jsonb_each_text(coalesce(p_delta, '{}'::jsonb)) as entry(key, value)
        where key in ('wood', 'stone', 'iron', 'gold', 'diamond', 'emerald', 'obsidian')
          and value::integer <> 0
    );
$$;

create or replace function dev5_record_round4_offline_result(
    p_team_id uuid,
    p_activity_key text,
    p_outcome text,
    p_award jsonb,
    p_portal_fragment_delta integer,
    p_volunteer_identity text,
    p_admin_id text,
    p_idempotency_key uuid,
    p_reason text,
    p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    existing day2_offline_results%rowtype;
    qualification team_game_state%rowtype;
    mutation jsonb;
    result_row day2_offline_results%rowtype;
begin
    if p_reason is null or length(btrim(p_reason)) = 0 then
        raise exception 'reason is required' using errcode = 'check_violation';
    end if;
    if p_volunteer_identity is null or length(btrim(p_volunteer_identity)) = 0 then
        raise exception 'volunteer identity is required' using errcode = 'check_violation';
    end if;
    if not dev5_jsonb_has_nonzero_number(p_award) then
        raise exception 'award is required' using errcode = 'check_violation';
    end if;
    if coalesce((p_award ->> 'obsidian')::integer, 0) <> 0 then
        raise exception 'round 4 cannot grant nether-core adjacent resources' using errcode = 'check_violation';
    end if;

    select * into existing
    from day2_offline_results
    where team_id = p_team_id and idempotency_key = p_idempotency_key;
    if found then
        return jsonb_build_object(
            'offline_result_id', existing.id,
            'ledger_id', existing.ledger_id,
            'idempotent', true,
            'award', existing.award,
            'portal_fragment_delta', existing.portal_fragment_delta
        );
    end if;

    select * into qualification
    from team_game_state
    where team_id = p_team_id
    for update;
    if not found or qualification.qualified_for_day2 is not true then
        raise exception 'day2 qualification required' using errcode = 'check_violation';
    end if;

    if exists (
        select 1 from day2_offline_results
        where team_id = p_team_id and activity_key = p_activity_key
    ) then
        raise exception 'offline activity already recorded' using errcode = 'unique_violation';
    end if;

    mutation := mutate_team_resources(
        p_team_id,
        p_award,
        'day2_offline_result',
        p_activity_key,
        p_idempotency_key,
        p_reason,
        'admin',
        p_admin_id
    );

    if p_portal_fragment_delta = 1 then
        insert into day2_portal_fragments (team_id, source)
        values (p_team_id, 'round4_memory_challenge')
        on conflict (team_id) do nothing;
    end if;

    insert into day2_offline_results (
        team_id,
        activity_key,
        outcome,
        award,
        portal_fragment_delta,
        volunteer_identity,
        recorded_by,
        idempotency_key,
        reason,
        notes,
        ledger_id,
        qualification_snapshot
    ) values (
        p_team_id,
        p_activity_key,
        p_outcome,
        p_award,
        p_portal_fragment_delta,
        p_volunteer_identity,
        p_admin_id,
        p_idempotency_key,
        p_reason,
        p_notes,
        (mutation ->> 'ledger_id')::uuid,
        to_jsonb(qualification)
    )
    returning * into result_row;

    return jsonb_build_object(
        'offline_result_id', result_row.id,
        'ledger_id', result_row.ledger_id,
        'balance', mutation -> 'balance',
        'portal_fragment_delta', result_row.portal_fragment_delta,
        'idempotent', false
    );
end;
$$;

create or replace function dev5_apply_day2_manual_adjustment(
    p_team_id uuid,
    p_delta jsonb,
    p_reason text,
    p_admin_id text,
    p_idempotency_key uuid,
    p_expected_balance_before jsonb,
    p_expected_balance_after jsonb,
    p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    existing day2_manual_adjustments%rowtype;
    current_row resources%rowtype;
    before_balance jsonb;
    mutation jsonb;
    adjustment_row day2_manual_adjustments%rowtype;
begin
    if p_reason is null or length(btrim(p_reason)) = 0 then
        raise exception 'adjustment reason is required' using errcode = 'check_violation';
    end if;
    if not dev5_jsonb_has_nonzero_number(p_delta) then
        raise exception 'non-zero adjustment required' using errcode = 'check_violation';
    end if;

    select * into existing
    from day2_manual_adjustments
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

    select * into current_row from resources where team_id = p_team_id for update;
    if not found then
        raise exception 'resource row not found' using errcode = 'no_data_found';
    end if;

    before_balance := dev4_resource_snapshot(
        current_row.wood,
        current_row.stone,
        current_row.iron,
        current_row.gold,
        current_row.diamond,
        current_row.emerald,
        current_row.obsidian
    );

    if before_balance <> p_expected_balance_before then
        raise exception 'before balance confirmation mismatch' using errcode = 'check_violation';
    end if;

    mutation := mutate_team_resources(
        p_team_id,
        p_delta,
        'day2_manual_adjustment',
        null,
        p_idempotency_key,
        p_reason,
        'admin',
        p_admin_id
    );

    if (mutation -> 'balance') <> p_expected_balance_after then
        raise exception 'after balance confirmation mismatch' using errcode = 'check_violation';
    end if;

    insert into day2_manual_adjustments (
        team_id,
        requested_delta,
        reason,
        admin_id,
        idempotency_key,
        expected_balance_before,
        expected_balance_after,
        balance_before,
        balance_after,
        ledger_id,
        notes
    ) values (
        p_team_id,
        p_delta,
        p_reason,
        p_admin_id,
        p_idempotency_key,
        p_expected_balance_before,
        p_expected_balance_after,
        before_balance,
        mutation -> 'balance',
        (mutation ->> 'ledger_id')::uuid,
        p_notes
    )
    returning * into adjustment_row;

    return jsonb_build_object(
        'adjustment_id', adjustment_row.id,
        'ledger_id', adjustment_row.ledger_id,
        'balance_before', adjustment_row.balance_before,
        'balance_after', adjustment_row.balance_after,
        'idempotent', false
    );
end;
$$;

create or replace function dev5_trigger_day2_event(
    p_event_key text,
    p_target_team_ids uuid[],
    p_admin_id text,
    p_idempotency_key uuid,
    p_reason text,
    p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    existing day2_event_instances%rowtype;
    event_row day2_event_instances%rowtype;
    starts_ts timestamptz := now();
    ends_ts timestamptz;
    event_effect jsonb;
    team_id_value uuid;
    is_qualified boolean;
    has_attempt boolean;
    delta jsonb;
    resolution_value text;
    protection_value text;
    mutation jsonb;
    affected integer := 0;
    protected integer := 0;
    skipped integer := 0;
    event_scope text;
    event_targets uuid[];
begin
    if p_reason is null or length(btrim(p_reason)) = 0 then
        raise exception 'event reason is required' using errcode = 'check_violation';
    end if;

    select * into existing
    from day2_event_instances
    where idempotency_key = p_idempotency_key;
    if found then
        return jsonb_build_object(
            'event_id', existing.id,
            'event_key', existing.event_key,
            'idempotent', true,
            'starts_at', existing.starts_at,
            'ends_at', existing.ends_at
        );
    end if;

    if p_event_key = 'chorus_fruit_blessing' then
        ends_ts := starts_ts + interval '5 minutes';
        event_effect := '{"kind":"window","bonus":{"emerald":2}}'::jsonb;
    elsif p_event_key = 'enderman_ambush' then
        ends_ts := starts_ts;
        event_effect := '{"kind":"instant","delta":{"diamond":-8}}'::jsonb;
    elsif p_event_key = 'dragons_fury' then
        ends_ts := starts_ts;
        event_effect := '{"kind":"instant","delta":{"diamond":-10},"protection":"final_boss_attempt_started"}'::jsonb;
    else
        raise exception 'invalid day2 event' using errcode = 'check_violation';
    end if;

    if coalesce(array_length(p_target_team_ids, 1), 0) = 0 then
        event_scope := 'all_qualified';
        select coalesce(array_agg(team_id), '{}'::uuid[]) into event_targets
        from team_game_state
        where qualified_for_day2 = true;
    else
        event_scope := 'targeted';
        event_targets := p_target_team_ids;
    end if;

    insert into day2_event_instances (
        event_key,
        round_id,
        scope,
        target_team_ids,
        effect,
        status,
        starts_at,
        ends_at,
        triggered_by,
        idempotency_key,
        reason,
        notes
    ) values (
        p_event_key,
        5,
        event_scope,
        event_targets,
        event_effect,
        case when p_event_key = 'chorus_fruit_blessing' then 'active' else 'completed' end,
        starts_ts,
        ends_ts,
        p_admin_id,
        p_idempotency_key,
        p_reason,
        p_notes
    )
    returning * into event_row;

    foreach team_id_value in array event_targets
    loop
        select exists (
            select 1 from team_game_state
            where team_id = team_id_value and qualified_for_day2 = true
        ) into is_qualified;

        if not is_qualified then
            skipped := skipped + 1;
            continue;
        end if;

        delta := '{}'::jsonb;
        resolution_value := 'window_opened';
        protection_value := null;

        if p_event_key = 'enderman_ambush' then
            delta := '{"diamond": -8}'::jsonb;
            resolution_value := 'applied';
        elsif p_event_key = 'dragons_fury' then
            select exists (
                select 1 from day2_final_boss_attempts
                where team_id = team_id_value
            ) into has_attempt;

            if has_attempt then
                delta := '{"diamond": 0}'::jsonb;
                resolution_value := 'protected';
                protection_value := 'weakened_the_dragon';
                protected := protected + 1;
            else
                delta := '{"diamond": -10}'::jsonb;
                resolution_value := 'applied';
            end if;
        else
            delta := '{"emerald": 0}'::jsonb;
        end if;

        begin
            mutation := mutate_team_resources(
                team_id_value,
                delta,
                'day2_event',
                event_row.id::text,
                gen_random_uuid(),
                p_reason,
                'admin',
                p_admin_id
            );
        exception
            when others then
                if sqlerrm like '%insufficient%' then
                    delta := '{"diamond": 0}'::jsonb;
                    resolution_value := 'insufficient_balance';
                    mutation := mutate_team_resources(
                        team_id_value,
                        delta,
                        'day2_event',
                        event_row.id::text,
                        gen_random_uuid(),
                        p_reason || ' (insufficient balance recorded)',
                        'admin',
                        p_admin_id
                    );
                else
                    raise;
                end if;
        end;

        insert into day2_event_effects (
            event_id,
            team_id,
            delta,
            protection,
            resolution,
            ledger_id,
            idempotency_key,
            reason,
            applied_by,
            notes
        ) values (
            event_row.id,
            team_id_value,
            delta,
            protection_value,
            resolution_value,
            (mutation ->> 'ledger_id')::uuid,
            (mutation ->> 'ledger_id')::uuid,
            p_reason,
            p_admin_id,
            p_notes
        );

        affected := affected + 1;
    end loop;

    return jsonb_build_object(
        'event_id', event_row.id,
        'event_key', event_row.event_key,
        'starts_at', event_row.starts_at,
        'ends_at', event_row.ends_at,
        'affected_teams', affected,
        'protected_teams', protected,
        'skipped_teams', skipped,
        'idempotent', false
    );
end;
$$;

revoke execute on function dev5_record_round4_offline_result(uuid, text, text, jsonb, integer, text, text, uuid, text, text) from public, anon, authenticated;
revoke execute on function dev5_apply_day2_manual_adjustment(uuid, jsonb, text, text, uuid, jsonb, jsonb, text) from public, anon, authenticated;
revoke execute on function dev5_trigger_day2_event(text, uuid[], text, uuid, text, text) from public, anon, authenticated;
