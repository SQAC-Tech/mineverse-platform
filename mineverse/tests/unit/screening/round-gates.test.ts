import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { roundDay, DAY_TWO_ROUNDS } from '@/lib/attendance/gates';

/**
 * Attendance is what opens a round, and there are two independent paths to the
 * rounds: `verifyTeamRoundAccess` (guardians, choices) and `dev4RoundAccess`
 * (the question routes). A gate enforced on only one of two doors is not a
 * gate, so both are asserted here rather than trusted.
 */
function code(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('the round gates', () => {
  it('checks attendance on both paths into a round', () => {
    expect(code('lib/gameplay/utils/access.ts')).toContain('attendanceGate(teamId, roundId)');
    expect(code('lib/gameplay/questions/access.ts')).toContain('attendanceGate(teamId, roundId)');
  });

  it('puts rounds 4 and 5 on day 2 and everything else on day 1', () => {
    expect(DAY_TWO_ROUNDS).toEqual([4, 5]);
    expect([1, 2, 3].map(roundDay)).toEqual([1, 1, 1]);
    expect([4, 5].map(roundDay)).toEqual([2, 2]);
  });
});
