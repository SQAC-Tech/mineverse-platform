import type { GuardianName } from '@/lib/gameplay/guardians/config';
import type { ChoiceKey } from '@/lib/gameplay/choices/service';
import type { CraftItem } from '@/lib/gameplay/crafting/rules';

/**
 * Single source of truth for what a round looks like and which panels it shows.
 *
 * Everything here is derived from `docs/event details/Mineverse_Full_Event_Details.md`,
 * which the Phase 2 master plan makes authoritative. Adding a round means adding
 * one entry — the shell reads this and nothing else.
 */
export interface RoundConfig {
  id: number;
  name: string;
  biome: 'forest' | 'cave' | 'mountain' | 'nether' | 'end';
  tagline: string;
  /** Progression item craftable in this round, if any. */
  craft: CraftItem | null;
  /** Guardian available in this round; `mandatory` gates PvP eligibility. */
  guardian: { name: GuardianName; mandatory: boolean } | null;
  /**
   * Choice event that resolves in this round.
   *
   * `end_merchant` is named separately because it is not in the Day 1 `CHOICES`
   * catalog — it has its own Day 2 route (`/api/team/choices/end-merchant`) and
   * the shared `ChoicePanel` cannot serve it. Round 5's panel is unwired today;
   * see the Phase 3 notes.
   */
  choice: ChoiceKey | 'end_merchant' | null;
  marketplace: boolean;
  pvp: boolean;
  /** Shown in the round header so teams know the goal. */
  objective: string;
}

export const ROUND_CONFIGS: Record<number, RoundConfig> = {
  1: {
    id: 1,
    name: 'Forest & Grasslands',
    biome: 'forest',
    tagline: 'Gather wood and craft your first pickaxe',
    craft: 'wooden_pickaxe',
    guardian: { name: 'forest_guardian', mandatory: false },
    choice: null,
    marketplace: false,
    pvp: false,
    objective: 'Craft the Wooden Pickaxe (60 Wood) to unlock the Cave Biome.',
  },
  2: {
    id: 2,
    name: 'Cave Biome',
    biome: 'cave',
    tagline: 'Mine stone and iron, and open up the marketplace',
    craft: 'stone_pickaxe',
    guardian: { name: 'skeleton_archer', mandatory: false },
    choice: 'ancient_shrine',
    marketplace: true,
    pvp: false,
    objective: 'Craft the Stone Pickaxe (10 Wood + 45 Stone + 25 Iron) to unlock the Mountain Biome.',
  },
  3: {
    id: 3,
    name: 'Mountain Biome',
    biome: 'mountain',
    tagline: 'Armour up — the duel comes next',
    craft: 'iron_armor',
    guardian: { name: 'blaze_guardian', mandatory: true },
    choice: 'piglin_merchant',
    marketplace: true,
    pvp: false,
    objective:
      'Earn what you can, trade at the market, and craft the Iron Armor (40 Iron + 25 Gold). The Duel opens when this round closes.',
  },
  6: {
    id: 6,
    name: 'The Duel',
    biome: 'mountain',
    tagline: 'Head to head, seeded by standing',
    craft: null,
    guardian: null,
    choice: null,
    marketplace: false,
    pvp: true,
    objective:
      'Press ENTER PVP and you are paired automatically — same year, nearest rank. Beat the pack faster than your opponent and the Nether Portal materials are yours.',
  },
  4: {
    id: 4,
    name: 'Nether Portal Finale',
    biome: 'nether',
    tagline: 'Day 2 championship',
    craft: null,
    guardian: null,
    choice: null,
    marketplace: false,
    pvp: false,
    objective: 'Day 2 content is delivered in Phase 3.',
  },
  5: {
    id: 5,
    name: 'The End',
    biome: 'end',
    tagline: 'Craft the Diamond Pickaxe and face the Ender Dragon',
    craft: 'diamond_pickaxe',
    guardian: null,
    choice: 'end_merchant',
    marketplace: true,
    pvp: false,
    objective:
      'Solve challenges, craft the Diamond Pickaxe (25 Iron + 20 Gold + 100 Diamonds + 10 Emeralds), then defeat the Final Boss.',
  },
};

/**
 * The round the duel lives in.
 *
 * Derived from the `pvp` flag rather than written twice, so moving the duel is
 * a one-line change here and nothing downstream goes stale.
 */
export const PVP_ROUND_ID: number =
  Object.values(ROUND_CONFIGS).find((config) => config.pvp)?.id ?? 6;

/**
 * Where the duel's questions live.
 *
 * The pack has always been `questions` rows with `round_id = 3, type = 'pvp'`,
 * and it stays there: the round question service excludes `type = 'pvp'`
 * already, so those rows never leak into Round 3's paper, and moving five rows
 * to satisfy a naming instinct would break every seed file that references them.
 */
export const PVP_PACK_ROUND_ID = 3;

export function getRoundConfig(roundId: number): RoundConfig | null {
  return ROUND_CONFIGS[roundId] ?? null;
}
