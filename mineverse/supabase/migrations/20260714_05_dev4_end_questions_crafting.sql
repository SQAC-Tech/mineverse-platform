-- Migration 05: Dev 4 - Phase 3 Round 5 (The End) question-pack versioning,
-- logic-puzzle selection metadata, runtime metadata, and diamond_pickaxe craft.
-- Additive only — no parallel resource/submission schema.

-- 1. Extend question type enum to cover Round 5 challenge types
alter table questions drop constraint if exists questions_type_check;
alter table questions add constraint questions_type_check
  check (type in (
    'crossword', 'aptitude', 'output', 'debugging', 'code_completion', 'coding', 'pvp',
    'logic_puzzle', 'debug_output'
  ));

-- 2. Add Round 5 question-pack columns (nullable so existing rows are untouched)
alter table questions add column if not exists pack_version text;
alter table questions add column if not exists logic_puzzle_variant text
  check (logic_puzzle_variant is null or logic_puzzle_variant in (
    'n_queens', 'missionaries_cannibals', 'tower_of_hanoi', 'sudoku_logic'
  ));
alter table questions add column if not exists runtime_meta jsonb;

-- 3. Extend crafting_log item enum for Diamond Pickaxe
alter table crafting_log drop constraint if exists crafting_log_item_check;
alter table crafting_log add constraint crafting_log_item_check
  check (item in ('wooden_pickaxe', 'stone_pickaxe', 'iron_armor', 'diamond_pickaxe'));

-- 4. Extend craft_team_item to handle diamond_pickaxe
create or replace function craft_team_item(
    p_team_id uuid,
    p_item text,
    p_idempotency_key uuid
) returns jsonb as $$
declare
    existing_craft crafting_log%rowtype;
    structure_row record;
    discount integer := 0;
    discount_source text := null;
    unlock_round integer := null;
    base_cost jsonb;
    actual_cost jsonb := '{}'::jsonb;
    delta jsonb := '{}'::jsonb;
    resource_key text;
    base_value integer;
    actual_value integer;
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
        -- Prerequisite: iron_armor must be crafted
        if not exists (select 1 from crafting_log where team_id = p_team_id and item = 'iron_armor') then
            raise exception 'progression requirement missing';
        end if;
        -- Day 2 qualification gate
        if not exists (
            select 1 from team_game_state
            where team_id = p_team_id and qualified_for_day2 = true
        ) then
            raise exception 'day2 qualification required';
        end if;
        -- Portal repair gate (Dev 3 table)
        if not exists (
            select 1 from day2_portal_repair
            where team_id = p_team_id
        ) then
            raise exception 'portal repair required';
        end if;
        base_cost := '{"iron": 25, "gold": 20, "diamond": 100, "emerald": 10}'::jsonb;
        -- No unlock_round — unlocks Final Boss via crafting_log existence check
    else
        raise exception 'invalid craft item';
    end if;

    -- Forge / Master Forge discount lookup
    begin
        select * into structure_row
        from structures
        where team_id = p_team_id
          and type = 'forge'
          and state in ('active', 'repaired', 'upgraded')
        order by built_at desc
        limit 1;

        if found then
            discount := case when structure_row.state = 'upgraded' then 20 else 10 end;
            discount_source := case when structure_row.state = 'upgraded' then 'master_forge' else 'forge' end;
        end if;
    exception
        when undefined_table then
            discount := 0;
            discount_source := null;
    end;

    -- Calculate actual cost with discount (round up each resource)
    for resource_key, base_value in
        select key, value::integer from jsonb_each_text(base_cost)
    loop
        actual_value := ceil(base_value * (100 - discount) / 100.0)::integer;
        actual_cost := actual_cost || jsonb_build_object(resource_key, actual_value);
        delta := delta || jsonb_build_object(resource_key, -actual_value);
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

    -- Log the craft
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
        actual_cost,
        discount_source,
        discount,
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
