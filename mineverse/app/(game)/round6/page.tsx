import { requireRoundAccess } from '@/lib/gameplay/round-access';
import { CustomRoundShell } from '@/components/game/custom-round-ui/CustomRoundShell';
import { ProctoredRound } from '@/components/game/proctor/ProctoredRound';

export const dynamic = 'force-dynamic';

/**
 * The duel, as its own screen.
 *
 * Identical in shape to the other rounds — the shell reads `ROUND_CONFIGS[6]`,
 * sees `pvp: true`, and draws the arena instead of a question paper.
 */
export default async function Round6Page() {
  const { proctorExempt } = await requireRoundAccess(6);

  return (
    <ProctoredRound roundId={6} exempt={proctorExempt}>
      <CustomRoundShell roundId={6} />
    </ProctoredRound>
  );
}
