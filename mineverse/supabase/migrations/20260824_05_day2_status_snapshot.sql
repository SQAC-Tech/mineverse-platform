-- Everything `GET /api/team/day2/status` reads, in one round trip.
--
-- The route ran five separate PostgREST calls — the Day 2 access guard, the
-- fragment, the repair row, the resources row and the latest boss attempt — and
-- the portal screen polled it every five seconds. At 45 teams that is 45 requests
-- a second against a nine-megabyte database, and 120,000 of the edge log's
-- busiest day were these two portal tables alone.
--
-- The queries were never the cost. Each one is a primary-key lookup on a table
-- that fits in shared_buffers; the cost was five HTTPS round trips to PostgREST
-- for every tick of every team's screen. Collapsing them changes nothing about
-- what is read and removes four fifths of the requests.
--
-- `qualified` is returned rather than enforced. The guard still refuses the
-- request in the route — this function only reports, so that a team who is not
-- qualified costs one call to find that out instead of one call and a rejection.
create or replace function day2_status_snapshot(p_team_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'qualified', coalesce(gs.qualified_for_day2, false),
    'state', to_jsonb(gs.*),
    'nether_core_count', coalesce(gs.nether_core_count, 0),
    'has_fragment', exists (select 1 from day2_portal_fragments f where f.team_id = p_team_id),
    'is_repaired', exists (select 1 from day2_portal_repair r where r.team_id = p_team_id),
    'diamond_count', coalesce((select res.diamond from resources res where res.team_id = p_team_id), 0),
    'last_attempt', (
      select to_jsonb(a.*)
      from day2_final_boss_attempts a
      where a.team_id = p_team_id
      order by a.started_at desc nulls last
      limit 1
    )
  )
  from team_game_state gs
  where gs.team_id = p_team_id;
$$;

comment on function day2_status_snapshot(uuid) is
  'One-call replacement for the five reads behind GET /api/team/day2/status.';
