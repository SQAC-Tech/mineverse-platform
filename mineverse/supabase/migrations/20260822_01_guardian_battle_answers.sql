-- What a team actually typed in a guardian fight.
--
-- `resolveGuardianBattle` graded the answers and threw them away, keeping only
-- `correct_count`. A guardian is all-or-nothing and a loss costs resources, so
-- "we typed that and it marked us wrong" is a dispute an organiser has to settle
-- at a desk — and there was nothing on the server to settle it with.
--
-- One JSONB column rather than a child table: a battle has three answers, they
-- are written once at resolve time and never updated, and they are read only by
-- the admin submissions console.
--
-- Already applied to the live database. This file is the record, not the
-- mechanism — see the note in docs about `supabase/migrations` having drifted
-- from what is actually deployed.
alter table public.guardian_battles
  add column if not exists answers jsonb not null default '[]'::jsonb;

comment on column public.guardian_battles.answers is
  'Per-question record of one resolve: [{question_id, order_index, answer_text, correct}]. Written once by resolveGuardianBattle; never edited.';
