-- Migration 02: Dev 3 - Guardians, Structures, Marketplace, Choices, Qualification
--
-- The two RPCs at the bottom replaced earlier stubs that raised
-- BLOCKED_BY_DEV4_RPC. They were applied to the event project separately as
-- `20260714_05_dev3_atomic_purchase_and_choice_rpcs`; applying this file whole
-- against a clean database produces the same result.

create table if not exists structures (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references teams(id) on delete cascade,
    round_id integer not null,
    type text not null,
    state text not null check (state in ('active', 'damaged', 'repaired', 'upgraded', 'consumed')),
    upgrade_lineage text[] default '{}',
    built_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
-- partial index to enforce 1 base structure per round
create unique index if not exists idx_structures_team_round on structures(team_id, round_id) where state != 'consumed';

create table if not exists structure_repairs (
    id uuid primary key default gen_random_uuid(),
    structure_id uuid not null references structures(id) on delete cascade,
    team_id uuid not null references teams(id) on delete cascade,
    repaired_at timestamptz not null default now(),
    cost_ledger_id uuid not null
);

create table if not exists guardian_battles (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references teams(id) on delete cascade,
    round_id integer not null,
    guardian_name text not null,
    attempt_number integer not null,
    status text not null check (status in ('started', 'won', 'lost')),
    question_set_version text not null,
    started_at timestamptz not null default now(),
    completed_at timestamptz,
    score integer,
    retry_after timestamptz,
    reward_ledger_id uuid,
    penalty_ledger_id uuid,
    consumed_items text[] default '{}'
);
-- partial index to enforce 1 claimed victory per team/guardian/round
create unique index if not exists idx_guardian_victory on guardian_battles(team_id, guardian_name, round_id) where status = 'won';

create table if not exists transactions (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references teams(id) on delete cascade,
    item_type text not null,
    cost_emerald integer not null,
    ledger_id uuid,
    created_at timestamptz not null default now()
);

create table if not exists item_uses (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references teams(id) on delete cascade,
    transaction_id uuid references transactions(id),
    item_type text not null,
    used_at timestamptz not null default now()
);

create table if not exists choice_decisions (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references teams(id) on delete cascade,
    choice_key text not null,
    option_selected text not null,
    ledger_id uuid,
    created_at timestamptz not null default now(),
    unique(team_id, choice_key)
);

create table if not exists team_game_state (
    team_id uuid primary key references teams(id) on delete cascade,
    nether_core_count integer not null default 0,
    armor_crafted boolean not null default false,
    qualified_for_day2 boolean not null default false,
    qualification_frozen_by text,
    qualification_frozen_at timestamptz,
    elimination_reason text,
    updated_at timestamptz not null default now()
);

-- Issue 6: consumable use audit columns + one-time-use guarantee.
-- A consumable purchase (transactions.id) can produce at most one item_uses row.
alter table item_uses add column if not exists consumed_at timestamptz;
alter table item_uses add column if not exists guardian_battle_id uuid references guardian_battles(id) on delete set null;
alter table item_uses add column if not exists question_id text;
create unique index if not exists idx_item_uses_transaction on item_uses(transaction_id);

-- Issue 7: qualification freeze audit fields on the existing team_game_state workflow.
alter table team_game_state add column if not exists qualification_freeze_id uuid;
alter table team_game_state add column if not exists qualification_cutoff_percent integer;
alter table team_game_state add column if not exists qualification_reason text;

-- Deny all RLS
alter table structures enable row level security;
alter table structure_repairs enable row level security;
alter table guardian_battles enable row level security;
alter table transactions enable row level security;
alter table item_uses enable row level security;
alter table choice_decisions enable row level security;
alter table team_game_state enable row level security;

-- Atomic Mutation Wrapper RPCs
-- Both wrap Dev 4's mutate_team_resources so the ledger entry and the Dev 3
-- record are written in one transaction. Doing the mutation from the route and
-- the insert afterwards let a failed insert leave resources already spent.

create or replace function dev3_buy_marketplace_item(
    p_team_id uuid,
    p_item_type text,
    p_cost_emerald integer,
    p_delta jsonb,
    p_idempotency_key uuid,
    p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    existing transactions%rowtype;
    mutation jsonb;
    tx_row transactions%rowtype;
begin
    -- Replaying the same request returns the original purchase.
    select t.* into existing
    from transactions t
    join resource_ledger l on l.id = t.ledger_id
    where t.team_id = p_team_id and l.idempotency_key = p_idempotency_key;

    if found then
        return jsonb_build_object(
            'transaction_id', existing.id,
            'ledger_id', existing.ledger_id,
            'item_type', existing.item_type,
            'idempotent', true
        );
    end if;

    mutation := mutate_team_resources(
        p_team_id,
        p_delta,
        'marketplace_purchase',
        p_item_type,
        p_idempotency_key,
        p_reason,
        'team',
        p_team_id::text
    );

    insert into transactions (team_id, item_type, cost_emerald, ledger_id)
    values (p_team_id, p_item_type, p_cost_emerald, (mutation ->> 'ledger_id')::uuid)
    returning * into tx_row;

    return jsonb_build_object(
        'transaction_id', tx_row.id,
        'ledger_id', tx_row.ledger_id,
        'item_type', tx_row.item_type,
        'cost_emerald', tx_row.cost_emerald,
        'balance', mutation -> 'balance',
        'idempotent', false
    );
end;
$$;

create or replace function dev3_make_choice_decision(
    p_team_id uuid,
    p_choice_key text,
    p_option_selected text,
    p_delta jsonb,
    p_idempotency_key uuid,
    p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    existing choice_decisions%rowtype;
    mutation jsonb;
    decision_row choice_decisions%rowtype;
begin
    -- One decision per team/choice. Checked before the mutation so a repeat
    -- attempt under a fresh idempotency key cannot charge the team twice.
    select * into existing
    from choice_decisions
    where team_id = p_team_id and choice_key = p_choice_key;

    if found then
        return jsonb_build_object(
            'decision_id', existing.id,
            'ledger_id', existing.ledger_id,
            'choice_key', existing.choice_key,
            'option_selected', existing.option_selected,
            'idempotent', true
        );
    end if;

    mutation := mutate_team_resources(
        p_team_id,
        p_delta,
        'choice_decision',
        p_choice_key,
        p_idempotency_key,
        p_reason,
        'team',
        p_team_id::text
    );

    insert into choice_decisions (team_id, choice_key, option_selected, ledger_id)
    values (p_team_id, p_choice_key, p_option_selected, (mutation ->> 'ledger_id')::uuid)
    returning * into decision_row;

    return jsonb_build_object(
        'decision_id', decision_row.id,
        'ledger_id', decision_row.ledger_id,
        'choice_key', decision_row.choice_key,
        'option_selected', decision_row.option_selected,
        'balance', mutation -> 'balance',
        'idempotent', false
    );
end;
$$;

revoke execute on function dev3_buy_marketplace_item(uuid, text, integer, jsonb, uuid, text) from public, anon, authenticated;
revoke execute on function dev3_make_choice_decision(uuid, text, text, jsonb, uuid, text) from public, anon, authenticated;
