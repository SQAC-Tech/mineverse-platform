# MINEVERSE — Database Engineering Document
## Phase 1 Schema Design & Normalization (v2.0)

**Database:** PostgreSQL (Supabase)
**Normalization:** 3NF enforced
**Row Level Security (RLS):** Enabled on all tables, **deny-all** (service-role-only access)

---

## 1. What changed from v1.0 (and why)

| Change | Reason (PRD requirement) |
|--------|--------------------------|
| ❌ Dropped `event_config` table | All changeable event data (date, venue, fees, UPI, WhatsApp) now lives in **env vars**. |
| ❌ Dropped `teams.password_hash` | No passwords anywhere. Auth is OTP-only. |
| ❌ Dropped `temp_otp` (form_data blob) | OTP is verified **before** submit, so the form never needs to be parked in the DB. Replaced by `otp_challenges`. |
| ✅ New `otp_challenges` | One table for both OTP purposes (registration email verify + event-day login). OTPs stored **hashed**. |
| 🔁 `attendance` (1 row/team) → `attendance_checkpoints` + `attendance_records` | Attendance is now taken **per checkpoint**: Rounds 1–4 and each phase of Round 4. |
| 🔁 Per-member presence JSONB → `members_present` **integer count** | The attendance panel asks "how many members are present", not who. |
| ✅ `teams.qr_token` | The team's attendance QR (signed JWT) moves onto `teams` since attendance rows are now per-checkpoint. |
| ✅ `email_logs.provider` | Distinguishes Resend (OTP) sends from SMTP (everything else). |
| 🔁 RLS simplified to deny-all | All reads/writes go through Next.js API routes using the service-role key; the anon key is used only for Realtime broadcast subscribe (no table access needed). |
| 🔁 `teams.status` enum trimmed | `'registered'`/`'attended'` removed — attendance no longer gates login, and a team goes straight to `payment_pending` on creation. |

---

## 2. Entity Relationship Diagram (Textual)

```
teams ──< members
  │
  ├──< payments                (1:1 enforced by unique team_id)
  │
  ├──< attendance_records >── attendance_checkpoints ──> rounds
  │
  ├──< team_round_access  >── rounds
  │
  ├──< email_logs
  │
  └──< otp_challenges          (login-purpose rows reference a team;
                                registration-purpose rows have team_id = null)
```

---

## 3. Table Specifications

### 3.1 teams
**Purpose:** Core team entity. Passwordless.
**Normalization:** 3NF. `is_payment_verified` is a trigger-synced cache flag (deliberate denormalization for the login gate query).

```sql
create table teams (
    id uuid primary key default gen_random_uuid(),
    team_code text not null unique,            -- Format: MNV-XXX
    team_name text not null,
    team_size integer not null check (team_size between 1 and 3),
    status text not null default 'payment_pending'
        check (status in ('payment_pending', 'verified', 'active', 'eliminated', 'champion')),
    is_payment_verified boolean not null default false,
    qr_token text unique,                      -- attendance QR JWT, set on payment verification
    total_score integer not null default 0,    -- Phase 2
    completion_time integer not null default 0,-- Phase 2, seconds
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_teams_status on teams(status);
create index idx_teams_payment on teams(is_payment_verified);
```

### 3.2 members
**Purpose:** Individual participants (1NF — no arrays).

```sql
create table members (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references teams(id) on delete cascade,
    name text not null,
    email text not null,
    college_email text not null unique,
    phone text not null,
    section text,
    department text not null,
    is_team_lead boolean not null default false,
    email_verified boolean not null default false,  -- true for the lead (OTP-verified pre-submit)
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(team_id, email)
);

create index idx_members_team on members(team_id);
create index idx_members_college_email on members(college_email);
```

### 3.3 payments
**Purpose:** One payment record per team. Amount is snapshotted from env fees at registration time (audit trail — env values may change later).

```sql
create table payments (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null unique references teams(id) on delete cascade,
    amount integer not null,
    team_size integer not null,
    upi_string text,                           -- the upi:// deep link used for the QR
    status text not null default 'pending'
        check (status in ('pending', 'verified', 'rejected')),
    verified_at timestamptz,
    admin_notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_payments_status on payments(status);
```

### 3.4 otp_challenges
**Purpose:** Single table for both OTP flows. OTPs are stored as SHA-256 hashes — a DB leak never exposes live codes.

- `purpose = 'registration'`: created when the lead clicks "Verify Email". After a correct OTP, `verified=true` and the client receives `verification_token`; `POST /api/register` must present the matching `(id, verification_token)` pair, then the row is deleted (single use).
- `purpose = 'login'`: created by `login/request-otp`, `team_id` set; consumed by `login/verify`.

