-- One paper per duel, not one paper for the whole hall.
--
-- The pack was copied with `where round_id = ... and type = 'pvp'` and nothing
-- else, so every match in the event got every PvP question -- the same set, in
-- the same order, for everybody. The first pair to finish could tell the next
-- pair exactly what was coming.
--
-- The bank is now seven slots of three variants each (`variant_group`
-- r3-p01 .. r3-p07). This picks one variant per slot.
--
-- ## Seeded on the match, not the team
--
-- `md5(match_id || question_id)` -- so the choice is stable for a given duel and
-- different between duels. It must NOT be keyed on the team the way the round
-- papers are: both opponents have to sit the identical paper or the race is not
-- a race. That is why this cannot reuse `pickVariants`, which exists to give two
-- teams *different* questions.
--
-- `distinct on (variant_group)` takes the first row per slot under that
-- ordering, which is a deterministic pseudo-random pick.
create or replace function pvp_matchmake(p_round_id integer, p_pack_round_id integer, p_duration_seconds integer, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
    pair_row   record;
    v_match_id uuid;
    v_created  integer := 0;
    v_matches  jsonb := '[]'::jsonb;
begin
    perform pg_advisory_xact_lock(hashtext('mineverse.pvp_matchmaking'));

    create temporary table _waiting on commit drop as
    select q.team_id, q.year_label, q.rank_score, q.tie_break, q.team_code
    from pvp_queue q
    where q.round_id = p_round_id and q.match_id is null;

    create temporary table _pairs on commit drop as
    with ranked as (
        select team_id, year_label,
               row_number() over (
                   partition by year_label
                   order by rank_score desc, tie_break desc, team_code asc
               ) as rn
        from _waiting
    )
    select a.team_id as team_a, b.team_id as team_b, a.year_label as bracket
    from ranked a
    join ranked b on b.year_label = a.year_label and b.rn = a.rn + 1
    where a.rn % 2 = 1;

    insert into _pairs (team_a, team_b, bracket)
    with spare as (
        select w.* from _waiting w
        where w.team_id not in (
            select team_a from _pairs union all select team_b from _pairs
        )
    ),
    ranked as (
        select team_id,
               row_number() over (order by rank_score desc, tie_break desc, team_code asc) as rn
        from spare
    )
    select a.team_id, b.team_id, 'Cross year'
    from ranked a
    join ranked b on b.rn = a.rn + 1
    where a.rn % 2 = 1;

    for pair_row in select * from _pairs loop
        insert into pvp_matches (round_id, pack_id, status, duration_seconds, created_by)
        values (p_round_id, 'round3-pvp-v2', 'draft', p_duration_seconds, p_actor)
        returning id into v_match_id;

        insert into pvp_match_teams (match_id, team_id, status, eligibility_snapshot)
        values
            (v_match_id, pair_row.team_a, 'pending',
             jsonb_build_object('bracket', pair_row.bracket, 'seeded_by', 'auto', 'captured_at', now())),
            (v_match_id, pair_row.team_b, 'pending',
             jsonb_build_object('bracket', pair_row.bracket, 'seeded_by', 'auto', 'captured_at', now()));

        insert into pvp_match_questions (
            match_id, source_question_id, display_order, type, prompt,
            content, language_options, time_limit_seconds, expected_answer
        )
        select v_match_id, chosen.id,
               row_number() over (order by chosen.variant_group),
               chosen.type, chosen.prompt, chosen.content, chosen.language_options,
               chosen.time_limit_seconds, chosen.expected_answer
        from (
            select distinct on (q.variant_group) q.*
            from questions q
            where q.round_id = p_pack_round_id and q.type = 'pvp'
            -- The pick. Stable per match, different across matches.
            order by q.variant_group, md5(v_match_id::text || q.id::text)
        ) as chosen;

        perform start_pvp_match(v_match_id, p_actor);

        update pvp_queue
        set match_id = v_match_id, matched_at = now()
        where team_id in (pair_row.team_a, pair_row.team_b);

        v_created := v_created + 1;
        v_matches := v_matches || jsonb_build_object(
            'match_id', v_match_id,
            'bracket', pair_row.bracket,
            'teams', jsonb_build_array(pair_row.team_a, pair_row.team_b)
        );
    end loop;

    return jsonb_build_object(
        'matches_created', v_created,
        'matches', v_matches,
        'still_waiting', (
            select count(*) from pvp_queue
            where round_id = p_round_id and match_id is null
        )
    );
end;
$function$;
