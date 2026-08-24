-- The duel, without an organiser in the loop.
--
-- Two changes, both required by the same shift: teams now start and finish
-- their own matches, so the resolution path has to cope with a duel that ends
-- before anyone has swept the pack.

-- 1. What a team actually scored.
--
-- `pvp_match_teams` held only `completion_at` and `elapsed_ms`, both of which
-- are meaningless unless a team got all five right. A 4/5 against a 2/5 left no
-- trace of either number, so the result screen could say who won but never why.
alter table pvp_match_teams
  add column if not exists correct_count integer;

comment on column pvp_match_teams.correct_count is
  'Answers this team got right in the duel. Written when the match is finished.';

-- 2. Ending a duel the moment one team hands it in.
--
-- `resolve_pvp_match` cannot do this. It picks the winner from `completion_at`,
-- which is only ever set for a team that answered *every* question correctly,
-- and it raises 'no team has completed the pack' otherwise. So a duel where one
-- side scored 4/5 and the other 2/5 had no way to end at all except an
-- organiser voiding it.
--
-- The duel is a race, so the rule here is the race's rule: the first team to
-- press SUBMIT stops the clock for both. Whatever the opponent had saved by
-- that instant is what they are marked on -- which is why SAVE & NEXT writes to
-- the server on every question rather than keeping a local draft.
--
-- Winner order: more correct answers wins; level on answers, the faster last
-- correct answer wins; level on both, the team that submitted wins, because
-- they are the one who ended it.
--
-- Scores arrive as a parameter rather than being computed here on purpose.
-- `checkDeterministicAnswer` in TypeScript is the single grader for the whole
-- platform -- it decides Round 1 answers and guardian answers too -- and a
-- second implementation in SQL would be a second set of rules to keep in step.
create or replace function finish_pvp_match(
    p_match_id           uuid,
    p_submitter_team_id  uuid,
    p_scores             jsonb,
    p_actor              text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
    match_row       pvp_matches%rowtype;
    existing_result pvp_results%rowtype;
    winner_id       uuid;
    loser_id        uuid;
    winner_elapsed  integer;
    award           jsonb := '{"gold": 20, "iron": 15, "stone": 25, "emerald": 4, "diamond": 15}'::jsonb;
    mutation        jsonb;
    now_ts          timestamptz := now();
begin
    select * into match_row from pvp_matches where id = p_match_id for update;
    if not found then
        raise exception 'match not found' using errcode = 'no_data_found';
    end if;

    -- Both teams press SUBMIT within a second of each other often enough that
    -- this has to be safe to call twice. The second caller gets the first
    -- caller's verdict rather than a duplicate award.
    select * into existing_result from pvp_results where match_id = p_match_id;
    if found then
        return jsonb_build_object(
            'match_id',       p_match_id,
            'winner_team_id', existing_result.winner_team_id,
            'loser_team_id',  existing_result.loser_team_id,
            'idempotent',     true
        );
    end if;

    if match_row.status <> 'live' then
        raise exception 'match is not live' using errcode = 'check_violation';
    end if;

    -- Record what each side scored before choosing between them, so the result
    -- is auditable even for the team that lost.
    update pvp_match_teams t
    set correct_count = (s.value ->> 'correct')::integer,
        elapsed_ms    = nullif(s.value ->> 'elapsed_ms', '')::integer,
        completion_at = case
                          when (s.value ->> 'correct')::integer > 0 or t.team_id = p_submitter_team_id
                          then now_ts
                          else t.completion_at
                        end
    from jsonb_array_elements(p_scores) as s(value)
    where t.match_id = p_match_id
      and t.team_id = (s.value ->> 'team_id')::uuid;

    select team_id into winner_id
    from pvp_match_teams
    where match_id = p_match_id
    order by
        coalesce(correct_count, 0) desc,
        elapsed_ms asc nulls last,
        (team_id = p_submitter_team_id) desc,
        team_id asc
    limit 1;

    if winner_id is null then
        raise exception 'match is missing its teams' using errcode = 'check_violation';
    end if;

    select team_id into loser_id
    from pvp_match_teams
    where match_id = p_match_id and team_id <> winner_id
    limit 1;

    if loser_id is null then
        raise exception 'match is missing its second team' using errcode = 'check_violation';
    end if;

    select elapsed_ms into winner_elapsed
    from pvp_match_teams
    where match_id = p_match_id and team_id = winner_id;

    mutation := mutate_team_resources(
        winner_id,
        award,
        'pvp_victory',
        p_match_id::text,
        match_row.audit_correlation_id,
        'Won the Round 3 PvP duel',
        'system',
        p_actor
    );

    update pvp_match_teams
    set status = 'completed', outcome = 'won'
    where match_id = p_match_id and team_id = winner_id;

    update pvp_match_teams
    set status = 'completed', outcome = 'lost'
    where match_id = p_match_id and team_id = loser_id;

    update pvp_matches
    set status         = 'resolved',
        resolved_at    = now_ts,
        resolved_by    = p_actor,
        winner_team_id = winner_id,
        result_summary = jsonb_build_object(
            'winner_elapsed_ms', winner_elapsed,
            'award',             award,
            'ended_by',          p_submitter_team_id,
            'scores',            p_scores
        )
    where id = p_match_id;

    insert into pvp_results (
        match_id, winner_team_id, loser_team_id,
        winner_elapsed_ms, award_ledger_id, resolved_at
    ) values (
        p_match_id, winner_id, loser_id,
        winner_elapsed, (mutation ->> 'ledger_id')::uuid, now_ts
    );

    -- The duel is what pays for the Nether Portal, so the win has to grant the
    -- core as well as the materials.
    insert into team_game_state (team_id, nether_core_count, updated_at)
    values (winner_id, 1, now_ts)
    on conflict (team_id) do update
    set nether_core_count = team_game_state.nether_core_count + 1,
        updated_at = now_ts;

    return jsonb_build_object(
        'match_id',          p_match_id,
        'winner_team_id',    winner_id,
        'loser_team_id',     loser_id,
        'winner_elapsed_ms', winner_elapsed,
        'award_ledger_id',   mutation ->> 'ledger_id',
        'idempotent',        false
    );
end;
$function$;

comment on function finish_pvp_match(uuid, uuid, jsonb, text) is
  'Ends a duel when one team submits. Winner: most correct, then fastest, then the submitter.';
