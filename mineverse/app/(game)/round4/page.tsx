import { requireRoundAccess } from '@/lib/gameplay/round-access';
import { PortalRepairUI } from '@/components/day2/portal/PortalRepairUI';
import { ProctoredRound } from '@/components/game/proctor/ProctoredRound';

export const dynamic = 'force-dynamic';

/**
 * Round 4 is the Nether Portal repair and nothing else — the games that fill the
 * hour are run and judged in the room. This used to render `CustomRoundShell`,
 * which draws questions, crafting and a marketplace that Round 4's config turns
 * all of off, so teams got an empty biome with no way to reach the one action
 * the round actually has. `/portal` renders the same component.
 */
export default async function Round4Page() {
  await requireRoundAccess(4);

  return (
    <ProctoredRound roundId={4}>
      <PortalRepairUI />
    </ProctoredRound>
  );
}
