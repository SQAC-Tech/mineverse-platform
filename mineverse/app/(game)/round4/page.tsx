import { CustomRoundShell } from '@/components/game/custom-round-ui/CustomRoundShell';
import { ProctoredRound } from '@/components/game/proctor/ProctoredRound';

export default function RoundPage() {
  return (
    <ProctoredRound roundId={4}>
      <CustomRoundShell roundId={4} />
    </ProctoredRound>
  );
}
