import { requireRoundAccess } from '@/lib/gameplay/round-access';
import { CustomRoundShell } from '@/components/game/custom-round-ui/CustomRoundShell';
import { ProctoredRound } from '@/components/game/proctor/ProctoredRound';

export const dynamic = 'force-dynamic';

export default async function Round3Page() {
  const { proctorExempt } = await requireRoundAccess(3);

  return (
    <ProctoredRound roundId={3} exempt={proctorExempt}>
      <CustomRoundShell roundId={3} />
    </ProctoredRound>
  );
}
