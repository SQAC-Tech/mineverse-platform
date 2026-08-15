import { CaveRoundShell } from '@/components/game/custom-round-ui/CaveRoundShell';
import { ProctoredRound } from '@/components/game/proctor/ProctoredRound';

export default function RoundPage() {
  return (
    <ProctoredRound roundId={2}>
      <CaveRoundShell />
    </ProctoredRound>
  );
}
