-- Switches an organizer can flip without a redeploy.
--
-- Registration opened and closed through NEXT_PUBLIC_REGISTRATION_OPEN, which
-- lives in the Vercel environment: changing it meant an env edit and a rebuild,
-- and nobody wants to be waiting on a deploy to stop new teams arriving. This
-- table is the override — the env var stays as the default for any key with no
-- row here, so nothing changes until somebody flips it.
--
-- Deliberately key/value rather than a column per flag: the alternative is a
-- one-row table that needs a migration every time a switch is added.
--
-- Already applied to the live database; this file is the record.
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

comment on table public.platform_settings is
  'Runtime overrides for environment defaults. A missing row means "use the env var".';

alter table public.platform_settings enable row level security;

-- No policies on purpose: the service-role key bypasses RLS and every read goes
-- through the server. Anon and authenticated clients get nothing, which is
-- correct — these are organizer switches, and the one value the public needs is
-- served by /api/event/config.
