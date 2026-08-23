-- Attendance checkpoints gate rounds, and one checkpoint can gate several.
--
-- The event marks attendance twice a day, not once per round: on day 1 the
-- first desk covers Rounds 1 and 2 together and the second covers Round 3, and
-- on day 2 each of Rounds 4 and 5 gets its own. A single `round_id` cannot say
-- "this desk covers 1 and 2", so the covered rounds become an array and
-- `round_id` is kept as the first of them for anything still reading it.
alter table attendance_checkpoints
    add column if not exists covers_rounds int[] not null default '{}';

comment on column attendance_checkpoints.covers_rounds is
    'Rounds this checkpoint admits a team to. A team with no record here cannot enter any of them.';

-- Rebuilt rather than edited: the old rows were one-per-round (and one per
-- phase for Round 4), which is not the shape the desks actually run in. Safe to
-- replace only because no attendance has been marked yet — the delete would
-- cascade real records otherwise.
delete from attendance_records
    where checkpoint_id in (select id from attendance_checkpoints);
delete from attendance_checkpoints;

insert into attendance_checkpoints (code, label, round_id, day, sequence, covers_rounds) values
    ('DAY1_R12', 'Day 1 — Rounds 1 & 2', 1, 1, 1, '{1,2}'),
    ('DAY1_R3',  'Day 1 — Round 3',      3, 1, 2, '{3}'),
    ('DAY2_R4',  'Day 2 — Round 4',      4, 2, 3, '{4}'),
    ('DAY2_R5',  'Day 2 — Round 5',      5, 2, 4, '{5}');
