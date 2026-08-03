-- Migration 01: Dev 4 - Questions, Submissions, Resources, Crafting

create table if not exists questions (
    id uuid primary key default gen_random_uuid(),
    round_id integer not null references rounds(id) on delete cascade,
    type text not null check (type in ('crossword', 'aptitude', 'output', 'debugging', 'code_completion', 'coding', 'pvp')),
    prompt text not null,
    content jsonb not null default '{}'::jsonb,
    order_index integer not null,
    language_options text[] not null default '{}'::text[],
    time_limit_seconds integer,
    reward jsonb not null default '{}'::jsonb,
    auto_grade_strategy text,
    rubric jsonb,
    expected_answer jsonb,
    hidden_test_cases jsonb,
    created_at timestamptz not null default now(),
    unique(round_id, order_index)
);

create table if not exists submissions (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references teams(id) on delete cascade,
    round_id integer not null references rounds(id) on delete cascade,
    question_id uuid not null references questions(id) on delete cascade,
    answer_text text,
    code text,
    language text,
    response jsonb not null default '{}'::jsonb,
    revision integer not null default 1,
    status text not null default 'submitted'
        check (status in ('draft', 'submitted', 'locked', 'graded', 'manual_review')),
    submitted_at timestamptz not null default now(),
    locked_at timestamptz,
    final_score numeric,
    feedback text,
    graded_by text,
    graded_revision integer,
    final_award_ledger_id uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(team_id, question_id),
    constraint submissions_final_revision_once
      check (graded_revision is null or graded_revision <= revision)
);

create unique index if not exists idx_submissions_final_award_once
    on submissions(final_award_ledger_id)
    where final_award_ledger_id is not null;

create table if not exists resources (
    team_id uuid primary key references teams(id) on delete cascade,
    wood integer not null default 25 check (wood >= 0),
    stone integer not null default 10 check (stone >= 0),
    iron integer not null default 0 check (iron >= 0),
    gold integer not null default 0 check (gold >= 0),
    diamond integer not null default 0 check (diamond >= 0),
    emerald integer not null default 5 check (emerald >= 0),
    obsidian integer not null default 0 check (obsidian >= 0),
    version integer not null default 0,
    updated_at timestamptz not null default now()
);

create table if not exists resource_ledger (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references teams(id) on delete cascade,
    delta jsonb not null,
    balance_after jsonb not null,
    source_type text not null,
    source_id text,
    actor_type text not null default 'system',
    actor_id text,
    idempotency_key uuid not null,
    reason text,
    created_at timestamptz not null default now(),
    unique(team_id, idempotency_key)
);

create table if not exists crafting_log (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references teams(id) on delete cascade,
    item text not null check (item in ('wooden_pickaxe', 'stone_pickaxe', 'iron_armor')),
    base_cost jsonb not null,
    actual_cost jsonb not null,
    discount_source text,
    discount_percent integer not null default 0,
    unlock_round_id integer references rounds(id) on delete set null,
    ledger_id uuid not null references resource_ledger(id),
    idempotency_key uuid not null,
    crafted_at timestamptz not null default now(),
    unique(team_id, item),
    unique(team_id, idempotency_key)
);

create index if not exists idx_questions_round_order on questions(round_id, order_index);
create index if not exists idx_submissions_team_round on submissions(team_id, round_id);
create index if not exists idx_submissions_question on submissions(question_id);
create index if not exists idx_resource_ledger_team_created on resource_ledger(team_id, created_at desc, id desc);
create index if not exists idx_resource_ledger_source on resource_ledger(source_type, source_id);
create index if not exists idx_crafting_log_team_item on crafting_log(team_id, item);

insert into resources (team_id, wood, stone, iron, gold, diamond, emerald, obsidian)
select id, 25, 10, 0, 0, 0, 5, 0
from teams
where is_payment_verified = true
on conflict (team_id) do nothing;

alter table questions enable row level security;
alter table submissions enable row level security;
alter table resources enable row level security;
alter table resource_ledger enable row level security;
alter table crafting_log enable row level security;

