import { supabaseServer } from '@/lib/supabase/server';

/**
 * Teams that walk through the event without waiting on round control.
 *
 * `rounds.status` is global, so the obvious way to test Round 5 — flip it to
 * `active` — opens it for every real team at the same time. This is the scoped
 * alternative: named team codes skip the round-status and lock gates, and
 * nobody else's experience changes.
 *
 * It is not `NEXT_PUBLIC_DEV_UNLOCK_ALL_ROUNDS`, which does the same thing for
 * *everyone* and must never be set in production. This one is server-only (no
 * NEXT_PUBLIC_ prefix, so it never reaches the browser) and is safe to set on a
 * live deployment.
 *
 * What it bypasses: the round-status gate and the per-team round lock. What it
 * does not: session verification, resource mutations, idempotency, grading, or
 * any one-time-use constraint. A demo team cannot award itself anything a real
 * team could not earn.
 *
 * Demo teams also get a fixed login OTP and skip the event-day gate — see
 * app/api/auth/login/request-otp. Team codes are only three digits, so treat a
 * demo team as public: never point one at a real team's data.
 */
export const DEMO_TEAM_CODES = (process.env.DEMO_TEAM_CODES ?? 'MNV-000')
  .split(',')
  .map((code) => code.trim().toUpperCase())
  .filter(Boolean);

export function isDemoTeamCode(teamCode: string | null | undefined): boolean {
  return Boolean(teamCode) && DEMO_TEAM_CODES.includes(String(teamCode).toUpperCase());
}

/**
 * The access helpers only carry a team id, so the code has to be looked up.
 * Cached per server instance — bounded by the number of teams that ever hit an
 * access check, and a team's code never changes.
 */
const codeByTeamId = new Map<string, string | null>();

export async function isDemoTeamId(teamId: string): Promise<boolean> {
  if (DEMO_TEAM_CODES.length === 0) return false;

  if (!codeByTeamId.has(teamId)) {
    const { data } = await supabaseServer.from('teams').select('team_code').eq('id', teamId).maybeSingle();
    codeByTeamId.set(teamId, data?.team_code ?? null);
  }

  return isDemoTeamCode(codeByTeamId.get(teamId));
}

let warned = false;

/** Logs once per process so a demo team left enabled after the event is visible. */
export function noteDemoBypass(context: string) {
  if (!warned) {
    warned = true;
    console.warn(`[demo-team] round gates bypassed for ${DEMO_TEAM_CODES.join(', ')} — ${context}`);
  }
}
