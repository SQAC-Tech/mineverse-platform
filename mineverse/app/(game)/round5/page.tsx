import { requireRoundAccess } from '@/lib/gameplay/round-access';
import { EndRoundShell } from '@/components/day2/end-round/EndRoundShell';
import { ProctoredRound } from '@/components/game/proctor/ProctoredRound';

export const dynamic = 'force-dynamic';

export default async function Round5Page() {
  await requireRoundAccess(5);

  return (
    <ProctoredRound roundId={5}>
      <EndRoundShell roundId={5} />
    </ProctoredRound>
  );
}
