import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Leaving the screening has to end the proctor, whichever way you leave.
 *
 * The paper used to call `proctor.finish()` — the thing that closes the session,
 * releases the keyboard lock and drops out of fullscreen — separately inside
 * each of the five callbacks that could end the test. Two of them forgot: the
 * outro video's `onError`, and the return-home button. A team taking either path
 * was redirected to `/` while still locked in fullscreen with a live session.
 *
 * On the evening of 22 Aug, four of the first fourteen teams to submit finished
 * that way: their attempt was recorded, but `proctor_sessions.ended_at` stayed
 * null and the heartbeat carried on for up to eight minutes afterwards.
 */

const PAPER = readFileSync(join(process.cwd(), 'components/screening/ScreeningPaper.tsx'), 'utf8');
const body = PAPER.slice(PAPER.indexOf('export function ScreeningPaper'));

/**
 * Comments stripped — counting call sites over the raw source counts the prose
 * too, since the comment above the teardown names `proctor.finish()`.
 */
const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the screening exit', () => {
  it('tears the proctor down in exactly one place', () => {
    expect(code.match(/proctor\??\.finish\(/g) ?? []).toHaveLength(1);
  });

  it('routes every outro path through it, onError included', () => {
    // A missing or corrupt After_screening.mp4 is exactly when a team most
    // needs to be let out of fullscreen cleanly.
    expect(code).toContain('onEnded={() => completeTest()}');
    expect(code).toContain('onError={() => completeTest()}');
  });

  it('gives the team a way to end the round themselves', () => {
    // Without this the only exits were solving all three puzzles, running the
    // clock to zero, or being disqualified.
    expect(code).toContain('onEndTest={() => setConfirmEnd(true)}');
  });
});
