import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';
import { DEV_UNLOCK_ALL_ROUNDS } from '@/lib/gameplay/dev-mode';
import { CustomRoundShell } from '@/components/game/custom-round-ui/CustomRoundShell';

export const dynamic = 'force-dynamic';

export default async function Round1Page() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  // If DEV_UNLOCK_ALL_ROUNDS is false, verify Round 1 lock status for this team
  if (!DEV_UNLOCK_ALL_ROUNDS) {
    const { data: access } = await supabaseServer
      .from('team_round_access')
      .select('is_locked, rounds(status)')
      .eq('team_id', session.team_id)
      .eq('round_id', 1)
      .single();

    const round = (access as any)?.rounds;
    const canEnter = !access?.is_locked && round?.status === 'active';

    if (!canEnter) {
      redirect('/dashboard');
    }
  }

  return <CustomRoundShell roundId={1} />;
}
