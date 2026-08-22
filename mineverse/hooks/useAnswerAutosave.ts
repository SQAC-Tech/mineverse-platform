'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Gets what a team has typed onto the server without waiting for them to press
 * Save.
 *
 * The round shells persisted an answer only when the team clicked Save. Anything
 * typed and not saved lived in `localStorage` and nowhere else, so a laptop that
 * died, a browser that crashed, a team that ran the clock down while polishing
 * question 9, or a machine handed to the next team all ended the same way: the
 * work existed, and the platform had never seen it. `ends_at` makes that final —
 * the submission endpoints refuse a closed round, so there is no recovering it
 * afterwards, by the team or by an organiser.
 *
 * Deliberately not debounced per keystroke. A team writing a C++ solution would
 * generate a request per pause, and the point is not to capture every character
 * — it is that nothing typed more than half a minute ago can be lost. So it
 * flushes on a timer, when the team moves to another question, and when the tab
 * is hidden or closed.
 *
 * `flush` is safe to call whenever: an answer whose text has not changed since
 * it was last accepted is skipped, so nothing re-posts and revision numbers do
 * not climb on their own.
 */

export interface AutosaveBody {
  question_id: string;
  answer_text?: string;
  code?: string;
  language?: string | null;
}

export interface UseAnswerAutosave {
  /** Answers typed but not yet accepted by the server. */
  pending: number;
  /** Sends everything outstanding. Resolves when the last request settles. */
  flush: () => Promise<void>;
  /**
   * Records text the caller has already persisted by another route, so the
   * manual Save button and the autosave do not each post the same answer.
   */
  markSynced: (questionId: string, text: string) => void;
}

const FLUSH_INTERVAL_MS = 25_000;

/**
 * Drafts that differ from what the server last accepted.
 *
 * Pure, and takes both maps as arguments, so the render path can call it
 * without reaching into a ref.
 */
export function outstandingIn(
  drafts: Record<string, string>,
  synced: Record<string, string>,
): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [questionId, value] of Object.entries(drafts)) {
    const text = value?.trim() ?? '';
    if (!text || synced[questionId] === text) continue;
    out.push([questionId, text]);
  }
  return out;
}

export function useAnswerAutosave({
  drafts,
  resolve,
  enabled,
}: {
  /** Question id to the text currently in the editor. */
  drafts: Record<string, string>;
  /**
   * Turns a question id into the request body, or null when that answer must not
   * be sent — a question already locked or graded, or one this round does not
   * accept writes for.
   */
  resolve: (questionId: string, text: string) => AutosaveBody | null;
  enabled: boolean;
}): UseAnswerAutosave {
  /**
   * What the server has accepted, in two copies.
   *
   * The ref is authoritative and is only ever written from a callback, so a
   * flush always sees its own most recent result even when two land in the same
   * tick. The state is the render mirror — the outstanding count is derived from
   * it, and a ref cannot trigger the render that would show a new count.
   */
  const syncedRef = useRef<Record<string, string>>({});
  const [syncedView, setSyncedView] = useState<Record<string, string>>({});
  const inFlight = useRef(false);

  // The timer and the unload listeners outlive any one render, so they read the
  // latest values through refs rather than closing over the render that
  // installed them. Synced in an effect rather than assigned during render —
  // a write during render is the side effect this hook exists to avoid.
  const draftsRef = useRef(drafts);
  const resolveRef = useRef(resolve);
  const enabledRef = useRef(enabled);

  useEffect(() => { draftsRef.current = drafts; }, [drafts]);
  useEffect(() => { resolveRef.current = resolve; }, [resolve]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const pending = useMemo(
    () => (enabled ? outstandingIn(drafts, syncedView).length : 0),
    [drafts, enabled, syncedView],
  );

  const commit = useCallback(() => {
    setSyncedView({ ...syncedRef.current });
  }, []);

  const flush = useCallback(async () => {
    if (!enabledRef.current || inFlight.current) return;
    const queue = outstandingIn(draftsRef.current, syncedRef.current);
    if (queue.length === 0) return;

    inFlight.current = true;
    try {
      for (const [questionId, text] of queue) {
        const body = resolveRef.current(questionId, text);
        if (!body) {
          // Not sendable — a locked question, say. Marked so it is not retried
          // every 25 seconds for the rest of the round.
          syncedRef.current[questionId] = text;
          continue;
        }
        try {
          const response = await fetch('/api/submissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const json = await response.json();
          // Only a confirmed write counts. A failure leaves the draft
          // outstanding so the next flush tries it again.
          if (json?.success) syncedRef.current[questionId] = text;
        } catch {
          // Offline, most likely. The draft is still on the device and the next
          // flush will carry it. Silent on purpose: this runs unprompted, and a
          // toast for something the team did not ask for reads as a fault.
        }
      }
    } finally {
      inFlight.current = false;
      commit();
    }
  }, [commit]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => void flush(), FLUSH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, flush]);

  useEffect(() => {
    if (!enabled) return;

    // `visibilitychange` rather than `blur`: alt-tabbing away is the common way
    // a round ends badly, and it is the last event guaranteed to fire on mobile
    // before the page is frozen.
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    const onLeave = () => void flush();
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (outstandingIn(draftsRef.current, syncedRef.current).length === 0) return;
      // The browser shows its own wording; a non-empty returnValue is what asks
      // for the prompt at all.
      event.preventDefault();
      event.returnValue = '';
    };

    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', onLeave);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onLeave);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [enabled, flush]);

  const markSynced = useCallback((questionId: string, text: string) => {
    syncedRef.current[questionId] = text.trim();
    commit();
  }, [commit]);

  return { pending, flush, markSynced };
}
