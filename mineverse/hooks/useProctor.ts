'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FLUSH_INTERVAL_MS,
  HEARTBEAT_INTERVAL_MS,
  PROCTOR_ENABLED,
  proctorRules,
  type ProctorEventKind,
  type ProctorRules,
} from '@/lib/proctor/config';
import {
  enterFullscreen,
  exitFullscreen,
  isFullscreen,
  proctorCapabilities,
  reenterFullscreen,
  unlockKeys,
} from '@/lib/proctor/fullscreen';
import { classifyShortcut } from '@/lib/proctor/shortcuts';
import { ProctorQueue, type QueuedEvent } from '@/lib/proctor/queue';

const DEVICE_KEY = 'mineverse:proctor:device';

/**
 * Stable per-browser id.
 *
 * localStorage rather than sessionStorage on purpose: a team's three laptops
 * must stay three distinct devices across reloads and across rounds, otherwise
 * legitimate multi-device play reads as one machine behaving erratically.
 */
function deviceId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ?? `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`).slice(0, 64);
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export interface ProctorWarning {
  message: string;
  kind: ProctorEventKind;
  at: number;
}

export interface UseProctorResult {
  /** The team has passed the gate and monitoring is live. */
  started: boolean;
  /** Waiting on the session open call. */
  starting: boolean;
  /** Enters fullscreen and opens the session. Must be called from a click. */
  start: () => Promise<boolean>;
  /** Ends the session cleanly and leaves fullscreen. */
  finish: () => Promise<void>;
  /** True while the page is out of fullscreen and the round requires it. */
  needsFullscreen: boolean;
  /** Re-request fullscreen from the blocking scrim. */
  restoreFullscreen: () => Promise<void>;
  /** Server-authoritative once a batch has round-tripped. */
  warnings: number;
  keyViolations: number;
  flagged: boolean;
  rules: ProctorRules;
  /** Most recent thing worth telling the participant about. */
  warning: ProctorWarning | null;
  dismissWarning: () => void;
  /** Fullscreen was refused by the browser or the user. */
  startError: string | null;
  enabled: boolean;
}

const MESSAGES: Partial<Record<ProctorEventKind, string>> = {
  tab_hidden: 'You left this page. Stay on the round screen.',
  fullscreen_exit: 'Fullscreen was exited. Return to fullscreen to continue.',
  copy: 'Copying is disabled during a round.',
  paste: 'Pasting is disabled during a round.',
  context_menu: 'Right-click is disabled during a round.',
  blocked_key: 'That shortcut is blocked during a round.',
  reload_attempt: 'Reloading was recorded. Your saved answers are kept.',
};

