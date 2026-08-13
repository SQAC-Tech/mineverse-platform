/**
 * What each round actually is, in the order teams play them.
 *
 * Lives here rather than beside a component because two different landing
 * treatments render it — `components/HowItWorks.tsx` on `/` and the cavern
 * section of `features/landing-registration/minecraft-landing.tsx` on
 * `/landing`. Copy edits should only ever need making once.
 *
 * Kept in step with the timeline in `components/TimelineSection.tsx`.
 */

export type EventRound = {
  /** "ROUND 1", "QUALIFIER" */
  label: string;
  name: string;
  /** Key into whichever biome palette the rendering page uses. */
  biome: 'Forest' | 'Cave' | 'Mountain' | 'Nether' | 'End';
  icon: string;
  day: 'DAY 1' | 'DAY 2';
  desc: string;
  boss: string;
  unlock: string;
};

export const ROUND_PROGRESSION = ['Forest', 'Cave', 'Mountain', 'Nether', 'End'] as const;

export const EVENT_ROUNDS: EventRound[] = [
  {
    label: 'ROUND 1', name: 'Forest & Grasslands', biome: 'Forest', icon: '🌲', day: 'DAY 1',
    desc: 'The starting biome. Every challenge you clear mines resources into your team inventory.',
    boss: 'Forest Guardian',
    unlock: 'Wooden Pickaxe',
  },
  {
    label: 'ROUND 2', name: 'Cave Biome', biome: 'Cave', icon: '⛏️', day: 'DAY 1',
    desc: 'Underground, with the marketplace open for trading. Mid-round a bonus window doubles what you mine for five minutes.',
    boss: 'Skeleton Archer',
    unlock: 'Stone Pickaxe',
  },
  {
    label: 'ROUND 3', name: 'Mountain Biome', biome: 'Mountain', icon: '🏔️', day: 'DAY 1',
    desc: 'The last Day 1 climb. Trade and upgrade wisely — this is what your qualification is scored on.',
    boss: 'Blaze Guardian',
    unlock: 'Iron Armor',
  },
  {
    label: 'QUALIFIER', name: 'Leaderboard & PvP', biome: 'Nether', icon: '⚔️', day: 'DAY 1',
    desc: 'Scores and resources are verified, teams go head to head, and the leaderboard decides who returns for Day 2.',
    boss: 'Rival teams',
    unlock: 'A seat on Day 2',
  },
  {
    label: 'ROUND 4', name: 'Pre-Final', biome: 'Nether', icon: '🏃', day: 'DAY 2',
    desc: 'Away from the keyboard. Team games in the room earn resources, credited to your inventory before the Nether Portal repair.',
    boss: 'The Nether Portal',
    unlock: 'Finale resources',
  },
  {
    label: 'ROUND 5', name: 'The End', biome: 'End', icon: '🐉', day: 'DAY 2',
    desc: 'Pure code and the Diamond Pickaxe, everything on the line. Whoever stands tallest here takes the crown.',
    boss: 'Ender Dragon',
    unlock: 'Victory',
  },
];
