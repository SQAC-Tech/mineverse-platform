import { requireRoundAccess } from '@/lib/gameplay/round-access';
import { CustomRoundShell } from '@/components/game/custom-round-ui/CustomRoundShell';
import { ProctoredRound } from '@/components/game/proctor/ProctoredRound';

export const dynamic = 'force-dynamic';

export default async function Round4Page() {
  await requireRoundAccess(4);

  return (
    <ProctoredRound roundId={4}>
      <CustomRoundShell roundId={4} />
    </ProctoredRound>
  );
}
