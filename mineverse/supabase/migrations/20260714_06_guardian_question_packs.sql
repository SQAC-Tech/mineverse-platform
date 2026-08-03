-- Migration 06: Guardian question packs and battle grading columns.
--
-- Guardian battles previously had no question source and no way to submit an
-- answer, so resolveGuardianBattle could only ever record a loss. A guardian
-- question lives in the round it belongs to but is served only inside a battle,
-- never in the normal round question list.

alter table questions add column if not exists guardian_name text
    check (guardian_name is null or guardian_name in ('forest_guardian', 'skeleton_archer', 'blaze_guardian'));

create index if not exists idx_questions_guardian
    on questions(guardian_name, round_id, order_index)
    where guardian_name is not null;

-- Server-side deadline and grading tally, so a late answer cannot win after the
-- fact and a result stays auditable.
alter table guardian_battles add column if not exists deadline_at timestamptz;
alter table guardian_battles add column if not exists correct_count integer;
alter table guardian_battles add column if not exists total_questions integer;
