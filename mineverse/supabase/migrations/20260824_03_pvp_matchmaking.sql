-- Automatic PvP pairing: teams opt in, the server seeds the bracket.
--
-- Until now a duel was drafted by hand — an organiser picked two teams in the
-- admin panel and started the match. That does not scale to a hall of forty
-- teams all finishing Round 3 at once, so entry becomes self-service: a team
-- presses ENTER PVP, lands in a queue, and the server pairs it.
--
-- ## The pairing rule
--
-- Two constraints, in order:
--
--   1. **Same academic year.** First years fight first years, second years
--      fight second years. The year comes from the members' SRM registration
--      numbers (`lib/gameplay/pvp/year-detection.ts`) and is stamped onto the
--      queue row at entry, so pairing never has to go and ask again.
--   2. **Adjacent rank.** Inside a year the queue is sorted best-first and
--      paired off the top: 1st plays 2nd, 3rd plays 4th, and so on. Seeding the
--      strong against the strong is the opposite of a knockout bracket, and it
--      is deliberate — every duel should be worth watching, and nobody's first
--      match should be a formality.
--
-- A year with an odd number of entrants leaves exactly one team unpaired. Those
-- leftovers are then paired against each other across years, again best-first,
-- which is the "ek 1st year aur ek 2nd year bachi toh unko pair kar do" case.
-- Whatever is still single after that stays queued and is picked up the moment
-- the next team enters.
--
-- ## Why the pairing runs in the database
--
-- Every team presses the button within the same couple of minutes, so two
-- requests will routinely try to pair the same team at once. The transaction
-- takes an advisory lock, which makes the whole pass serial; without it the
-- only thing standing between a team and two simultaneous matches is
-- `idx_pvp_match_teams_one_active`, and losing that race would surface to a
-- participant as a raw unique violation.

create table if not exists pvp_queue (
    team_id     uuid primary key references teams(id) on delete cascade,
    round_id    integer not null references rounds(id),
    -- Snapshotted at entry, not recomputed at pairing time: a team's standing
    -- must not move between joining the queue and being paired.
    year_label  text not null default 'Unknown Year',
    rank_score  numeric not null default 0,
    tie_break   integer not null default 0,
    team_code   text not null,
    joined_at   timestamptz not null default now(),
    match_id    uuid references pvp_matches(id) on delete set null,
    matched_at  timestamptz
);

create index if not exists idx_pvp_queue_waiting
    on pvp_queue (round_id, rank_score desc)
    where match_id is null;

alter table pvp_queue enable row level security;

-- Every read and write goes through the service role in a route handler, which
-- bypasses RLS. No policy is defined on purpose: a participant's browser has no
-- business reading the queue, because the queue is the seeding order.

create or replace function public.pvp_matchmake(
    p_round_id integer,
    p_pack_round_id integer,
    p_duration_seconds integer,
    p_actor text
) returns jsonb
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
    -- Serialises the whole pass. Released when the transaction ends.
    perform pg_advisory_xact_lock(hashtext('mineverse.pvp_matchmaking'));

    create temporary table _waiting on commit drop as
    select q.team_id, q.year_label, q.rank_score, q.tie_break, q.team_code
    from pvp_queue q
    where q.round_id = p_round_id and q.match_id is null;

    -- 1st vs 2nd, 3rd vs 4th, within each year.
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

    -- One team can be left over per year. Pair those against each other,
    -- best-first, so a lone first year meets a lone second year.
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
        values (p_round_id, 'round3-pvp-v1', 'draft', p_duration_seconds, p_actor)
        returning id into v_match_id;

        insert into pvp_match_teams (match_id, team_id, status, eligibility_snapshot)
        values
            (v_match_id, pair_row.team_a, 'pending',
             jsonb_build_object('bracket', pair_row.bracket, 'seeded_by', 'auto', 'captured_at', now())),
            (v_match_id, pair_row.team_b, 'pending',
             jsonb_build_object('bracket', pair_row.bracket, 'seeded_by', 'auto', 'captured_at', now()));

        -- Sealed copy of the pack, expected answers included. These columns are
        -- never served to a team; `serializeSafePvpQuestion` is what goes out.
        insert into pvp_match_questions (
            match_id, source_question_id, display_order, type, prompt,
            content, language_options, time_limit_seconds, expected_answer
        )
        select v_match_id, q.id,
               row_number() over (order by q.order_index, q.id),
               q.type, q.prompt, q.content, q.language_options,
               q.time_limit_seconds, q.expected_answer
        from questions q
        where q.round_id = p_pack_round_id and q.type = 'pvp';

        -- Reuses the existing start path rather than repeating its checks: it
        -- refuses a match without two teams or without a sealed pack, which is
        -- exactly the guard worth keeping on an automatic seeder.
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

revoke all on function public.pvp_matchmake(integer, integer, integer, text) from public, anon, authenticated;
grant execute on function public.pvp_matchmake(integer, integer, integer, text) to service_role;
