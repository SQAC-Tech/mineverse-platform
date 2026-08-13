-- SRM registration number: "RA" + 13 digits, the first of which is 2 (e.g.
-- RA2211003011234). Nullable because every team registered before this column
-- existed has none; those are collected at the attendance desk instead.
alter table public.members
  add column if not exists registration_no text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'members_registration_no_format'
      and conrelid = 'public.members'::regclass
  ) then
    -- CHECK passes on NULL, so backfilled-later rows are unaffected.
    alter table public.members
      add constraint members_registration_no_format
      check (registration_no ~ '^RA2[0-9]{12}$');
  end if;
end $$;

-- One registration number belongs to one person. Postgres allows repeated
-- NULLs in a unique index, so the not-yet-collected rows do not collide.
create unique index if not exists members_registration_no_key
  on public.members (registration_no);
