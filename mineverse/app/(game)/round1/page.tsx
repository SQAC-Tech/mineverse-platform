import { requireRoundAccess } from '@/lib/gameplay/round-access';
import { CustomRoundShell } from '@/components/game/custom-round-ui/CustomRoundShell';
import { ProctoredRound } from '@/components/game/proctor/ProctoredRound';

export const dynamic = 'force-dynamic';

export default async function Round1Page() {
  const { proctorExempt } = await requireRoundAccess(1);

  return (
    <ProctoredRound roundId={1} exempt={proctorExempt}>
      <CustomRoundShell roundId={1} />
    </ProctoredRound>
  );
}
