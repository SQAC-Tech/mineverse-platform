/**
 * Fullscreen and keyboard-lock helpers.
 *
 * Ported from dbug-espionage's `src/lib/testSecurity.ts`, which was already
 * careful about the parts that matter: every call is wrapped because the
 * Keyboard Lock API is Chromium-only and `requestFullscreen` throws without a
 * fresh user gesture. Added here: `proctorCapabilities()`, so a session can
 * record what the browser was actually able to enforce.
 */

type KeyboardLockCapableNavigator = Navigator & {
  keyboard?: {
    lock?: (keys?: string[]) => Promise<void>;
    unlock?: () => void;
  };
};

function keyboardNavigator(): KeyboardLockCapableNavigator | null {
  if (typeof navigator === 'undefined') return null;
  return navigator as KeyboardLockCapableNavigator;
}

const LOCKED_KEYS = [
  'Escape',
  'MetaLeft', 'MetaRight',
  'AltLeft', 'AltRight',
  'F1', 'F2', 'F3', 'F4', 'F6',
  'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
];

export async function lockKeys(): Promise<void> {
  if (typeof document === 'undefined' || !document.fullscreenElement) return;
  try {
    await keyboardNavigator()?.keyboard?.lock?.(LOCKED_KEYS);
  } catch {
    // Unsupported browser. The fullscreenchange guard is the fallback.
  }
}

export function unlockKeys(): void {
  try {
    keyboardNavigator()?.keyboard?.unlock?.();
  } catch {
    // Unsupported browser.
  }
}

export async function enterFullscreen(
  element: HTMLElement = document.documentElement,
): Promise<boolean> {
  try {
    if (!document.fullscreenElement) {
      await element.requestFullscreen();
    }
    await lockKeys();
    return true;
  } catch {
    return false;
  }
}

/**
 * Re-entry after an exit. Distinct from `enterFullscreen` because it is called
 * from a warning scrim where the gesture may already be stale — a failure here
 * is expected and must not read as "entered".
 */
export async function reenterFullscreen(
  element: HTMLElement = document.documentElement,
): Promise<boolean> {
  try {
    if (!document.fullscreenElement) {
      await element.requestFullscreen();
    }
  } catch {
    return false;
  }
  await lockKeys();
  return Boolean(document.fullscreenElement);
}

export async function exitFullscreen(): Promise<void> {
  unlockKeys();
  if (typeof document === 'undefined' || !document.fullscreenElement) return;
  try {
    await document.exitFullscreen();
  } catch {
    // The browser may have left fullscreen on its own already.
  }
}

export function isFullscreen(): boolean {
  return typeof document !== 'undefined' && Boolean(document.fullscreenElement);
}

export interface ProctorCapabilities {
  fullscreen: boolean;
  keyboardLock: boolean;
  visibility: boolean;
  sendBeacon: boolean;
}

/**
 * What this browser can actually enforce, recorded once per session.
 *
 * A session with zero violations from a browser with no Fullscreen API (iOS
 * Safari) means "nothing was watching", not "they behaved" — the console needs
 * to be able to tell those apart before anyone acts on a clean record.
 */
export function proctorCapabilities(): ProctorCapabilities {
  if (typeof document === 'undefined') {
    return { fullscreen: false, keyboardLock: false, visibility: false, sendBeacon: false };
  }
  return {
    fullscreen: typeof document.documentElement.requestFullscreen === 'function',
    keyboardLock: typeof keyboardNavigator()?.keyboard?.lock === 'function',
    visibility: typeof document.hidden === 'boolean',
    sendBeacon: typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function',
  };
}
