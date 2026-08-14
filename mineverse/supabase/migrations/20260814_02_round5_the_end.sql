-- Round 5 (The End) was never added to `rounds`.
--
-- Every Round 5 code path already points at round id 5 — `app/(game)/round5/page.tsx`,
-- `lib/gameplay/questions/access.ts`, `lib/grading/day2-round5.ts`,
-- `app/api/team/final-boss/attempts` and `ROUND_CONFIGS[5]` — but the row itself was
-- missing, so the team_round_access lookup always failed and no Round 5 question could
-- be inserted at all (`questions.round_id` is a foreign key into this table).
--
-- Round 4 keeps its existing name. On the platform it is only the Nether Portal repair;
-- everything else in that hour is off-platform (see docs/REMOVED_SYSTEMS.md).

insert into rounds (id, name, day, sequence, description, time_allotted, status)
values (5, 'The End', 2, 2, 'Round 5: Coding, logic puzzles and the Final Boss', 70, 'locked')
on conflict (id) do nothing;

-- The id was inserted explicitly, so move the sequence past it or the next
-- auto-generated round id would collide.
select setval('rounds_id_seq', greatest((select max(id) from rounds), 5));

-- `POST /api/register` creates one access row per row in `rounds`, so teams that
-- register from now on pick Round 5 up on their own. This backfills the teams that
-- registered while the round did not exist. Locked, like every other round starts.
insert into team_round_access (team_id, round_id, is_locked)
select id, 5, true from teams
on conflict (team_id, round_id) do nothing;
