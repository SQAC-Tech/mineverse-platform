import { describe, expect, it } from 'vitest';
import { classifyShortcut, isShortcutBlocked } from '@/lib/proctor/shortcuts';

/** Minimal stand-in — `classifyShortcut` only reads these five fields. */
function key(
  k: string,
  mods: { ctrl?: boolean; meta?: boolean; alt?: boolean; shift?: boolean } = {},
): KeyboardEvent {
  return {
    key: k,
    ctrlKey: Boolean(mods.ctrl),
    metaKey: Boolean(mods.meta),
    altKey: Boolean(mods.alt),
    shiftKey: Boolean(mods.shift),
  } as KeyboardEvent;
}

describe('proctor shortcuts — what must keep working', () => {
  it('never swallows ordinary typing', () => {
    for (const k of ['a', 'Z', '4', ' ', '.', 'Enter', 'Tab', 'ArrowUp', 'Backspace', 'Delete']) {
      expect(isShortcutBlocked(key(k)), `${k} must reach the answer box`).toBe(false);
    }
  });

  it('leaves the editing shortcuts a participant needs alone', () => {
    for (const k of ['a', 'z', 'y', 'x', 'c', 'v']) {
      // Copy and paste are caught by the clipboard listeners instead, which also
      // fire for the right-click menu — blocking them here as well would double
      // count a single action.
      expect(isShortcutBlocked(key(k, { ctrl: true })), `Ctrl+${k}`).toBe(false);
    }
  });
});

describe('proctor shortcuts — what must be blocked', () => {
  it('blocks the keys that leave fullscreen or the window', () => {
    expect(classifyShortcut(key('Escape'))).toMatchObject({ blocked: true, reason: 'fullscreen-exit' });
    expect(classifyShortcut(key('Alt'))).toMatchObject({ blocked: true, reason: 'alt-menu' });
    expect(classifyShortcut(key('Tab', { alt: true }))).toMatchObject({ blocked: true, reason: 'window-switch' });
    expect(classifyShortcut(key('ArrowLeft', { alt: true }))).toMatchObject({ blocked: true });
    expect(classifyShortcut(key('Meta'))).toMatchObject({ blocked: true, reason: 'os-launcher' });
  });

  it('blocks function keys, including the fullscreen and devtools ones', () => {
    for (const k of ['F1', 'F4', 'F11', 'F12']) {
      expect(classifyShortcut(key(k))).toMatchObject({ blocked: true, reason: 'function-key' });
    }
  });

  // The reference implementation returned "allowed" for every Ctrl/Cmd combo,
  // which left devtools and view-source reachable during a round.
  it('blocks devtools and view-source, which the reference implementation missed', () => {
    expect(classifyShortcut(key('i', { ctrl: true, shift: true }))).toMatchObject({ blocked: true, reason: 'devtools' });
    expect(classifyShortcut(key('j', { ctrl: true, shift: true }))).toMatchObject({ blocked: true, reason: 'devtools' });
    expect(classifyShortcut(key('c', { meta: true, shift: true }))).toMatchObject({ blocked: true, reason: 'devtools' });
    expect(classifyShortcut(key('u', { ctrl: true }))).toMatchObject({ blocked: true, reason: 'view-source' });
  });

  it('blocks printing without counting it against the team', () => {
    expect(classifyShortcut(key('p', { ctrl: true }))).toEqual({ blocked: true, counts: false, reason: 'print' });
  });
});

describe('proctor shortcuts — reload is a deliberate escape hatch', () => {
  // A team whose page has wedged and who cannot reload is a support problem no
  // proctor rule is worth causing. Reloads are logged via `reload_attempt`.
  it('allows F5 and Ctrl+R even though other function keys are blocked', () => {
    expect(isShortcutBlocked(key('F5'))).toBe(false);
    expect(isShortcutBlocked(key('r', { ctrl: true }))).toBe(false);
    expect(isShortcutBlocked(key('r', { meta: true }))).toBe(false);
    // Neighbouring function keys stay blocked, so this is a carve-out and not a hole.
    expect(isShortcutBlocked(key('F4'))).toBe(true);
    expect(isShortcutBlocked(key('F6'))).toBe(true);
  });
});
