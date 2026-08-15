import { describe, expect, it } from 'vitest';
import { EVENT_SEVERITY, isFlagged, proctorRules } from '@/lib/proctor/config';
import { eventBatchSchema, openSessionSchema } from '@/lib/proctor/service';

describe('proctor rules', () => {
  it('never auto-submits, on any round', () => {
    // Section locking is irreversible here and there is no redo-round escape
    // hatch, so a false positive would destroy a team's work with no way back.
    // Crossing a budget must raise a flag for a human instead.
    for (const roundId of [1, 2, 3, 4, 5]) {
      expect(proctorRules(roundId).autoSubmitOnExhaustion, `round ${roundId}`).toBe(false);
    }
  });

  it('runs Round 4 loose, since the portal repair is a step and not an assessment', () => {
    const round4 = proctorRules(4);
    expect(round4.enforceFullscreen).toBe(false);
    expect(round4.blockClipboard).toBe(false);
    expect(round4.warningBudget).toBeGreaterThan(proctorRules(1).warningBudget);
  });

  it('flags at the budget, not one past it', () => {
    const rules = proctorRules(1);
    expect(isFlagged({ warning_count: rules.warningBudget - 1, key_violation_count: 0 }, rules)).toBe(false);
    expect(isFlagged({ warning_count: rules.warningBudget, key_violation_count: 0 }, rules)).toBe(true);
    expect(isFlagged({ warning_count: 0, key_violation_count: rules.keyViolationBudget }, rules)).toBe(true);
  });

  it('treats restores and heartbeats as context, never as violations', () => {
    for (const kind of ['fullscreen_restored', 'tab_visible', 'heartbeat', 'session_start', 'session_end'] as const) {
      expect(EVENT_SEVERITY[kind], kind).toBe('info');
    }
    expect(EVENT_SEVERITY.tab_hidden).toBe('warning');
    expect(EVENT_SEVERITY.fullscreen_exit).toBe('warning');
    expect(EVENT_SEVERITY.paste).toBe('key_violation');
  });
});

describe('ingest payload contract', () => {
  /**
   * The reference implementation read `warnings` and `keyViolations` straight
   * from the submit body and wrote them to the participant, so anyone with the
   * network tab open could file zeroes. Neither schema here has a field for a
   * count, a team or a timestamp — the server owns all three.
   */
  it('gives the client no way to state a count, a team, or a time', () => {
    const forged = {
      round_id: 1,
      device_id: 'device-1234567890',
      team_id: 'someone-elses-team',
      warning_count: 0,
      key_violation_count: 0,
    };
    const parsed = openSessionSchema.parse(forged);

    expect(parsed).not.toHaveProperty('team_id');
    expect(parsed).not.toHaveProperty('warning_count');
    expect(parsed).not.toHaveProperty('key_violation_count');
    expect(Object.keys(parsed).sort()).toEqual(['device_id', 'round_id']);
  });

  it('drops a client-supplied severity from an event', () => {
    const parsed = eventBatchSchema.parse({
      session_id: '00000000-0000-4000-8000-000000000001',
      events: [{ kind: 'paste', severity: 'info', occurred_at: '1999-01-01T00:00:00Z' }],
    });

    expect(parsed.events[0]).not.toHaveProperty('severity');
    expect(parsed.events[0]).not.toHaveProperty('occurred_at');
    // Severity is looked up from the kind, server-side.
    expect(EVENT_SEVERITY[parsed.events[0].kind]).toBe('key_violation');
  });

  it('rejects an event kind that is not in the catalog', () => {
    const result = eventBatchSchema.safeParse({
      session_id: '00000000-0000-4000-8000-000000000001',
      events: [{ kind: 'definitely_fine' }],
    });
    expect(result.success).toBe(false);
  });

  it('bounds the batch size so one request cannot flood the table', () => {
    const result = eventBatchSchema.safeParse({
      session_id: '00000000-0000-4000-8000-000000000001',
      events: Array.from({ length: 500 }, () => ({ kind: 'heartbeat' as const })),
    });
    expect(result.success).toBe(false);
  });
});
