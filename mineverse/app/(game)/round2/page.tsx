import { requireRoundAccess } from '@/lib/gameplay/round-access';
import { CaveRoundShell } from '@/components/game/custom-round-ui/CaveRoundShell';
import { ProctoredRound } from '@/components/game/proctor/ProctoredRound';

export const dynamic = 'force-dynamic';

export default async function Round2Page() {
  await requireRoundAccess(2);

  return (
    <ProctoredRound roundId={2}>
      <CaveRoundShell />
    </ProctoredRound>
  );
}
