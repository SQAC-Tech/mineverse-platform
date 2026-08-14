/**
 * Guardian rules as plain data, with no database import.
 *
 * This used to live in `service.ts`, which pulls in `supabaseServer` and the
 * service-role key. Client components need the reward numbers to render a battle
 * panel, and importing them from `service.ts` dragged the server client into the
 * browser bundle. Keep this file free of anything that touches the database.
 */

export type GuardianName = 'forest_guardian' | 'skeleton_archer' | 'blaze_guardian';

export interface GuardianConfig {
  name: GuardianName;
  round_id: number;
  victoryReward: { wood?: number; stone?: number; iron?: number; gold?: number; emerald?: number };
  defeatPenalty: { wood?: number; stone?: number; iron?: number; gold?: number };
  /**
   * Server-enforced battle window. The event brief fixes 5 min for the Skeleton
   * Archer and 7 min for the Blaze Guardian but states none for the Forest
   * Guardian, so that one is left to the round timer rather than inventing a value.
   */
  timeLimitSeconds: number | null;
}

export const GUARDIANS: Record<GuardianName, GuardianConfig> = {
  forest_guardian: {
    name: 'forest_guardian',
    round_id: 1,
    victoryReward: { wood: 25, stone: 10, emerald: 3 },
    defeatPenalty: { wood: -8, stone: -3 },
    timeLimitSeconds: null,
  },
  skeleton_archer: {
    name: 'skeleton_archer',
    round_id: 2,
    victoryReward: { iron: 20, stone: 15, emerald: 3 },
    defeatPenalty: { iron: -10, stone: -10 },
    timeLimitSeconds: 300,
  },
  blaze_guardian: {
    name: 'blaze_guardian',
    round_id: 3,
    victoryReward: { iron: 12, gold: 10, emerald: 2 },
    defeatPenalty: { iron: -8, gold: -5 },
    timeLimitSeconds: 420,
  },
};
