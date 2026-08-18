import { describe, expect, it } from 'vitest';
import {
  portalBlocks,
  isOpening,
  courseFor,
  stageFor,
  isCourseLit,
  PORTAL_ROWS,
  PORTAL_COLUMNS,
  type PortalRequirements,
} from '../../../components/day2/portal/portal-layout';

/**
 * The frame is the status display, not decoration: the base is the Nether Core,
 * the pillars are the Portal Fragment, the lintel is the Diamonds. If the
 * arithmetic drifts, the portal draws the wrong shape or lights the wrong course
 * and quietly tells a team it is short of something it already has.
 */

const NONE: PortalRequirements = { hasCore: false, hasFragment: false, hasDiamonds: false };
const ALL: PortalRequirements = { hasCore: true, hasFragment: true, hasDiamonds: true };

describe('portal shape', () => {
  it('is a 4x5 frame around a 2x3 opening — 14 blocks', () => {
    expect(portalBlocks()).toHaveLength(PORTAL_ROWS * PORTAL_COLUMNS - 6);
    expect(portalBlocks()).toHaveLength(14);
  });

  it('never places a block in the opening', () => {
    for (const { row, column } of portalBlocks()) {
      expect(isOpening(row, column)).toBe(false);
    }
  });

  it('opens through the middle two columns of the middle three rows', () => {
    expect(isOpening(3, 2)).toBe(true);
    expect(isOpening(3, 3)).toBe(true);
    // The perimeter stays solid.
    expect(isOpening(1, 2)).toBe(false);
    expect(isOpening(5, 3)).toBe(false);
    expect(isOpening(3, 1)).toBe(false);
    expect(isOpening(3, 4)).toBe(false);
  });

  it('has no duplicate cells', () => {
    const cells = portalBlocks().map((b) => `${b.row}:${b.column}`);
    expect(new Set(cells).size).toBe(cells.length);
  });

  it('splits into a 4-block base, 6-block pillars and a 4-block lintel', () => {
    const blocks = portalBlocks();
    const count = (course: string) => blocks.filter((b) => b.course === course).length;
    expect(count('base')).toBe(4);
    expect(count('pillar')).toBe(6);
    expect(count('lintel')).toBe(4);
  });

  it('puts the base on the bottom row and the lintel on the top', () => {
    expect(courseFor(PORTAL_ROWS)).toBe('base');
    expect(courseFor(1)).toBe('lintel');
    expect(courseFor(3)).toBe('pillar');
  });
});

describe('stageFor', () => {
  it('is collecting until every requirement is met', () => {
    expect(stageFor(NONE, { isRepaired: false, isIgniting: false })).toBe('collecting');
    expect(stageFor({ ...ALL, hasDiamonds: false }, { isRepaired: false, isIgniting: false })).toBe('collecting');
  });

  it('is ready once all three are held', () => {
    expect(stageFor(ALL, { isRepaired: false, isIgniting: false })).toBe('ready');
  });

  it('is repaired when the server says so', () => {
    expect(stageFor(ALL, { isRepaired: true, isIgniting: false })).toBe('repaired');
  });

  it('lets the ignition play over any other state', () => {
    expect(stageFor(ALL, { isRepaired: true, isIgniting: true })).toBe('igniting');
    expect(stageFor(NONE, { isRepaired: false, isIgniting: true })).toBe('igniting');
  });
});

describe('isCourseLit', () => {
  it('lights each course from its own requirement', () => {
    const coreOnly: PortalRequirements = { hasCore: true, hasFragment: false, hasDiamonds: false };
    expect(isCourseLit('base', coreOnly, 'collecting')).toBe(true);
    expect(isCourseLit('pillar', coreOnly, 'collecting')).toBe(false);
    expect(isCourseLit('lintel', coreOnly, 'collecting')).toBe(false);
  });

  it('shows a missing lintel when diamonds are short', () => {
    const noDiamonds: PortalRequirements = { hasCore: true, hasFragment: true, hasDiamonds: false };
    expect(isCourseLit('base', noDiamonds, 'collecting')).toBe(true);
    expect(isCourseLit('pillar', noDiamonds, 'collecting')).toBe(true);
    expect(isCourseLit('lintel', noDiamonds, 'collecting')).toBe(false);
  });

  it('shows the whole frame once it is lit, whatever the inventory now says', () => {
    // Resources get spent elsewhere; a repaired portal does not un-build itself.
    for (const course of ['base', 'pillar', 'lintel'] as const) {
      expect(isCourseLit(course, NONE, 'repaired')).toBe(true);
      expect(isCourseLit(course, NONE, 'igniting')).toBe(true);
    }
  });
});
