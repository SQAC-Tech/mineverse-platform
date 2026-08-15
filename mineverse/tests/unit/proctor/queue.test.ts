import { describe, expect, it } from 'vitest';
import { ProctorQueue, type QueueTransport } from '@/lib/proctor/queue';
import { MAX_EVENTS_PER_BATCH } from '@/lib/proctor/config';

function transport(overrides: Partial<QueueTransport> = {}): QueueTransport & {
  sent: Array<{ sessionId: string; count: number }>;
  beaconed: Array<{ sessionId: string; count: number }>;
} {
  const sent: Array<{ sessionId: string; count: number }> = [];
  const beaconed: Array<{ sessionId: string; count: number }> = [];
  return {
    sent,
    beaconed,
    send: async (sessionId, events) => {
      sent.push({ sessionId, count: events.length });
      return { warning_count: 0, key_violation_count: 0, status: 'active' };
    },
    beacon: (sessionId, events) => {
      beaconed.push({ sessionId, count: events.length });
      return true;
    },
    ...overrides,
  };
}

describe('ProctorQueue', () => {
  it('sends nothing until a session id exists', async () => {
    const t = transport();
    const queue = new ProctorQueue(t);
    queue.push({ kind: 'tab_hidden' });

    expect(await queue.flush()).toBeNull();
    expect(t.sent).toHaveLength(0);
    // The event is held, not dropped — it ships once the session opens.
    expect(queue.size).toBe(1);

    queue.setSessionId('session-1');
    await queue.flush();
    expect(t.sent).toEqual([{ sessionId: 'session-1', count: 1 }]);
  });

  it('keeps events when the request fails, so a dropped batch is delayed not lost', async () => {
    const t = transport({ send: async () => { throw new Error('offline'); } });
    const queue = new ProctorQueue(t, 'session-1');
    queue.push({ kind: 'fullscreen_exit' });
    queue.push({ kind: 'blocked_key', detail: { key: 'F12' } });

    expect(await queue.flush()).toBeNull();
    expect(queue.size).toBe(2);
  });

  it('splits an oversized backlog into batches the ingest route will accept', async () => {
    const t = transport();
    const queue = new ProctorQueue(t, 'session-1');
    for (let i = 0; i < MAX_EVENTS_PER_BATCH + 10; i += 1) queue.push({ kind: 'heartbeat' });

    await queue.flush();
    expect(t.sent[0].count).toBe(MAX_EVENTS_PER_BATCH);
    expect(queue.size).toBe(10);
  });

  it('caps the backlog so a wedged network cannot grow it without bound', () => {
    const queue = new ProctorQueue(transport(), 'session-1');
    for (let i = 0; i < MAX_EVENTS_PER_BATCH * 10; i += 1) queue.push({ kind: 'heartbeat' });
    expect(queue.size).toBeLessThanOrEqual(MAX_EVENTS_PER_BATCH * 4);
  });

  /**
   * The gap this whole design exists to close: in the reference implementation
   * the counters lived in a React ref until submit, so closing the tab erased
   * the record entirely.
   */
  it('delivers what is still queued when the page goes away', () => {
    const t = transport();
    const queue = new ProctorQueue(t, 'session-1');
    queue.push({ kind: 'tab_hidden' });
    queue.push({ kind: 'fullscreen_exit' });

    expect(queue.flushWithBeacon()).toBe(true);
    expect(t.beaconed).toEqual([{ sessionId: 'session-1', count: 2 }]);
    expect(queue.size).toBe(0);
  });

  it('puts events back if the browser refuses the beacon', () => {
    const t = transport({ beacon: () => false });
    const queue = new ProctorQueue(t, 'session-1');
    queue.push({ kind: 'tab_hidden' });

    expect(queue.flushWithBeacon()).toBe(false);
    expect(queue.size).toBe(1);
  });

  it('does not send two batches concurrently', async () => {
    // Held in an object so TypeScript does not narrow the binding to `never`
    // from the callback-only assignment below.
    const gate: { release: (() => void) | null } = { release: null };
    const t = transport({
      send: async () => {
        await new Promise<void>((resolve) => { gate.release = resolve; });
        return { warning_count: 0, key_violation_count: 0, status: 'active' };
      },
    });
    const queue = new ProctorQueue(t, 'session-1');
    queue.push({ kind: 'tab_hidden' });
    queue.push({ kind: 'paste' });

    const first = queue.flush();
    // Second call while the first is still open must be a no-op, not a duplicate post.
    expect(await queue.flush()).toBeNull();

    gate.release?.();
    await first;
  });
});
