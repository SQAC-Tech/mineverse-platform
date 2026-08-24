/**
 * Which key combinations a round screen refuses.
 *
 * ## The policy, and why it changed
 *
 * This used to allow-list a handful of dangerous combos and let everything else
 * through — which meant Ctrl and Cmd shortcuts worked, Print Screen only got
 * caught on keyup, and the function keys were the only F-row rule. Anything not
 * thought of in advance was permitted.
 *
 * It is now the other way round: **a modifier combination is refused unless it
 * is on the editing allow-list.** Enumerating what a team legitimately needs
 * while answering a question is a short, closed list; enumerating everything a
 * browser and an OS will do with Ctrl, Cmd, Alt and the Windows key is not.
 *
 * ## Blocking is not accusing
 *
 * Every rule here is `blocked but not counted`. A swallowed keystroke did not
 * help the team, so charging them for it punishes muscle memory — Ctrl+S in a
 * code editor is a reflex, not an attempt to cheat. What still counts against a
 * team is leaving the screen: tab switches and fullscreen exits, which is the
 * one thing this file cannot prevent and the organisers actually care about.
 *
 * ## What must never break
 *
 * Letters, digits, space, Shift, Backspace, Delete, Enter, Tab and the arrows
 * are how a team answers the paper. Nothing below may swallow a plain
 * keystroke, and the editing allow-list keeps word-wise navigation and undo
 * working under Ctrl so the code editor stays usable.
 */

export interface ShortcutDecision {
  /** Swallow the event. */
  blocked: boolean;
  /** Spend a key-violation budget point. Nothing does any more — see above. */
  counts: boolean;
  /** Short label for the event detail, e.g. `devtools` or `screenshot`. */
  reason?: string;
}

const ALLOW: ShortcutDecision = { blocked: false, counts: false };

/** Blocked, and deliberately not held against the team. */
function block(reason: string): ShortcutDecision {
  return { blocked: true, counts: false, reason };
}

/**
 * Editing keys that keep working with Ctrl/Cmd held.
 *
 * Word-wise movement and deletion, undo/redo, and select-all. Without these the
 * code editor becomes painful to use in a timed round, and none of them move
 * information off the screen — which is what the rest of the modifier space is
 * being closed for.
 *
 * Copy, cut and paste are deliberately absent.
 */
const EDITING_WITH_MODIFIER = new Set([
  'arrowleft', 'arrowright', 'arrowup', 'arrowdown',
  'home', 'end',
  'backspace', 'delete',
  'z', 'y', 'a',
]);

/** Single keys that are refused even with no modifier held. */
const BARE_BLOCKED = new Set([
  // Opens the Windows menu bar / the macOS menu, both of which leave the page.
  'alt',
  // The Windows and Command keys open the OS launcher.
  'meta', 'os', 'contextmenu',
]);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if (target.isContentEditable) return true;
  // Monaco renders into a contenteditable it manages itself; the closest check
  // survives its internal DOM changing between versions.
  return Boolean(target.closest('.monaco-editor, [contenteditable="true"]'));
}

export function classifyShortcut(event: KeyboardEvent): ShortcutDecision {
  const key = event.key.toLowerCase();
  const mod = event.ctrlKey || event.metaKey;

  /* ------------------------------------------------- always-allowed typing */

  // Listed explicitly rather than inferred, so no later rule can capture them.
  if (key === 'backspace' || key === 'delete' || key === 'enter' || key === 'tab') {
    // ...unless a modifier is held, which is handled below (Alt+Tab, Ctrl+W).
    if (!mod && !event.altKey) return ALLOW;
  }

  /* ------------------------------------------------------- screen capture */

  // Print Screen is caught on keydown as well as keyup. The OS often takes the
  // shot before the browser sees the key at all, so this cannot be relied on —
  // it is one layer, not the guarantee.
  if (key === 'printscreen') return block('screenshot');

  // Windows' Win+Shift+S snipping tool, and the macOS Cmd+Shift+3/4/5 family.
  if (mod && event.shiftKey && ['s', '3', '4', '5'].includes(key)) return block('screenshot');

  /* ----------------------------------------------------------- leaving the page */

  // Escape leaves fullscreen, which is the enforcement this whole layer rests
  // on. Not counted here: if they do get out, `fullscreen_exit` records it and
  // that is the event which spends the warning budget.
  if (key === 'escape') return block('fullscreen-exit');

  if (BARE_BLOCKED.has(key)) return block('os-key');

  // Every Alt combination: Alt+Tab and Alt+F4 leave the window, Alt+Arrow is
  // browser history, and the rest open menus.
  if (event.altKey) return block('window-switch');

  /* ------------------------------------------------------------ function row */

  // Reload stays available on purpose. With a hall full of teams, one whose
  // page has wedged and who cannot reload is a support problem no proctor rule
  // is worth causing — and reloads are recorded through `reload_attempt` on
  // beforeunload, with the gate forcing fullscreen again afterwards.
  if (key === 'f5' || (mod && key === 'r')) return ALLOW;

  // F11 toggles fullscreen, F12 opens devtools, the rest is browser chrome.
  if (/^f\d{1,2}$/.test(key)) return block('function-key');

  /* ------------------------------------------------- the modifier space */

  if (mod) {
    // Named for the log, so the console can tell a devtools attempt from a
    // stray Ctrl+S. All of them are blocked either way.
    if (event.shiftKey && ['i', 'j', 'c'].includes(key)) return block('devtools');
    if (key === 'u') return block('view-source');
    if (key === 'p') return block('print');
    if (['c', 'v', 'x'].includes(key)) return block('clipboard');

    // Select-all only where there is something to select into. Elsewhere it
    // selects the question text, which is what the selection guard exists to
    // prevent.
    if (key === 'a') return isEditableTarget(event.target) ? ALLOW : block('select-all');

    if (EDITING_WITH_MODIFIER.has(key)) return ALLOW;

    // Everything else under Ctrl/Cmd — new tab, new window, close, save, find,
    // open, history, downloads, zoom, and whatever the browser adds next.
    return block('shortcut');
  }

  // A plain keystroke: letters, digits, space, punctuation, Shift, the arrows,
  // Page Up/Down, Home/End. This is the answer being typed.
  return ALLOW;
}

/** Convenience wrapper matching the reference implementation's shape. */
export function isShortcutBlocked(event: KeyboardEvent): boolean {
  return classifyShortcut(event).blocked;
}

export { isEditableTarget };
