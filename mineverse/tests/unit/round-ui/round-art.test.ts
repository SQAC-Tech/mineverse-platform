import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { roundChrome } from '../../../components/game/custom-round-ui/round-presentation';

/**
 * Regression guard for two silent failures we shipped.
 *
 * `roundChrome(5)` asked for `.round-ui--end` and no stylesheet ever defined it,
 * so Round 5 rendered every palette token undefined — and because proctor-ui.css
 * supplies fallbacks, the gate quietly wore Round 1's forest green instead of
 * looking broken. Round 3 meanwhile carried `guardianArt: null`, so its panels
 * fell back to icons.
 *
 * Neither shows up in a typecheck or a build. Both do here.
 */

const repo = join(__dirname, '..', '..', '..');
const publicDir = join(repo, 'public');

function stylesheets(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : stylesheets(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

const css = [...stylesheets(join(repo, 'components')), ...stylesheets(join(repo, 'app'))]
  .map((path) => readFileSync(path, 'utf8'));

const allCss = css.join('\n');

// Every round the app can route to, plus the screening, which shares the gate.
const ROUND_IDS = [0, 1, 2, 3, 4, 5];

describe('round palettes', () => {
  it.each(ROUND_IDS)('round %i has its themeClass defined in a stylesheet', (roundId) => {
    const { themeClass } = roundChrome(roundId);
    expect(allCss).toContain(`.${themeClass} {`);
  });

  it.each(ROUND_IDS)('round %i palette supplies a background scene', (roundId) => {
    const { themeClass } = roundChrome(roundId);
    const block = allCss.slice(allCss.indexOf(`.${themeClass} {`));
    const palette = block.slice(0, block.indexOf('}'));
    expect(palette).toMatch(/--rd-scene:\s*url\(/);
  });
});

describe('round artwork', () => {
  it.each(ROUND_IDS)('round %i art files exist on disk', (roundId) => {
    const { guardianArt, eventArt } = roundChrome(roundId);
    for (const art of [guardianArt, eventArt]) {
      if (art) expect(existsSync(join(publicDir, art)), `missing ${art}`).toBe(true);
    }
  });

  it('every game round has both a guardian and an event image', () => {
    // Round 4 is off-platform and Round 5 has no guardian in ROUND_CONFIGS, so
    // only the three Day 1 rounds are held to this.
    for (const roundId of [1, 2, 3]) {
      const { guardianArt, eventArt } = roundChrome(roundId);
      expect(guardianArt, `round ${roundId} guardianArt`).toBeTruthy();
      expect(eventArt, `round ${roundId} eventArt`).toBeTruthy();
    }
  });
});

describe('stylesheet asset paths', () => {
  it('every url() in the round stylesheets resolves to a real file', () => {
    const missing: string[] = [];
    for (const sheet of css) {
      for (const match of sheet.matchAll(/url\(['"]?(\/[^'")]+)['"]?\)/g)) {
        if (!existsSync(join(publicDir, match[1]))) missing.push(match[1]);
      }
    }
    expect(missing).toEqual([]);
  });
});
