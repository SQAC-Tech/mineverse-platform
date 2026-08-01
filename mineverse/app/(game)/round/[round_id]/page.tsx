import { RoundShell } from '@/components/game/round-shell/RoundShell';

export default async function RoundPage({ params }: { params: Promise<{ round_id: string }> }) {
  const { round_id } = await params;
  const roundId = Number.parseInt(round_id, 10);

  return <RoundShell roundId={Number.isInteger(roundId) ? roundId : 0} />;
}