-- The screening round: one 30-minute MCQ paper, open for a single day, that
-- decides who gets a seat on event day.
--
-- Round 0 exists so the screening can borrow three things the game rounds already
-- have: the proctor's `round_id` foreign key, a status the admin panel can flip,
-- and a home for the window. Everything MCQ-shaped lives in its own tables —
-- `questions` has no options column, no per-team question set, and a per-row
-- `reward`, none of which fits a paper that is drawn, auto-graded and scored whole.

-- `rounds_day_check` allowed only days 1 and 2, the two event days. The screening
-- sits before both, on the 22nd, so day 0 is widened in rather than lying about
-- it being day 1 — the dashboard and admin round list both group by this column.
alter table rounds drop constraint if exists rounds_day_check;
alter table rounds add constraint rounds_day_check check (day in (0, 1, 2));

insert into rounds (id, name, day, sequence, description, time_allotted, status, starts_at, ends_at)
values (
    0,
    'Screening',
    0,
    0,
    'Qualifier MCQ paper — 25 questions in 30 minutes, one attempt per team.',
    30,
    'locked',
    '2026-08-21T18:30:00Z',  -- 22 Aug 2026, 00:00 IST
    '2026-08-22T18:30:00Z'   -- 23 Aug 2026, 00:00 IST
)
on conflict (id) do nothing;

-- `POST /api/register` fans out one team_round_access row per row in `rounds`, so
-- teams registering from here on pick round 0 up on their own. This backfills the
-- ones that registered before it existed. Unlocked: every registered team may sit
-- the screening, the window and payment verification are what gate it.
insert into team_round_access (team_id, round_id, is_locked)
select id, 0, false from teams
on conflict (team_id, round_id) do nothing;


create table if not exists screening_questions (
    id            uuid primary key default gen_random_uuid(),
    -- Matched on by the seeder so a re-run updates in place and keeps ids, the
    -- same contract the round question banks use.
    order_index   int not null unique,
    difficulty    text not null check (difficulty in ('easy', 'medium', 'hard')),
    topic         text,
    prompt        text not null,
    -- Exactly four strings. Enforced here rather than only in the seeder, because
    -- the draw's option shuffle assumes a fixed width.
    options       jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
    correct_index int not null check (correct_index between 0 and 3),
    -- For reviewing the paper after the event. Never sent to a player.
    explanation   text,
    created_at    timestamptz not null default now()
);

create table if not exists screening_attempts (
    id             uuid primary key default gen_random_uuid(),
    -- One attempt per team, held by the database rather than by a check the
    -- client could race two tabs against.
    team_id        uuid not null unique references teams(id) on delete cascade,

    -- The paper, sealed at start: 25 question ids in display order, and a
    -- per-question permutation of the four options so a screenshot of one team's
    -- paper does not answer another's.
    question_ids   uuid[] not null,
    option_order   jsonb not null default '{}'::jsonb,

    started_at     timestamptz not null default now(),
    -- started_at + 30 minutes, and deliberately NOT clamped to rounds.ends_at:
    -- a team that starts at 23:58 gets its full half hour, to 00:28. The window
    -- closes the door on starting, nothing else.
    deadline_at    timestamptz not null,

    submitted_at   timestamptz,
    auto_submitted boolean not null default false,

    raw_score      numeric(5,1),
    bonus_points   numeric(5,1) not null default 0,
    total_score    numeric(5,1),
    correct_count  int,

    status         text not null default 'in_progress'
                   check (status in ('in_progress', 'submitted', 'expired')),

    created_at     timestamptz not null default now()
);

create table if not exists screening_answers (
    attempt_id     uuid not null references screening_attempts(id) on delete cascade,
    question_id    uuid not null references screening_questions(id) on delete cascade,
    -- The index the player clicked, in the order THEY were shown. Mapped back
    -- through the attempt's option_order before grading.
    selected_index int not null check (selected_index between 0 and 3),
    answered_at    timestamptz not null default now(),
    primary key (attempt_id, question_id)
);

-- A frozen snapshot, not a live query. Once the result mails are out the list
-- must not move because someone edited a question or re-ran a sort.
create table if not exists screening_shortlist (
    team_id          uuid primary key references teams(id) on delete cascade,
    rank             int not null,
    total_score      numeric(5,1) not null,
    submitted_at     timestamptz,
    result           text not null check (result in ('shortlisted', 'rejected')),
    decided_at       timestamptz not null default now(),
    decided_by       text,
    result_mailed_at timestamptz,
    -- The opening-resource grant, so committing twice cannot pay twice.
    grant_ledger_id  uuid
);

create index if not exists screening_attempts_rank_idx
    on screening_attempts (total_score desc, submitted_at asc);
create index if not exists screening_answers_attempt_idx
    on screening_answers (attempt_id);
create index if not exists screening_shortlist_result_idx
    on screening_shortlist (result, rank);

alter table screening_questions enable row level security;
alter table screening_attempts  enable row level security;
alter table screening_answers   enable row level security;
alter table screening_shortlist enable row level security;
