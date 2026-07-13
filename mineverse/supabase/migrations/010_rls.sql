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
