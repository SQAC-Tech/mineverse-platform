import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isFlagged, proctorRules } from '@/lib/proctor/config';

/**
 * A flag has to be undoable, in both places it lands.
 *
 * Crossing a proctor budget now does two things: it marks the session `flagged`,
 * and it sets `is_locked` on the team's `team_round_access` row for that round —
 * which `verifyDev4RoundAccess` refuses on, so the team cannot open the round at
 * all. `clearProctorFlag` originally undid only the first. The console reported
 * the flag cleared, the team was still barred, and the only remaining way back
 * was re-toggling the round, which restarts its clock for every team in the hall.
 *
 * Source assertions rather than a database round trip: the two writes live in
 * different functions in the same file and the failure was that one moved
 * without the other, which is precisely what reading the source catches.
 */

const root = join(__dirname, '..', '..', '..');
const service = readFileSync(join(root, 'lib', 'proctor', 'service.ts'), 'utf8');

const bodyOf = (name: string) => {
  const start = service.indexOf(`export async function ${name}`);
  expect(start, `${name} not found`).toBeGreaterThan(-1);
  // Far enough to cover the function; these are short.
  return service.slice(start, start + 2200);
};

describe('recovering from a proctor flag', () => {
  it('locks the team out of the round when a budget runs out', () => {
    const recount = service.slice(service.indexOf('async function recountSession'));
    expect(recount).toMatch(/is_locked:\s*true/);
    expect(recount).toMatch(/team_round_access/);
  });

  it('gives the round back when an organizer clears the flag', () => {
    // The half that was missing. Without it "clear flag" is cosmetic.
    const clear = bodyOf('clearProctorFlag');
    expect(clear).toMatch(/team_round_access/);
    expect(clear).toMatch(/is_locked:\s*false/);
  });

  it('unlocks only the round the flag was raised in', () => {
    // Clearing a Round 2 flag must not open Round 3 before it starts.
    const clear = bodyOf('clearProctorFlag');
    expect(clear).toMatch(/\.eq\('round_id',\s*session\.round_id\)/);
    expect(clear).toMatch(/\.eq\('team_id',\s*session\.team_id\)/);
  });

  it('does not seal the team’s work — that stays a human decision', () => {
    // `autoSubmitOnExhaustion` is off everywhere because locking a section is
    // irreversible. Being flagged must stay recoverable; if this ever flips,
    // the recovery above stops being enough.
    for (const roundId of [0, 1, 2, 3, 4, 5]) {
      expect(proctorRules(roundId).autoSubmitOnExhaustion, `round ${roundId}`).toBe(false);
    }
  });
});

describe('how much room a team actually gets', () => {
  it('flags only once a budget is fully spent', () => {
    for (const roundId of [0, 1, 2, 3, 5]) {
      const rules = proctorRules(roundId);
      const justUnder = { warning_count: rules.warningBudget - 1, key_violation_count: rules.keyViolationBudget - 1 };
      expect(isFlagged(justUnder, rules), `round ${roundId} just under`).toBe(false);
      expect(isFlagged({ ...justUnder, warning_count: rules.warningBudget }, rules)).toBe(true);
    }
  });

  it('keeps the screening budget the tightest on the platform', () => {
    // Unsupervised, 30 minutes, and it decides who gets in at all.
    expect(proctorRules(0).warningBudget).toBeLessThan(proctorRules(1).warningBudget);
  });
});

/**
 * The boss toggle, enforced where it counts.
 *
 * `rounds.guardian_unlocked` defaults to false and the Rounds screen offers
 * "Unlock Boss" against it, but the only thing reading it was the round shell,
 * which hides the button. `POST /api/team/guardian/start` takes a guardian name
 * and a round id and nothing else, so a hidden button was not a closed door.
 */
describe('the guardian lock', () => {
  const guardians = readFileSync(join(root, 'lib', 'gameplay', 'guardians', 'service.ts'), 'utf8');
  const start = guardians.slice(guardians.indexOf('export async function startGuardianBattle'));

  it('is checked on the server before a battle starts', () => {
    expect(start).toMatch(/guardian_unlocked/);
    expect(start).toMatch(/BOSS_LOCKED/);
  });

  it('is checked on start and not on resolve', () => {
    // Locking the boss mid-fight must not strand a team with its answers typed.
    const resolve = guardians.slice(guardians.indexOf('export async function resolveGuardianBattle'));
    expect(resolve).not.toMatch(/guardian_unlocked/);
  });
});
