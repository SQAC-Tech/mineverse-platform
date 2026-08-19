'use client';

import {
  portalBlocks,
  isCourseLit,
  type PortalStage,
  type PortalRequirements,
} from '@/components/day2/portal/portal-layout';
import './portal-repair.css';

export type { PortalStage };

interface PortalFrameProps {
  /** Nether Core present — lays the base course. */
  hasCore: boolean;
  /** Portal Fragment present — raises the two pillars. */
  hasFragment: boolean;
  /** Enough Diamonds — caps the lintel. */
  hasDiamonds: boolean;
  stage: PortalStage;
}

/**
 * A 4x5 obsidian frame with a 2x3 opening, built the way a portal is built.
 *
 * Each requirement owns a course of blocks, so the shape itself says what is
 * missing: no base means no core, no pillars means no fragment, no lintel means
 * not enough diamonds. The written requirements below it say the same thing —
 * this is the version you can read at a glance from across a room.
 */

const BLOCKS = portalBlocks();

const MOTES = [
  { left: '18%', delay: '0s', drift: '-14px' },
  { left: '34%', delay: '0.9s', drift: '10px' },
  { left: '50%', delay: '1.8s', drift: '-6px' },
  { left: '66%', delay: '0.4s', drift: '16px' },
  { left: '80%', delay: '2.5s', drift: '-11px' },
];

const CAPTIONS: Record<PortalStage, string> = {
  collecting: 'Portal incomplete',
  ready: 'Frame complete — ready to ignite',
  igniting: 'Igniting…',
  repaired: 'Portal open',
};

export function PortalFrame({ hasCore, hasFragment, hasDiamonds, stage }: PortalFrameProps) {
  const requirements: PortalRequirements = { hasCore, hasFragment, hasDiamonds };

  return (
    <>
      <div className="pr-portal" data-state={stage} role="img" aria-label={CAPTIONS[stage]}>
        {BLOCKS.map(({ row, column, course }, index) => (
          <div
            key={`${row}-${column}`}
            className="pr-block"
            data-lit={String(isCourseLit(course, requirements, stage))}
            style={{ gridRow: row, gridColumn: column, ['--pr-index' as string]: index }}
          />
        ))}

        <div className="pr-gate">
          <div className="pr-motes" aria-hidden="true">
            {MOTES.map((mote) => (
              <span
                key={mote.left}
                className="pr-mote"
                style={{ left: mote.left, ['--pr-delay' as string]: mote.delay, ['--pr-drift' as string]: mote.drift }}
              />
            ))}
          </div>
        </div>

        <div className="pr-flash" aria-hidden="true" />
      </div>

      <p className="pr-caption">{CAPTIONS[stage]}</p>
    </>
  );
}
