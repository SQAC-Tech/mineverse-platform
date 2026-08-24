import { requireRoundAccess } from '@/lib/gameplay/round-access';
import { PvpArenaScreen } from '@/components/game/pvp/PvpArenaScreen';
import { ProctoredRound } from '@/components/game/proctor/ProctoredRound';

export const dynamic = 'force-dynamic';

/**
 * The duel, which is the arena and nothing else.
 *
 * Every other round renders `CustomRoundShell` — a question board with a rail
 * of panels beside it. This one used to as well, with the duel tucked into that
 * rail, which put a team inside a round screen in order to press a button that
 * put them in a queue. The arena existed before the duel did.
 *
 * The search now happens on the dashboard, so arriving here means a team has
 * already been paired and there is an opponent on the other side of it. There
 * is nothing else to show: no tabs, no inventory, no trader — a clock, five
 * questions and somebody racing you through them.
 */
export default async function Round6Page() {
  const { proctorExempt } = await requireRoundAccess(6);

  return (
    <ProctoredRound roundId={6} exempt={proctorExempt}>
      <PvpArenaScreen />
    </ProctoredRound>
  );
}
