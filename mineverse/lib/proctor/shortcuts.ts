/**
 * Which key combinations a round screen refuses, and which of those count
 * against the team.
 *
 * Ported from dbug-espionage's `isShortcutBlocked` with three deliberate
 * changes, each noted at its rule below: devtools and view-source combos are
 * now caught, reload is left as an escape hatch, and the decision returns a
 * reason so the event log can say what was pressed rather than just "a key".
 */

export interface ShortcutDecision {
  /** Swallow the event. */
  blocked: boolean;
  /** Spend a key-violation budget point. Some keys are blocked but forgiven. */
  counts: boolean;
  /** Short label for the event detail, e.g. `devtools` or `fullscreen-exit`. */
  reason?: string;
}

const ALLOW: ShortcutDecision = { blocked: false, counts: false };

/** Blocked and counted. */
function stop(reason: string): ShortcutDecision {
  return { blocked: true, counts: true, reason };
}

/** Blocked, but not held against the team. */
function stopQuietly(reason: string): ShortcutDecision {
  return { blocked: true, counts: false, reason };
}

export function classifyShortcut(event: KeyboardEvent): ShortcutDecision {
  const key = event.key.toLowerCase();
  const mod = event.ctrlKey || event.metaKey;

  // Typing has to keep working. Nothing below should ever swallow a plain
  // character, and Backspace in particular used to be a bug magnet.
  if (key === 'backspace') return ALLOW;

  // Escape leaves fullscreen, which is the whole enforcement.
  if (key === 'escape') return stop('fullscreen-exit');

  // Alt on its own opens the browser menu bar on Windows; Alt+Tab and Alt+Arrow
  // leave the page entirely.
  if (key === 'alt') return stop('alt-menu');
  if (event.altKey && ['tab', 'arrowleft', 'arrowright', 'f4'].includes(key)) {
    return stop('window-switch');
  }

  // The Windows / Command key opens the OS launcher.
  if (key === 'meta' || key === 'os') return stop('os-launcher');

  // NEW vs the reference: reload stays available.
  //
  // dbug-espionage blocked F5 through a blanket F-key rule. With 41 teams on
  // event day, a team whose page has wedged and who cannot reload is a support
  // problem no proctor rule is worth causing. Reloads are recorded through
  // `reload_attempt` on beforeunload instead, and the gate makes them re-enter
  // fullscreen afterwards, so nothing is silently gained by it.
  if (key === 'f5') return ALLOW;
  if (mod && key === 'r') return ALLOW;

  // Every other function key: F11 toggles fullscreen, F12 opens devtools, and
  // the rest are browser chrome nobody needs mid-round.
  if (/^f\d{1,2}$/.test(key)) return stop('function-key');

  // NEW vs the reference: devtools and view-source were reachable there,
  // because the Ctrl/Cmd branch returned "allowed" for everything.
  if (mod && event.shiftKey && ['i', 'j', 'c'].includes(key)) return stop('devtools');
  if (mod && key === 'u') return stop('view-source');
  if (mod && key === 'p') return stopQuietly('print');

  // Ctrl/Cmd is otherwise left alone so select-all, undo and arrow-word
  // navigation still work while answering. Copy and paste are caught by their
  // own clipboard listeners, which fire for right-click and menu use too.
  return ALLOW;
}

/** Convenience wrapper matching the reference implementation's shape. */
export function isShortcutBlocked(event: KeyboardEvent): boolean {
  return classifyShortcut(event).blocked;
}
