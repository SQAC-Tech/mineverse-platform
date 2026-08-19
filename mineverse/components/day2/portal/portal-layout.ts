/**
 * The shape of a Nether portal frame, and which requirement builds each part.
 *
 * A portal is 4 wide and 5 tall with a 2x3 opening. Splitting the frame by
 * course lets the drawing carry the status: the base is the Nether Core, the
 * pillars are the Portal Fragment, the lintel is the Diamonds. A team that is
 * short of diamonds sees a portal with no top on it.
 *
 * Kept free of React and CSS so the arithmetic can be tested on its own — an
 * off-by-one here silently draws a portal that is the wrong shape.
 */

export const PORTAL_COLUMNS = 4;
export const PORTAL_ROWS = 5;

export type PortalCourse = 'base' | 'pillar' | 'lintel';

export interface PortalBlock {
  /** 1-indexed, to match CSS grid lines. */
  row: number;
  column: number;
  course: PortalCourse;
}

/** True for the six cells the portal opens through, which carry no block. */
export function isOpening(row: number, column: number): boolean {
  return row >= 2 && row <= PORTAL_ROWS - 1 && column >= 2 && column <= PORTAL_COLUMNS - 1;
}

export function courseFor(row: number): PortalCourse {
  if (row === PORTAL_ROWS) return 'base';
  if (row === 1) return 'lintel';
  return 'pillar';
}

/** Row-major, so the assembly stagger reads top-left to bottom-right. */
export function portalBlocks(): PortalBlock[] {
  const blocks: PortalBlock[] = [];
  for (let row = 1; row <= PORTAL_ROWS; row++) {
    for (let column = 1; column <= PORTAL_COLUMNS; column++) {
      if (isOpening(row, column)) continue;
      blocks.push({ row, column, course: courseFor(row) });
    }
  }
  return blocks;
}

export type PortalStage = 'collecting' | 'ready' | 'igniting' | 'repaired';

export interface PortalRequirements {
  hasCore: boolean;
  hasFragment: boolean;
  hasDiamonds: boolean;
}

export function stageFor(
  requirements: PortalRequirements,
  { isRepaired, isIgniting }: { isRepaired: boolean; isIgniting: boolean },
): PortalStage {
  if (isIgniting) return 'igniting';
  if (isRepaired) return 'repaired';
  const ready = requirements.hasCore && requirements.hasFragment && requirements.hasDiamonds;
  return ready ? 'ready' : 'collecting';
}

/** Whether a given course is built, given what the team holds. */
export function isCourseLit(course: PortalCourse, requirements: PortalRequirements, stage: PortalStage): boolean {
  // Once it is lit or lighting, the whole frame is there by definition.
  if (stage === 'igniting' || stage === 'repaired') return true;
  if (course === 'base') return requirements.hasCore;
  if (course === 'pillar') return requirements.hasFragment;
  return requirements.hasDiamonds;
}
