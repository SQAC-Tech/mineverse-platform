alter table relay_screening_attempts
    add column if not exists year1_duration_seconds int,
    add column if not exists year2_duration_seconds int,
    add column if not exists year2_moves int,
    add column if not exists year3_answer text,
    add column if not exists year3_status text not null default 'pending',
    add column if not exists year3_duration_seconds int;

