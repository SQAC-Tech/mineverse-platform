-- Removes three systems the event no longer runs on the platform.
--
-- 1. Structures. Building, upgrading, repairing and the Forge crafting discount
--    are gone entirely, along with the events that damaged or were absorbed by
--    a structure.
-- 2. Negative world events. Only reward modifiers survive: heavy_rain,
--    fertile_marsh, gold_rush on Day 1 and chorus_fruit_blessing on Day 2. An
--    event can no longer take resources away from a team.
-- 3. Offline games. The physical games still happen, but off the platform —
--    nothing about them is recorded here. Whatever an organizer decides a team
--    earned is entered through the single admin resource grant form, which
--    lands in the same resource_ledger as everything else.
--
-- Portal Fragments survive as a table because Round 4's portal repair still
-- needs one; an admin now awards it directly instead of it falling out of a
-- recorded offline result.

-- ---------------------------------------------------------------------------
-- 1. Offline game records
-- ---------------------------------------------------------------------------

drop function if exists record_offline_result(uuid, integer, text, jsonb, text, text, uuid, text);
drop function if exists dev5_record_round4_offline_result(uuid, text, text, jsonb, integer, text, text, uuid, text, text);

drop table if exists day2_offline_results;
drop table if exists offline_results;

-- ---------------------------------------------------------------------------
-- 2. Negative world events
-- ---------------------------------------------------------------------------

-- Day 1: keep the three reward modifiers, drop the three penalties. Existing
-- rows are already modifier-only, so tightening the CHECK is safe.
delete from team_event_effects
where world_event_id in (
    select id from world_events
    where event_key in ('creeper_explosion', 'lava_eruption', 'ghast_bombardment')
);

delete from world_events
where event_key in ('creeper_explosion', 'lava_eruption', 'ghast_bombardment');

alter table world_events drop constraint if exists world_events_event_key_check;
alter table world_events add constraint world_events_event_key_check
    check (event_key in ('heavy_rain', 'fertile_marsh', 'gold_rush'));

-- A modifier event never deducts, so the protection column has nothing left to
-- record.
alter table team_event_effects drop column if exists protection;

-- Day 2: only the Chorus Fruit Blessing window remains.
delete from day2_event_effects
where event_id in (
    select id from day2_event_instances
    where event_key in ('enderman_ambush', 'dragons_fury')
);

delete from day2_event_instances
where event_key in ('enderman_ambush', 'dragons_fury');

alter table day2_event_instances drop constraint if exists day2_event_instances_event_key_check;
alter table day2_event_instances add constraint day2_event_instances_event_key_check
    check (event_key = 'chorus_fruit_blessing');

alter table day2_event_effects drop constraint if exists day2_event_effects_resolution_check;
alter table day2_event_effects add constraint day2_event_effects_resolution_check
    check (resolution in ('window_opened', 'skipped_not_qualified'));

-- Chorus Fruit Blessing is the only Day 2 event left: it opens a five-minute
-- bonus window for qualified teams and never moves a balance by itself.
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
    team_id_value uuid;
    is_qualified boolean;
    mutation jsonb;
    affected integer := 0;
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

    if p_event_key <> 'chorus_fruit_blessing' then
        raise exception 'invalid day2 event' using errcode = 'check_violation';
    end if;

    ends_ts := starts_ts + interval '5 minutes';

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
        'chorus_fruit_blessing',
        5,
        event_scope,
        event_targets,
        '{"kind":"window","bonus":{"emerald":2}}'::jsonb,
        'active',
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

        -- A zero mutation still produces the ledger row the effect references,
        -- which keeps "who was in the window" auditable.
        mutation := mutate_team_resources(
            team_id_value,
            '{"emerald": 0}'::jsonb,
            'day2_event',
            event_row.id::text,
            gen_random_uuid(),
            p_reason,
            'admin',
            p_admin_id
        );

        insert into day2_event_effects (
            event_id,
            team_id,
            delta,
            resolution,
            ledger_id,
            idempotency_key,
            reason,
            applied_by,
            notes
        ) values (
            event_row.id,
            team_id_value,
            '{"emerald": 0}'::jsonb,
            'window_opened',
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
        'skipped_teams', skipped,
        'idempotent', false
    );
end;
$$;

revoke execute on function dev5_trigger_day2_event(text, uuid[], text, uuid, text, text) from public, anon, authenticated;

-- Dragon's Fury was the only reader of the "has the team started a boss
-- attempt" protection, but the column stays on day2_event_effects for the
-- historical rows it may still describe elsewhere.

