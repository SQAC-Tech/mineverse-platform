/**
 * The outbound event queue.
 *
 * Split out of the hook so it can be tested without a DOM: the batching and the
 * "deliver on the way out" behaviour are the parts most likely to silently stop
 * working, and they are the reason abandoning a tab no longer erases the record.
 */

import { MAX_EVENTS_PER_BATCH, type ProctorEventKind } from './config';

export interface QueuedEvent {
  kind: ProctorEventKind;
  detail?: Record<string, string | number | boolean>;
}

export interface FlushResult {
  warning_count: number;
  key_violation_count: number;
  status: string;
}

export interface QueueTransport {
  /** Normal delivery. Resolves with the server's authoritative counters. */
  send: (sessionId: string, events: QueuedEvent[]) => Promise<FlushResult | null>;
  /**
   * Last-gasp delivery from a `pagehide` handler, where no async work is
   * guaranteed to finish. Returns whether the browser accepted the payload.
   */
  beacon: (sessionId: string, events: QueuedEvent[]) => boolean;
}

export class ProctorQueue {
  private pending: QueuedEvent[] = [];
  private inFlight = false;

  constructor(
    private readonly transport: QueueTransport,
    private sessionId: string | null = null,
  ) {}

  setSessionId(sessionId: string | null) {
    this.sessionId = sessionId;
  }

  get size() {
    return this.pending.length;
  }

  push(event: QueuedEvent) {
    // A wedged network must not grow this without bound. Dropping the oldest
    // keeps the most recent — and most relevant — events for the log.
    if (this.pending.length >= MAX_EVENTS_PER_BATCH * 4) {
      this.pending.splice(0, this.pending.length - MAX_EVENTS_PER_BATCH * 4 + 1);
    }
    this.pending.push(event);
  }

  /**
   * Ships one batch. Events are put back on failure so a dropped request delays
   * the record rather than losing it.
   */
  async flush(): Promise<FlushResult | null> {
    if (this.inFlight || !this.sessionId || this.pending.length === 0) return null;

    const batch = this.pending.splice(0, MAX_EVENTS_PER_BATCH);
    this.inFlight = true;
    try {
      return await this.transport.send(this.sessionId, batch);
    } catch {
      this.pending.unshift(...batch);
      return null;
    } finally {
      this.inFlight = false;
    }
  }

  /**
   * Called from `pagehide`. Everything still queued goes out in one beacon,
   * which the browser delivers even as the page is torn down.
   */
  flushWithBeacon(): boolean {
    if (!this.sessionId || this.pending.length === 0) return false;
    const batch = this.pending.splice(0, MAX_EVENTS_PER_BATCH);
    const delivered = this.transport.beacon(this.sessionId, batch);
    if (!delivered) this.pending.unshift(...batch);
    return delivered;
  }
}
