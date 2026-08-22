import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The dashboard shows the same inventory as the rounds — not one that looks
 * like it.
 *
 * Both round shells used to draw the nine slots inline, and the slot styling
 * lived in round-ui.css where only a page carrying `.round-ui` could reach it.
 * Putting the bar on the dashboard would have made a third copy of markup and a
 * second copy of the CSS. These tests hold it at one of each.
 */

const root = join(__dirname, '..', '..', '..');
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');

const CONSUMERS = [
  ['components', 'game', 'custom-round-ui', 'CustomRoundShell.tsx'],
  ['components', 'game', 'custom-round-ui', 'CaveRoundShell.tsx'],
  ['features', 'dashboard', 'dashboard-shell.tsx'],
];

describe('inventory hotbar', () => {
  it('is rendered from the shared component everywhere it appears', () => {
    for (const parts of CONSUMERS) {
      const source = read(...parts);
      expect(source, parts.join('/')).toMatch(/import \{ Hotbar \} from '@\/components\/game\/inventory\/Hotbar'/);
      expect(source, parts.join('/')).toMatch(/<Hotbar\b/);
    }
  });

  it('is not hand-drawn anywhere', () => {
    for (const parts of CONSUMERS) {
      const source = read(...parts);
      // The old inline markup: nine buttons built from a length-9 array.
      expect(source, parts.join('/')).not.toMatch(/Array\.from\(\{ length: 9 \}\)/);
      expect(source, parts.join('/')).not.toMatch(/round-ui__hotbar|round-ui__slot/);
    }
  });

  it('has exactly one stylesheet defining a slot', () => {
    const hotbar = read('components', 'game', 'inventory', 'hotbar.css');
    expect(hotbar).toMatch(/\.mv-slot\s*\{/);

    // round-ui.css and dashboard.css must not redefine it.
    for (const parts of [
      ['components', 'game', 'custom-round-ui', 'round-ui.css'],
      ['features', 'dashboard', 'dashboard.css'],
    ]) {
      const css = read(...parts);
      expect(css, parts.join('/')).not.toMatch(/\.round-ui__slot\s*[{,]/);
      expect(css, parts.join('/')).not.toMatch(/\.mv-slot\s*[{,]/);
      expect(css, parts.join('/')).not.toMatch(/\.mv-hotbar\s*[{,]/);
    }
  });

  it('keeps the round palette out of the shared stylesheet', () => {
    // The dashboard does not carry `--rd-*`; a token here would resolve to
    // nothing there and the bar would lose its borders.
    const hotbar = read('components', 'game', 'inventory', 'hotbar.css');
    expect(hotbar).not.toMatch(/var\(--rd-/);
  });

  it('draws its slots from the one resource catalog, never a second list', () => {
    // This used to pin `length: 9`. The bar now grows past nine to show crafted
    // items, so the literal is gone — but the thing the test was protecting is
    // not the number, it is that the slots come from RESOURCE_META rather than
    // from a copy of the catalog that can drift away from it.
    const component = read('components', 'game', 'inventory', 'Hotbar.tsx');
    expect(component).toMatch(/RESOURCE_META/);
    expect(component).toMatch(/RESOURCE_META\.length/);
    // Nine is the floor, so a team holding nothing crafted still sees a full bar.
    expect(component).toMatch(/Math\.max\(9,/);
  });
});