-- ---------------------------------------------------------------------------
-- 3. Structures
-- ---------------------------------------------------------------------------

-- craft_team_item without the Forge / Master Forge discount. Base cost is now
-- the cost; the discount_source and discount_percent columns stay on
-- crafting_log so older rows keep their meaning.
create or replace function craft_team_item(
    p_team_id uuid,
    p_item text,
    p_idempotency_key uuid
) returns jsonb as $$
declare
    existing_craft crafting_log%rowtype;
    unlock_round integer := null;
    base_cost jsonb;
    delta jsonb := '{}'::jsonb;
    resource_key text;
    base_value integer;
    mutation jsonb;
    craft_row crafting_log%rowtype;
begin
    -- Idempotency check
    select * into existing_craft
    from crafting_log
    where team_id = p_team_id and idempotency_key = p_idempotency_key;

    if found then
        return jsonb_build_object(
            'crafting_log_id', existing_craft.id,
            'ledger_id', existing_craft.ledger_id,
            'item', existing_craft.item,
            'base_cost', existing_craft.base_cost,
            'actual_cost', existing_craft.actual_cost,
            'discount_percent', existing_craft.discount_percent,
            'unlock_round_id', existing_craft.unlock_round_id,
            'idempotent', true
        );
    end if;

    -- One-time craft enforcement
    if exists (select 1 from crafting_log where team_id = p_team_id and item = p_item) then
        raise exception 'already crafted';
    end if;

    -- Item-specific cost and prerequisites
    if p_item = 'wooden_pickaxe' then
        base_cost := '{"wood": 60}'::jsonb;
        unlock_round := 2;
    elsif p_item = 'stone_pickaxe' then
        if not exists (select 1 from crafting_log where team_id = p_team_id and item = 'wooden_pickaxe') then
            raise exception 'progression requirement missing';
        end if;
        base_cost := '{"wood": 10, "stone": 45, "iron": 25}'::jsonb;
        unlock_round := 3;
    elsif p_item = 'iron_armor' then
        if not exists (select 1 from crafting_log where team_id = p_team_id and item = 'stone_pickaxe') then
            raise exception 'progression requirement missing';
        end if;
        base_cost := '{"iron": 40, "gold": 25}'::jsonb;
    elsif p_item = 'diamond_pickaxe' then
        if not exists (select 1 from crafting_log where team_id = p_team_id and item = 'iron_armor') then
            raise exception 'progression requirement missing';
        end if;
        if not exists (
            select 1 from team_game_state
            where team_id = p_team_id and qualified_for_day2 = true
        ) then
            raise exception 'day2 qualification required';
        end if;
        if not exists (
            select 1 from day2_portal_repair
            where team_id = p_team_id
        ) then
            raise exception 'portal repair required';
        end if;
        base_cost := '{"iron": 25, "gold": 20, "diamond": 100, "emerald": 10}'::jsonb;
    else
        raise exception 'invalid craft item';
    end if;

    for resource_key, base_value in
        select key, value::integer from jsonb_each_text(base_cost)
    loop
        delta := delta || jsonb_build_object(resource_key, -base_value);
    end loop;

    -- Atomic resource deduction via ledger
    mutation := mutate_team_resources(
        p_team_id,
        delta,
        'craft',
        p_item,
        p_idempotency_key,
        'Crafted ' || p_item,
        'team',
        p_team_id::text
    );

    -- Unlock next round if applicable
    if unlock_round is not null then
        update team_round_access
        set is_locked = false,
            started_at = coalesce(started_at, now())
        where team_id = p_team_id and round_id = unlock_round;
    end if;

    insert into crafting_log (
        team_id,
        item,
        base_cost,
        actual_cost,
        discount_source,
        discount_percent,
        unlock_round_id,
        ledger_id,
        idempotency_key
    ) values (
        p_team_id,
        p_item,
        base_cost,
        base_cost,
        null,
        0,
        unlock_round,
        (mutation ->> 'ledger_id')::uuid,
        p_idempotency_key
    )
    returning * into craft_row;

    return jsonb_build_object(
        'crafting_log_id', craft_row.id,
        'ledger_id', craft_row.ledger_id,
        'item', craft_row.item,
        'base_cost', craft_row.base_cost,
        'actual_cost', craft_row.actual_cost,
        'discount_source', craft_row.discount_source,
        'discount_percent', craft_row.discount_percent,
        'unlock_round_id', craft_row.unlock_round_id,
        'balance', mutation -> 'balance',
        'version', mutation -> 'version',
        'idempotent', false
    );
end;
$$ language plpgsql security definer;

drop table if exists structure_repairs;
drop table if exists structures;