create or replace function dev4_resource_snapshot(
    p_wood integer,
    p_stone integer,
    p_iron integer,
    p_gold integer,
    p_diamond integer,
    p_emerald integer,
    p_obsidian integer
) returns jsonb as $$
begin
    return jsonb_build_object(
        'wood', p_wood,
        'stone', p_stone,
        'iron', p_iron,
        'gold', p_gold,
        'diamond', p_diamond,
        'emerald', p_emerald,
        'obsidian', p_obsidian
    );
end;
$$ language plpgsql immutable;

create or replace function mutate_team_resources(
    p_team_id uuid,
    p_delta jsonb,
    p_source_type text,
    p_source_id text default null,
    p_idempotency_key uuid default gen_random_uuid(),
    p_reason text default null,
    p_actor_type text default 'system',
    p_actor_id text default null
) returns jsonb as $$
declare
    existing resource_ledger%rowtype;
    current_row resources%rowtype;
    next_wood integer;
    next_stone integer;
    next_iron integer;
    next_gold integer;
    next_diamond integer;
    next_emerald integer;
    next_obsidian integer;
    next_version integer;
    next_balance jsonb;
    ledger_row resource_ledger%rowtype;
begin
    select * into existing
    from resource_ledger
    where team_id = p_team_id and idempotency_key = p_idempotency_key;

    if found then
        return jsonb_build_object(
            'ledger_id', existing.id,
            'balance', existing.balance_after,
            'version', (select version from resources where team_id = p_team_id),
            'created_at', existing.created_at,
            'idempotent', true
        );
    end if;

    insert into resources (team_id)
    values (p_team_id)
    on conflict (team_id) do nothing;

    select * into current_row
    from resources
    where team_id = p_team_id
    for update;

    next_wood := current_row.wood + coalesce((p_delta ->> 'wood')::integer, 0);
    next_stone := current_row.stone + coalesce((p_delta ->> 'stone')::integer, 0);
    next_iron := current_row.iron + coalesce((p_delta ->> 'iron')::integer, 0);
    next_gold := current_row.gold + coalesce((p_delta ->> 'gold')::integer, 0);
    next_diamond := current_row.diamond + coalesce((p_delta ->> 'diamond')::integer, 0);
    next_emerald := current_row.emerald + coalesce((p_delta ->> 'emerald')::integer, 0);
    next_obsidian := current_row.obsidian + coalesce((p_delta ->> 'obsidian')::integer, 0);

    if next_wood < 0 or next_stone < 0 or next_iron < 0 or next_gold < 0
       or next_diamond < 0 or next_emerald < 0 or next_obsidian < 0 then
        raise exception 'insufficient resources';
    end if;

    next_version := current_row.version + 1;
    next_balance := dev4_resource_snapshot(next_wood, next_stone, next_iron, next_gold, next_diamond, next_emerald, next_obsidian);

    update resources
    set wood = next_wood,
        stone = next_stone,
        iron = next_iron,
        gold = next_gold,
        diamond = next_diamond,
        emerald = next_emerald,
        obsidian = next_obsidian,
        version = next_version,
        updated_at = now()
    where team_id = p_team_id;

    insert into resource_ledger (
        team_id,
        delta,
        balance_after,
        source_type,
        source_id,
        actor_type,
        actor_id,
        idempotency_key,
        reason
    ) values (
        p_team_id,
        p_delta,
        next_balance,
        p_source_type,
        p_source_id,
        p_actor_type,
        p_actor_id,
        p_idempotency_key,
        p_reason
    )
    returning * into ledger_row;

    return jsonb_build_object(
        'ledger_id', ledger_row.id,
        'balance', next_balance,
        'version', next_version,
        'created_at', ledger_row.created_at,
        'idempotent', false
    );
exception
    when unique_violation then
        raise exception 'idempotency conflict';
end;
$$ language plpgsql security definer;

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

    if exists (select 1 from crafting_log where team_id = p_team_id and item = p_item) then
        raise exception 'already crafted';
    end if;

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
    else
        raise exception 'invalid craft item';
    end if;

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

    for resource_key, base_value in
        select key, value::integer from jsonb_each_text(base_cost)
    loop
        actual_value := ceil(base_value * (100 - discount) / 100.0)::integer;
        actual_cost := actual_cost || jsonb_build_object(resource_key, actual_value);
        delta := delta || jsonb_build_object(resource_key, -actual_value);
    end loop;

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
