import { requireRoundAccess } from '@/lib/gameplay/round-access';
import { CustomRoundShell } from '@/components/game/custom-round-ui/CustomRoundShell';
import { ProctoredRound } from '@/components/game/proctor/ProctoredRound';

export const dynamic = 'force-dynamic';

export default async function Round1Page() {
  await requireRoundAccess(1);

  return (
    <ProctoredRound roundId={1}>
      <CustomRoundShell roundId={1} />
    </ProctoredRound>
  );
}
