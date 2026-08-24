-- The whole dashboard in one round trip.
--
-- `/api/dashboard/data` fanned out to eleven PostgREST requests per tick: the
-- team, its round access, resources, crafting log, game state, both portal
-- tables, the End Merchant ledger probe, the shortlist row behind the
-- entitlement check, the Blaze Guardian lookup behind PvP eligibility, and the
-- duel queue. Every one of those is a separate HTTP request, a separate
-- connection checkout and a separate plan.
--
-- On event day that route was the top ten paths in the edge log by itself, and
-- the instance cannot be given more compute, so the round trips have to go
-- instead. Eleven becomes one.
--
-- ## What this deliberately does not do
--
-- No derivation. This returns the same raw rows the route was already reading,
-- under the same names, and every rule — what `can_enter` means, which trader
-- is open, what the portal is still missing — stays in TypeScript where it was
-- written and reviewed. The point is to change how many times the app crosses
-- the wire, not to move the game's logic into plpgsql the night before it runs.
--
-- The login lease is not in here either. It is a write and a liveness check,
-- throttled to once a minute on its own, and folding a heartbeat into a cached
-- read path is how you end up with a lease that never expires.

create or replace function public.dashboard_snapshot(p_team_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
    select jsonb_build_object(

        'team', (
            select to_jsonb(t) from (
                select id, team_name, team_code from teams where id = p_team_id
            ) t
        ),

        -- `rounds` is nested the way PostgREST's embed returned it, so the
        -- route's existing `row.rounds ?? {}` keeps working unchanged.
        'access', coalesce((
            select jsonb_agg(entry order by entry->>'round_id')
            from (
                select jsonb_build_object(
                    'round_id', tra.round_id,
                    'is_locked', tra.is_locked,
                    'completed_at', tra.completed_at,
                    'score', tra.score,
                    'rounds', jsonb_build_object(
                        'id', r.id, 'name', r.name, 'day', r.day,
                        'sequence', r.sequence, 'description', r.description,
                        'time_allotted', r.time_allotted, 'status', r.status,
                        'ends_at', r.ends_at
                    )
                ) as entry
                from team_round_access tra
                join rounds r on r.id = tra.round_id
                where tra.team_id = p_team_id
            ) rows
        ), '[]'::jsonb),

        'resources', (
            select to_jsonb(x) from (
                select wood, stone, iron, gold, diamond, emerald, obsidian
                from resources where team_id = p_team_id
            ) x
        ),

        'crafted', coalesce((
            select jsonb_agg(jsonb_build_object('item', item, 'crafted_at', crafted_at))
            from crafting_log where team_id = p_team_id
        ), '[]'::jsonb),

        'state', (
            select to_jsonb(x) from (
                select nether_core_count, armor_crafted, qualified_for_day2, elimination_reason
                from team_game_state where team_id = p_team_id
            ) x
        ),

        'has_fragment', exists (select 1 from day2_portal_fragments where team_id = p_team_id),

        'portal_repair', (
            select to_jsonb(x) from (
                select repaired_at from day2_portal_repair where team_id = p_team_id
            ) x
        ),

        -- The End Merchant writes to the ledger rather than `choice_decisions`,
        -- so the ledger is where "already traded" actually lives.
        'end_merchant', (
            select to_jsonb(x) from (
                select reason, created_at from resource_ledger
                where team_id = p_team_id and source_type = 'end_merchant_choice'
                limit 1
            ) x
        ),

        -- Behind `dashboardEntitlement`. The count is cached separately and is
        -- not repeated here.
        'shortlist', (
            select to_jsonb(x) from (
                select result, rsvp_confirmed_at from screening_shortlist where team_id = p_team_id
            ) x
        ),

        -- Behind `pvpEntryEligibility`. Iron Armor comes from `crafted` above,
        -- so only the guardian needs asking.
        'blaze_guardian_won', exists (
            select 1 from guardian_battles
            where team_id = p_team_id and guardian_name = 'blaze_guardian' and status = 'won'
        ),

        'pvp_queued', exists (
            select 1 from pvp_queue where team_id = p_team_id and match_id is null
        )
    );
$function$;

revoke all on function public.dashboard_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.dashboard_snapshot(uuid) to service_role;