```sql
create table otp_challenges (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    otp_hash text not null,                    -- sha256(otp || JWT_SECRET)
    purpose text not null check (purpose in ('registration', 'login')),
    team_id uuid references teams(id) on delete cascade,  -- null for registration
    attempts integer not null default 0,
    verified boolean not null default false,
    verification_token uuid not null default gen_random_uuid(),
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
);

create index idx_otp_email_purpose on otp_challenges(email, purpose);
create index idx_otp_expires on otp_challenges(expires_at);   -- for cleanup cron
```

**Cleanup:** Supabase scheduled function (or `pg_cron`) deletes rows where `expires_at < now() - interval '1 hour'`.

### 3.5 attendance_checkpoints
**Purpose:** The list of moments attendance is taken. Seeded with 5 rows; organizers can add more phases with a single insert — no code change.

```sql
create table attendance_checkpoints (
    id serial primary key,
    code text not null unique,        -- stable machine name
    label text not null,              -- shown in the /attendance dropdown
    round_id integer references rounds(id) on delete set null,
    day integer not null check (day in (1, 2)),
    sequence integer not null,        -- global ordering for reports
    created_at timestamptz not null default now()
);

insert into attendance_checkpoints (code, label, round_id, day, sequence) values
('ROUND_1',         'Round 1 — Forest & Grasslands', 1, 1, 1),
('ROUND_2',         'Round 2 — Cave Biome',          2, 1, 2),
('ROUND_3',         'Round 3 — Mountain Biome',      3, 1, 3),
('ROUND_4_PHASE_1', 'Round 4 — Phase 1',             4, 2, 4),
('ROUND_4_PHASE_2', 'Round 4 — Phase 2',             4, 2, 5);
```

### 3.6 attendance_records
**Purpose:** One row per team per checkpoint. Stores a **head count**, not per-member flags.

```sql
create table attendance_records (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references teams(id) on delete cascade,
    checkpoint_id integer not null references attendance_checkpoints(id) on delete cascade,
    members_present integer not null check (members_present >= 0),
    method text not null check (method in ('qr_scan', 'manual')),
    notes text,
    marked_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(team_id, checkpoint_id)
);

create index idx_att_rec_team on attendance_records(team_id);
create index idx_att_rec_checkpoint on attendance_records(checkpoint_id);
```

