import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Demo teams waive the round *scheduling* gates so an organiser can walk the
 * event without flipping `rounds.status`, which is global and would open a round
 * for every real team at once.
 *
 * The list is security-adjacent — a demo team logs in with a fixed OTP — so
 * these pin that it stays opt-in, exact-match, and server-only.
 */

const ORIGINAL = process.env.DEMO_TEAM_CODES;

async function loadWith(value: string | undefined) {
  vi.resetModules();
  if (value === undefined) delete process.env.DEMO_TEAM_CODES;
  else process.env.DEMO_TEAM_CODES = value;
  return import('../../../lib/gameplay/demo-teams');
}

beforeEach(() => vi.resetModules());
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.DEMO_TEAM_CODES;
  else process.env.DEMO_TEAM_CODES = ORIGINAL;
});

describe('DEMO_TEAM_CODES', () => {
  it('defaults to the seeded dev team alone', async () => {
    const { DEMO_TEAM_CODES } = await loadWith(undefined);
    expect(DEMO_TEAM_CODES).toEqual(['MNV-000']);
  });

  it('parses a comma-separated list, trimming and upcasing', async () => {
    const { DEMO_TEAM_CODES } = await loadWith(' mnv-000 , MNV-777 ');
    expect(DEMO_TEAM_CODES).toEqual(['MNV-000', 'MNV-777']);
  });

  it('ignores empty entries from a trailing comma', async () => {
    const { DEMO_TEAM_CODES } = await loadWith('MNV-777,,');
    expect(DEMO_TEAM_CODES).toEqual(['MNV-777']);
  });
});

describe('isDemoTeamCode', () => {
  it('matches case-insensitively', async () => {
    const { isDemoTeamCode } = await loadWith('MNV-777');
    expect(isDemoTeamCode('mnv-777')).toBe(true);
    expect(isDemoTeamCode('MNV-777')).toBe(true);
  });

  it('does not match a real team', async () => {
    const { isDemoTeamCode } = await loadWith('MNV-777');
    expect(isDemoTeamCode('MNV-778')).toBe(false);
  });

  it('never matches on a prefix or substring', async () => {
    const { isDemoTeamCode } = await loadWith('MNV-777');
    expect(isDemoTeamCode('MNV-7770')).toBe(false);
    expect(isDemoTeamCode('MNV-77')).toBe(false);
  });

  it.each([null, undefined, ''])('rejects %p rather than falling through', async (value) => {
    const { isDemoTeamCode } = await loadWith('MNV-777');
    expect(isDemoTeamCode(value)).toBe(false);
  });

  it('matches nothing when the list is explicitly emptied', async () => {
    const { isDemoTeamCode } = await loadWith('');
    expect(isDemoTeamCode('MNV-000')).toBe(false);
    expect(isDemoTeamCode('MNV-777')).toBe(false);
  });

  it('is not exposed to the browser — the var has no NEXT_PUBLIC_ prefix', async () => {
    // A NEXT_PUBLIC_ name would be inlined into the client bundle, which would
    // publish the list of teams that log in with a fixed OTP.
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('../../../lib/gameplay/demo-teams.ts', import.meta.url), 'utf8'),
    );
    expect(source).not.toMatch(/NEXT_PUBLIC_DEMO/);
  });
});
