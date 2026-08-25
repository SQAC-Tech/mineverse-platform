-- The check constraint had fallen two kinds behind the client.
--
-- `lib/proctor/config.ts` emits fifteen event kinds; this constraint listed
-- thirteen. Every `text_selection` and `drag_attempt` insert was rejected with
-- 23514 from the moment those kinds were added, so the two things the proctor
-- most often catches a team doing -- dragging the question text, selecting it
-- to copy -- were the two it could not record.
--
-- Both are 'info' severity: recorded, never charged against a budget. So this
-- widens what the console can see without changing anyone's standing, and it
-- needs no deployment -- the client has been sending them all along.
alter table proctor_events
  drop constraint proctor_events_kind_check;

alter table proctor_events
  add constraint proctor_events_kind_check check (
    kind = any (array[
      'session_start',
      'tab_hidden',
      'tab_visible',
      'window_blur',
      'fullscreen_exit',
      'fullscreen_restored',
      'copy',
      'paste',
      'context_menu',
      'blocked_key',
      'text_selection',
      'drag_attempt',
      'reload_attempt',
      'heartbeat',
      'session_end'
    ])
  );
