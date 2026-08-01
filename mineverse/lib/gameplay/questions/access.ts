import { supabaseServer } from '@/lib/supabase/server';

export type Dev4RoundAccess =
  | { ok: true; round: { id: number; name: string; status: string; starts_at: string | null; ends_at: string | null; time_allotted: number } }
  | { ok: false; status: number; code: string; message?: string };

const db = supabaseServer as any;

export async function verifyDev4RoundAccess(teamId: string, roundId: number): Promise<Dev4RoundAccess> {
  const { data: round, error: roundError } = await db
    .from('rounds')
    .select('id, name, status, starts_at, ends_at, time_allotted')
    .eq('id', roundId)
    .single();

  if (roundError || !round) {
    return { ok: false, status: 404, code: 'ROUND_NOT_FOUND', message: 'Round not found.' };
  }

  if (round.status !== 'active') {
    return { ok: false, status: 403, code: 'ROUND_NOT_ACTIVE', message: 'This round is not active.' };
  }

  if (!round.ends_at || new Date(round.ends_at).getTime() <= Date.now()) {
    return { ok: false, status: 403, code: 'ROUND_LOCKED', message: 'This round is no longer accepting submissions.' };
  }

  const { data: access, error: accessError } = await db
    .from('team_round_access')
    .select('is_locked')
    .eq('team_id', teamId)
    .eq('round_id', roundId)
    .single();

  if (accessError || !access || access.is_locked) {
    return { ok: false, status: 403, code: 'TEAM_NOT_AUTHORIZED_FOR_ROUND', message: 'This round is not unlocked for your team.' };
  }

  return { ok: true, round };
}

export function accessErrorResponse(access: Extract<Dev4RoundAccess, { ok: false }>) {
  return Response.json(
    { success: false, error: { code: access.code, message: access.message } },
    { status: access.status },
  );
}