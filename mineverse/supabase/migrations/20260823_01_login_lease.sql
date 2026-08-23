-- The one-device rule, rebuilt as a lease that releases itself.
--
-- `active_login_ip` was doing three jobs badly. The check that read it never
-- compared it to anything -- `if (teamIp) reject` -- so it was not a pin to a
-- device at all, it was a latch: one successful login per team, ever, and the
-- same laptop was refused a second time. Logout cleared the cookie and left the
-- latch set, so pressing LOGOUT barred the team until a volunteer released it
-- by hand.
--
-- IP could never have been the right key here anyway. The venue sits behind one
-- SRMIST NAT address, so on the day every team looks identical to every other;
-- mobile addresses rotate mid-session, so an honest team looks like a new one.
-- The device does the identifying now, via a long-lived cookie, and the IP is
-- kept only so the desk can see where a team logged in from.
--
-- The lease is held by a device and refreshed by activity. It is handed over
-- when the holder goes quiet, which is the case nobody could handle before: a
-- dead battery, a closed lid, a browser that lost its cookies.

alter table teams add column if not exists active_login_device  text;
alter table teams add column if not exists active_login_at      timestamptz;
alter table teams add column if not exists active_login_seen_at timestamptz;

comment on column teams.active_login_device  is 'Device cookie holding the login lease. Null means the seat is free.';
comment on column teams.active_login_at      is 'When the current lease was claimed.';
comment on column teams.active_login_seen_at is 'Last authenticated activity. A stale value lets another device take over.';

create index if not exists teams_active_login_seen_idx
    on teams (active_login_seen_at)
    where active_login_device is not null;

-- Tidy away the latches left by the old scheme.
--
-- Not load-bearing: `checkLoginLease` treats a row with no device id as a free
-- seat precisely so the 80 latches standing when this shipped -- all taken from
-- hostels and mobile data during the screening, none from the venue -- retire
-- themselves the first time each team logs in. Without that the whole roster
-- would have been refused at the door on event morning.
--
-- This is the housekeeping pass, so the stale addresses do not sit in the table
-- looking meaningful. Clearing a lease never signs anyone out; the session
-- cookie is untouched.
update teams
   set active_login_ip      = null,
       active_login_device  = null,
       active_login_at      = null,
       active_login_seen_at = null
 where active_login_ip is not null
    or active_login_device is not null;