export function useProctor(roundId: number, options: { enabled?: boolean } = {}): UseProctorResult {
  const enabled = (options.enabled ?? true) && PROCTOR_ENABLED;
  const rules = useMemo(() => proctorRules(roundId), [roundId]);

  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [needsFullscreen, setNeedsFullscreen] = useState(false);
  const [warnings, setWarnings] = useState(0);
  const [keyViolations, setKeyViolations] = useState(0);
  const [flagged, setFlagged] = useState(false);
  const [warning, setWarning] = useState<ProctorWarning | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const leftFullscreenAtRef = useRef<number | null>(null);

  const queue = useRef<ProctorQueue>(
    new ProctorQueue({
      send: async (sessionId, events) => {
        const res = await fetch('/api/proctor/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, events }),
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`ingest ${res.status}`);
        const json = await res.json();
        return json.success ? json.data : null;
      },
      beacon: (sessionId, events) => {
        if (typeof navigator === 'undefined' || !navigator.sendBeacon) return false;
        const blob = new Blob([JSON.stringify({ session_id: sessionId, events })], {
          type: 'application/json',
        });
        return navigator.sendBeacon('/api/proctor/events', blob);
      },
    }),
  );

  /** Queues an event and gives the participant immediate, optimistic feedback. */
  const record = useCallback(
    (kind: ProctorEventKind, detail?: Record<string, string | number | boolean>, severity?: 'warning' | 'key_violation') => {
      if (!startedRef.current) return;
      queue.current.push({ kind, detail } satisfies QueuedEvent);

      // The server owns the real numbers; these move first so the UI reacts
      // within the same frame and get reconciled on the next flush.
      if (severity === 'warning') setWarnings((n) => n + 1);
      if (severity === 'key_violation') setKeyViolations((n) => n + 1);

      const message = MESSAGES[kind];
      if (message) setWarning({ message, kind, at: Date.now() });
    },
    [],
  );

  const start = useCallback(async (): Promise<boolean> => {
    if (!enabled) {
      setStarted(true);
      startedRef.current = true;
      return true;
    }

    setStarting(true);
    setStartError(null);
    try {
      if (rules.enforceFullscreen) {
        const entered = await enterFullscreen();
        if (!entered) {
          setStartError('Fullscreen was blocked. Allow fullscreen for this site, then try again.');
          return false;
        }
      }

      const res = await fetch('/api/proctor/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          round_id: roundId,
          device_id: deviceId(),
          capabilities: proctorCapabilities(),
        }),
        cache: 'no-store',
      });
      const json = await res.json();

      if (!json.success) {
        // Losing the record is worse than losing the enforcement: let the team
        // play rather than locking them out of a round over telemetry.
        console.error('Proctor session failed to open:', json.error);
        setStarted(true);
        startedRef.current = true;
        return true;
      }

      sessionIdRef.current = json.data.session_id;
      queue.current.setSessionId(json.data.session_id);
      // Fullscreen can be dismissed between entering it and the listeners
      // attaching, and no `fullscreenchange` fires for the gap. Checked here,
      // in the click handler, rather than from an effect.
      if (rules.enforceFullscreen) setNeedsFullscreen(!isFullscreen());
      // A reload picks the counters back up rather than restarting from zero.
      setWarnings(json.data.warning_count ?? 0);
      setKeyViolations(json.data.key_violation_count ?? 0);
      setFlagged(json.data.status === 'flagged');
      setStarted(true);
      startedRef.current = true;
      record('session_start', { round: roundId });
      return true;
    } catch (error) {
      console.error('Proctor start error:', error);
      setStarted(true);
      startedRef.current = true;
      return true;
    } finally {
      setStarting(false);
    }
  }, [enabled, roundId, rules.enforceFullscreen, record]);

  const finish = useCallback(async () => {
    startedRef.current = false;
    const sessionId = sessionIdRef.current;
    if (sessionId) {
      queue.current.push({ kind: 'session_end' });
      await queue.current.flush();
      // keepalive so navigating to the dashboard cannot cut this off.
      await fetch(`/api/proctor/session?session_id=${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        keepalive: true,
      }).catch(() => undefined);
    }
    unlockKeys();
    await exitFullscreen();
    setStarted(false);
    setNeedsFullscreen(false);
  }, []);

  const restoreFullscreen = useCallback(async () => {
    const back = await reenterFullscreen();
    if (back) setNeedsFullscreen(false);
  }, []);

  /* ------------------------------------------------------------- listeners */

  useEffect(() => {
    if (!enabled || !started) return;

    const onVisibility = () => {
      if (document.hidden) {
        record('tab_hidden', {}, 'warning');
      } else {
        record('tab_visible');
      }
    };

    const onFullscreenChange = () => {
      if (!rules.enforceFullscreen) return;
      if (isFullscreen()) {
        const away = leftFullscreenAtRef.current;
        leftFullscreenAtRef.current = null;
        setNeedsFullscreen(false);
        // How long they were out is what makes an exit interpretable later.
        record('fullscreen_restored', away ? { away_ms: Date.now() - away } : {});
      } else {
        leftFullscreenAtRef.current = Date.now();
        setNeedsFullscreen(true);
        record('fullscreen_exit', {}, 'warning');
      }
    };

    const onClipboard = (event: Event) => {
      const kind = event.type === 'copy' ? 'copy' : 'paste';
      if (rules.blockClipboard) event.preventDefault();
      record(kind, {}, 'key_violation');
    };

    const onContextMenu = (event: Event) => {
      if (rules.blockClipboard) event.preventDefault();
      record('context_menu', {}, 'key_violation');
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const decision = classifyShortcut(event);
      if (!decision.blocked) return;
      event.preventDefault();
      event.stopPropagation();
      record(
        'blocked_key',
        { key: event.key, reason: decision.reason ?? 'blocked' },
        decision.counts ? 'key_violation' : undefined,
      );
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'printscreen') {
        record('blocked_key', { key: 'printscreen', reason: 'screenshot' }, 'key_violation');
      }
    };

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      record('reload_attempt');
      // Queue the beacon here too: pagehide is not guaranteed to run if the
      // browser kills the tab outright.
      queue.current.flushWithBeacon();
      event.preventDefault();
      event.returnValue = '';
    };

    const onPageHide = () => {
      queue.current.flushWithBeacon();
    };

    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('copy', onClipboard);
    document.addEventListener('paste', onClipboard);
    document.addEventListener('contextmenu', onContextMenu);
    // Capture phase, so a blocked shortcut never reaches the round UI's own
    // keyboard handlers (the hotbar listener in CustomRoundShell, for one).
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('copy', onClipboard);
      document.removeEventListener('paste', onClipboard);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [enabled, started, record, rules.enforceFullscreen, rules.blockClipboard]);

  /* ----------------------------------------------------------------- flush */

  useEffect(() => {
    if (!enabled || !started) return;
    const timer = window.setInterval(async () => {
      const result = await queue.current.flush();
      if (result) {
        // Reconcile the optimistic counts against the server's.
        setWarnings(result.warning_count);
        setKeyViolations(result.key_violation_count);
        setFlagged(result.status === 'flagged');
      }
    }, FLUSH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, started]);

  useEffect(() => {
    if (!enabled || !started) return;
    const timer = window.setInterval(() => record('heartbeat'), HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, started, record]);

  useEffect(() => {
    return () => {
      unlockKeys();
    };
  }, []);

  const dismissWarning = useCallback(() => setWarning(null), []);

  return {
    started,
    starting,
    start,
    finish,
    needsFullscreen,
    restoreFullscreen,
    warnings,
    keyViolations,
    flagged,
    rules,
    warning,
    dismissWarning,
    startError,
    enabled,
  };
}
