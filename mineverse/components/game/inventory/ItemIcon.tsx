import type { CraftItem } from '@/lib/gameplay/crafting/rules';

/**
 * The craftable items, drawn as Minecraft draws them: a 16x16 pixel grid.
 *
 * The crafting window used emoji for these — ⛏ and 🛡 — which render as
 * whatever the operating system has and look nothing like the item being
 * crafted. Minecraft item art *is* a 16x16 grid, so an SVG of exact 1x1 rects
 * on a 16x16 viewBox is the real thing rather than an impression of it, and it
 * stays sharp at any size because it is vector, not an upscaled bitmap.
 *
 * Each map below is 16 rows of 16 characters. `.` is transparent; every other
 * character indexes that item's palette.
 */

/*
 * A solid head bar with a prong hanging at each end, and a straight handle
 * running down-left from under its centre.
 *
 * Two earlier passes tapered the head toward the handle, which drew a heart
 * rather than a pickaxe — the taper is what does it, so there is none here.
 */
const PICKAXE = [
  '................',
  '..oooooooooooo..',
  '.ohhhhhhhhhhhho.',
  '.ohhhhhhhhhhhho.',
  '.oohhhhhhhhhhoo.',
  '..oo...ss...oo..',
  '..o...sSs....o..',
  '.....sSs........',
  '....sSs.........',
  '...sSs..........',
  '..sSs...........',
  '..sS............',
  '..s.............',
  '................',
  '................',
  '................',
];

const CHESTPLATE = [
  '................',
  '................',
  '..oo........oo..',
  '.oppo......oppo.',
  '.opppoooooopppo.',
  '.oppppppppppppo.',
  '.oppppppppppppo.',
  '.oppppppppppppo.',
  '.oppppppppppppo.',
  '..oppppppppppo..',
  '..oppppppppppo..',
  '..oppppppppppo..',
  '..oppppppppppo..',
  '..oooooooooooo..',
  '................',
  '................',
];

/** Palettes: `o` outline, `h` head, `s`/`S` stick, `p` plate. */
const PALETTES: Record<CraftItem, Record<string, string>> = {
  wooden_pickaxe: { o: '#4b3018', h: '#a9772f', s: '#7a5230', S: '#5e3c22' },
  stone_pickaxe: { o: '#3a3a3a', h: '#a3a3a3', s: '#7a5230', S: '#5e3c22' },
  iron_armor: { o: '#6f6f6f', p: '#d8dade' },
  diamond_pickaxe: { o: '#1d6f68', h: '#4fe3d6', s: '#7a5230', S: '#5e3c22' },
};

const MAPS: Record<CraftItem, string[]> = {
  wooden_pickaxe: PICKAXE,
  stone_pickaxe: PICKAXE,
  iron_armor: CHESTPLATE,
  diamond_pickaxe: PICKAXE,
};

interface ItemIconProps {
  item: CraftItem;
  /** CSS size. The grid is square, so one value does both axes. */
  size?: string;
  className?: string;
}

export function ItemIcon({ item, size = '100%', className }: ItemIconProps) {
  const map = MAPS[item];
  const palette = PALETTES[item];

  /* Runs of the same colour on a row collapse into one rect — a pickaxe is
     ~70 pixels and this halves the node count without changing a pixel. */
  const rects: Array<{ x: number; y: number; w: number; fill: string }> = [];
  map.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const key = row[x];
      if (key === '.' || !palette[key]) {
        x += 1;
        continue;
      }
      let width = 1;
      while (x + width < row.length && row[x + width] === key) width += 1;
      rects.push({ x, y, w: width, fill: palette[key] });
      x += width;
    }
  });

  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={className}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {rects.map((rect) => (
        <rect key={`${rect.x}-${rect.y}`} x={rect.x} y={rect.y} width={rect.w} height={1} fill={rect.fill} />
      ))}
    </svg>
  );
}
