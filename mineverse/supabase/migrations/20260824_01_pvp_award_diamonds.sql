-- Winning the duel now pays for the Nether Portal.
--
-- Repairing the portal needs three things (see /api/team/day2/status): one
-- nether core, a portal fragment, and 15 diamonds. `resolve_pvp_match` already
-- handed the winner the core; it paid no diamonds at all, so a duel win got a
-- team one third of the way there and the rest had to come from Round 3 marks
-- and the marketplace.
--
-- The duel is now the gate to the portal, so the award covers the diamond cost
-- exactly: 15, the same number the portal check asks for. Not more — a winner
-- should be able to repair the portal, not repair it and still have diamonds
-- spare for the pickaxe.
--
-- Only the `award` literal changes. Everything else is the function as it
-- stands in production, reproduced so this file is the whole definition rather
-- than a diff.

create or replace function public.resolve_pvp_match(p_match_id uuid, p_admin_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
    match_row pvp_matches%rowtype;
    winner pvp_match_teams%rowtype;
    loser pvp_match_teams%rowtype;
    existing_result pvp_results%rowtype;
    award jsonb := '{"gold": 20, "iron": 15, "stone": 25, "emerald": 4, "diamond": 15}'::jsonb;
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
$function$;
