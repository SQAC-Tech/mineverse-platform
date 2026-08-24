import { RoundLoading } from '@/components/game/custom-round-ui/RoundLoading';

/**
 * Shown while `requireRoundAccess` runs on the server, before the shell exists.
 */
export default function Loading() {
  return <RoundLoading roundId={6} />;
}
