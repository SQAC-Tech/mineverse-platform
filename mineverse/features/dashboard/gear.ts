/**
 * Which Steve the dashboard shows.
 *
 * `public/steve-progression.webp` is one sheet of five frames, normalised so
 * every figure sits on the same feet line and the same centre — swapping frames
 * never makes him hop. This file decides which frame, and it decides it from
 * state the server already owns: four rows of `crafting_log` and the Day 2
 * portal repair. There is no separate avatar state to drift.
 *
 * The ladder is monotonic. A team that crafts the Diamond Pickaxe does not go
 * back a frame because it never crafted the Stone one.
 *
 * Pure, so it can be tested without a browser; `steve-avatar.tsx` only draws.
 */

export const STEVE_FRAMES = 5;

export interface Loadout {
  /** 0–4, the frame's index in the sheet. */
  frame: number;
  /** The stage's name, shown above the caption. */
  title: string;
  /** What the team actually holds — the honest version, in words. */
  caption: string;
}

export interface LoadoutInput {
  /** `crafting_log`, as `/api/dashboard/data` returns it. */
  crafted: Array<{ item: string; crafted: boolean }> | null | undefined;
  /** Day 2's portal repair. The fourth frame is the nether-forged one. */
  portalRepaired?: boolean;
}

/**
 * Highest stage first. Each entry names the frame it lights up and the condition
 * that earns it, so the search stops at the first one the team has reached.
 */
const LADDER: Array<{ frame: number; title: string; caption: string; earned: (owned: Set<string>, portal: boolean) => boolean }> = [
  {
    frame: 4,
    title: 'DIAMOND AGE',
    caption: 'Diamond Pickaxe',
    earned: (owned) => owned.has('diamond_pickaxe'),
  },
  {
    frame: 3,
    title: 'NETHER-FORGED',
    caption: 'Iron Armor · Portal repaired',
    earned: (_owned, portal) => portal,
  },
  {
    frame: 2,
    title: 'IRON AGE',
    caption: 'Stone Pickaxe · Iron Armor',
    earned: (owned) => owned.has('iron_armor'),
  },
  {
    frame: 1,
    title: 'STONE AGE',
    caption: 'Stone Pickaxe',
    earned: (owned) => owned.has('stone_pickaxe'),
  },
  {
    frame: 0,
    title: 'WOODEN AGE',
    caption: 'Wooden Pickaxe',
    earned: (owned) => owned.has('wooden_pickaxe'),
  },
];

/*
 * Before the first craft there is no frame of an empty-handed Steve, so frame 0
 * stands in. The caption is the part that must not overstate what the team has,
 * and it says so.
 */
const UNEQUIPPED: Loadout = { frame: 0, title: 'UNEQUIPPED', caption: 'No gear crafted yet' };

export function loadoutFrom({ crafted, portalRepaired = false }: LoadoutInput): Loadout {
  const owned = new Set((crafted ?? []).filter((entry) => entry.crafted).map((entry) => entry.item));

  const step = LADDER.find((entry) => entry.earned(owned, portalRepaired));
  if (!step) return UNEQUIPPED;

  return { frame: step.frame, title: step.title, caption: step.caption };
}
