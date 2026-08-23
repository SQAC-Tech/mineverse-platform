-- RSVP tracking on the frozen shortlist.
--
-- Between the shortlist being drawn and the event, every qualifying team is
-- asked to confirm on a Google Form that they can actually come — a hosteller
-- needs permission to be out, and a seat held for a team that never arrives is
-- a seat a waiting team could have had.
--
-- Recorded here rather than on `teams` because it is a fact about this
-- shortlist: clearing the shortlist should clear the RSVPs with it, which the
-- existing cascade already does.
--
-- Confirmation is marked by hand from the admin console as replies come in.
-- Nothing reads the form directly, so this is the only record of who answered.
alter table screening_shortlist
    add column if not exists rsvp_confirmed_at timestamptz,
    add column if not exists rsvp_confirmed_by text;

comment on column screening_shortlist.rsvp_confirmed_at is
    'When an organizer marked this team''s RSVP as received. Null means no reply yet.';
