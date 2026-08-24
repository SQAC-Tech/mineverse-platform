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
    tagline: 'Elimination round — armour up, beat the Blaze, win the duel',
    craft: 'iron_armor',
    guardian: { name: 'blaze_guardian', mandatory: true },
    choice: 'piglin_merchant',
    marketplace: true,
    pvp: false,
    objective:
      'Defeat the Blaze Guardian and craft the Iron Armor (40 Iron + 25 Gold). Only the top 50% advance.',
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
  /**
   * The duel, as a round of its own.
   *
   * It used to be a panel inside Round 3, which made it inherit Round 3's
   * gates: craft the Iron Armor, beat the Blaze Guardian, and only then duel.
   * On the day that meant a team held up by a craft could not duel at all, and
   * the duel is the part of the evening everyone came for.
   *
   * So it moved out and dropped its prerequisites. The only question asked is
   * whether the team is in the room — see `lib/gameplay/pvp/eligibility.ts`.
   * Numbered 6 rather than 4 so the Day 2 rounds keep their ids, which the
   * attendance checkpoints and `DAY_TWO_ROUNDS` are both written in terms of.
   */
  6: {
    id: 6,
    name: 'The Duel',
    biome: 'mountain',
    tagline: 'Head to head — no armour required',
    craft: null,
    guardian: null,
    choice: null,
    marketplace: false,
    pvp: true,
    objective: 'Face another team head to head. Every team marked present for Round 3 can enter.',
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

export function getRoundConfig(roundId: number): RoundConfig | null {
  return ROUND_CONFIGS[roundId] ?? null;
}