> `members_present <= teams.team_size` is enforced in the API layer (cross-table checks don't belong in a CHECK constraint). Re-marking the same checkpoint is an **upsert** on `(team_id, checkpoint_id)`.

### 3.7 rounds
**Purpose:** Round definitions. Unchanged from v1 except seeding stays aligned with checkpoints.

```sql
create table rounds (
    id serial primary key,
    name text not null,
    day integer not null check (day in (1, 2)),
    sequence integer not null,
    description text,
    time_allotted integer not null,            -- minutes
    status text not null default 'locked'
        check (status in ('locked', 'active', 'completed')),
    starts_at timestamptz,
    ends_at timestamptz,
    created_at timestamptz not null default now()
);

insert into rounds (id, name, day, sequence, description, time_allotted) values
(1, 'Forest & Grasslands', 1, 1, 'Round 1: Text-based riddles and aptitude', 45),
(2, 'Cave Biome',          1, 2, 'Round 2: Code execution challenges',       45),
(3, 'Mountain Biome',      1, 3, 'Round 3: Elimination round',               55),
(4, 'Nether Portal Finale',2, 1, 'Final Round: Day 2 championship',          70);

select setval('rounds_id_seq', 4);
```

### 3.8 team_round_access
**Purpose:** Per-team per-round lock state. Junction table, unchanged.

```sql
create table team_round_access (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references teams(id) on delete cascade,
    round_id integer not null references rounds(id) on delete cascade,
    is_locked boolean not null default true,
    started_at timestamptz,
    completed_at timestamptz,
    score integer not null default 0,
    created_at timestamptz not null default now(),
    unique(team_id, round_id)
);

create index idx_tra_team on team_round_access(team_id);
create index idx_tra_round on team_round_access(round_id);
```

### 3.9 email_logs
**Purpose:** Audit trail for every email, on both providers.

```sql
create table email_logs (
    id uuid primary key default gen_random_uuid(),
    team_id uuid references teams(id) on delete set null,
    member_id uuid references members(id) on delete set null,
    email_type text not null,
        -- 'otp_registration' | 'otp_login' | 'reg_pending' | 'payment_verified'
        -- | 'payment_issue' | 'event_reminder'
    provider text not null check (provider in ('resend', 'smtp')),
    recipient text not null,
    subject text not null,
    status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
    error text,
    sent_at timestamptz,
    created_at timestamptz not null default now()
);

create index idx_email_team on email_logs(team_id);
create index idx_email_type on email_logs(email_type);
create index idx_email_provider on email_logs(provider);
```

---

## 4. Functions & Triggers

### 4.1 Auto-update `updated_at`

```sql
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger teams_updated_at    before update on teams              for each row execute function update_updated_at_column();
create trigger members_updated_at  before update on members            for each row execute function update_updated_at_column();
create trigger payments_updated_at before update on payments           for each row execute function update_updated_at_column();
create trigger att_rec_updated_at  before update on attendance_records for each row execute function update_updated_at_column();
```

### 4.2 Sync payment verification to teams

```sql
create or replace function sync_payment_verification()
returns trigger as $$
begin
    if new.status = 'verified' then
        update teams set is_payment_verified = true,  status = 'verified'        where id = new.team_id;
    elsif new.status in ('pending', 'rejected') then
        update teams set is_payment_verified = false, status = 'payment_pending' where id = new.team_id;
    end if;
    return new;
end;
$$ language plpgsql;

create trigger payment_verification_sync after update of status on payments
    for each row execute function sync_payment_verification();
```

### 4.3 Team code generation

```sql
create or replace function generate_team_code()
returns text as $$
declare
    new_code text;
    exists_check boolean;
begin
    loop
        new_code := 'MNV-' || lpad(floor(random() * 1000)::text, 3, '0');
        select exists(select 1 from teams where team_code = new_code) into exists_check;
        if not exists_check then
            return new_code;
        end if;
    end loop;
end;
$$ language plpgsql;
```

> Note: 1000 possible codes — fine for ≤ a few hundred teams. If you expect more, widen to `MNV-XXXX`.

---

## 5. Row Level Security — deny-all

Every read and write in Phase 1 goes through Next.js API routes using the **service-role key** (which bypasses RLS). The browser's anon key is used **only** to subscribe to a Realtime broadcast channel, which needs no table access. So the correct policy set is: enable RLS everywhere and define **no policies** — anon/authenticated get nothing.

```sql
alter table teams                  enable row level security;
alter table members                enable row level security;
alter table payments               enable row level security;
alter table otp_challenges         enable row level security;
alter table attendance_checkpoints enable row level security;
alter table attendance_records     enable row level security;
alter table rounds                 enable row level security;
alter table team_round_access      enable row level security;
alter table email_logs             enable row level security;
-- No policies created on purpose: deny-all for anon & authenticated roles.
```

---

## 6. Normalization Justification

| Table | 1NF | 2NF | 3NF | Notes |
|-------|-----|-----|-----|-------|
| teams | ✅ | ✅ | ✅ | `is_payment_verified` = trigger-synced cache (documented denormalization) |
| members | ✅ | ✅ | ✅ | One row per person |
| payments | ✅ | ✅ | ✅ | `amount` snapshotted for audit (env fees can change) |
| otp_challenges | ✅ | ✅ | ✅ | Transient; no form blobs anymore |
| attendance_checkpoints | ✅ | ✅ | ✅ | Reference data; new Round-4 phases = new rows, no schema change |
| attendance_records | ✅ | ✅ | ✅ | Head count is an atomic fact of (team, checkpoint) — the JSONB member array from v1 is gone |
| rounds | ✅ | ✅ | ✅ | Static data |
| team_round_access | ✅ | ✅ | ✅ | Junction, composite unique key |
| email_logs | ✅ | ✅ | ✅ | Audit table |

---

## 7. Migration Order

Run in the Supabase SQL Editor in this exact order (each block is one migration file under `supabase/migrations/`):

1. `001_teams.sql` — teams
2. `002_members.sql` — members
3. `003_payments.sql` — payments
4. `004_otp_challenges.sql` — otp_challenges
5. `005_rounds.sql` — rounds **+ seed 4 rounds**
6. `006_attendance.sql` — attendance_checkpoints **+ seed 5 checkpoints**, attendance_records
7. `007_team_round_access.sql` — team_round_access
8. `008_email_logs.sql` — email_logs
9. `009_functions_triggers.sql` — all functions + triggers (§4)
10. `010_rls.sql` — RLS enable statements (§5)

Then generate types:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID --schema public > types/supabase.ts
```

---

## 8. Query Cheat-Sheet (for the API layer)

```sql
-- Login gate (single query)
select id, team_code, is_payment_verified from teams where team_code = $1;

-- Attendance resolve (QR or manual)
select t.*, coalesce(json_agg(ar.* order by ar.checkpoint_id)
       filter (where ar.id is not null), '[]') as records
from teams t
left join attendance_records ar on ar.team_id = t.id
where t.team_code = $1 or t.qr_token = $2
group by t.id;

-- Attendance mark (upsert)
insert into attendance_records (team_id, checkpoint_id, members_present, method)
values ($1, $2, $3, $4)
on conflict (team_id, checkpoint_id)
do update set members_present = excluded.members_present,
              method = excluded.method;

-- Per-checkpoint attendance report
select c.label, count(ar.id) as teams_marked, sum(ar.members_present) as heads
from attendance_checkpoints c
left join attendance_records ar on ar.checkpoint_id = c.id
group by c.id order by c.sequence;
```
