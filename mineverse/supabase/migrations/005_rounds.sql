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
