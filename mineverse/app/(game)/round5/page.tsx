import { requireRoundAccess } from '@/lib/gameplay/round-access';
import { CustomRoundShell } from '@/components/game/custom-round-ui/CustomRoundShell';
import { ProctoredRound } from '@/components/game/proctor/ProctoredRound';

export const dynamic = 'force-dynamic';

/**
 * The End now runs on the same shell as the other biome rounds.
 *
 * It used to render `EndRoundShell` over the older scrolling `RoundShell`,
 * which drew admin-panel chrome on a page that scrolled and had no biome at
 * all. Everything that wrapper added — the Final Boss link — is now a rail
 * panel in the shell, next to the End Merchant, and both are driven off
 * ROUND_CONFIGS rather than a hardcoded round id.
 */
export default async function Round5Page() {
  const { proctorExempt } = await requireRoundAccess(5);

  return (
    <ProctoredRound roundId={5} exempt={proctorExempt}>
      <CustomRoundShell roundId={5} />
    </ProctoredRound>
  );
}
