import type { GuardianName } from '@/lib/gameplay/guardians/service';
import type { StructureType } from '@/lib/gameplay/structures/service';
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
  biome: 'forest' | 'cave' | 'mountain' | 'nether';
  tagline: string;
  /** Progression item craftable in this round, if any. */
  craft: CraftItem | null;
  /** Guardian available in this round; `mandatory` gates PvP eligibility. */
  guardian: { name: GuardianName; mandatory: boolean } | null;
  /** Free base structures a team may pick between (one per round). */
  structures: StructureType[];
  /** Choice event that resolves in this round. */
  choice: ChoiceKey | null;
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
    structures: [],
    choice: null,
    marketplace: false,
    pvp: false,
    objective: 'Craft the Wooden Pickaxe (60 Wood) to unlock the Cave Biome.',
  },
  2: {
    id: 2,
    name: 'Cave Biome',
    biome: 'cave',
    tagline: 'Mine stone and iron, and pick your first structure',
    craft: 'stone_pickaxe',
    guardian: { name: 'skeleton_archer', mandatory: false },
    structures: ['bat_cave', 'forge'],
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
    structures: ['bastion', 'tnt_storage'],
    choice: 'piglin_merchant',
    marketplace: true,
    pvp: true,
    objective:
      'Defeat the Blaze Guardian, craft the Iron Armor (40 Iron + 25 Gold), then win the PvP duel. Only the top 50% advance.',
  },
  4: {
    id: 4,
    name: 'Nether Portal Finale',
    biome: 'nether',
    tagline: 'Day 2 championship',
    craft: null,
    guardian: null,
    structures: [],
    choice: null,
    marketplace: false,
    pvp: false,
    objective: 'Day 2 content is delivered in Phase 3.',
  },
};

export function getRoundConfig(roundId: number): RoundConfig | null {
  return ROUND_CONFIGS[roundId] ?? null;
}
