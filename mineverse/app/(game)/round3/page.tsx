import { CustomRoundShell } from '@/components/game/custom-round-ui/CustomRoundShell';
import { ProctoredRound } from '@/components/game/proctor/ProctoredRound';

export default function RoundPage() {
  return (
    <ProctoredRound roundId={3}>
      <CustomRoundShell roundId={3} />
    </ProctoredRound>
  );
}
