import { supabaseServer } from '@/lib/supabase/server';

const db = supabaseServer as any;

/**
 * Who may enter the duel.
 *
 * The gate is the craft chain, and only the craft chain: a team that has the
 * Iron Armor has necessarily crafted the Stone Pickaxe and the Wooden Pickaxe
 * before it, because `craft_team_item` enforces the order. So one lookup
 * answers the whole progression question.
 *
 * `checkTeamEligibility` in the qualification service looks similar and is not
 * interchangeable: its `isEligible` also demands `hasPvPWin`, because it
 * answers "may this team go through to Day 2", which is decided *by* the duel.
 * Asking it at the door would mean only past winners could fight.
 */

/**
 * Whether beating the Blaze Guardian is also required to enter.
 *
 * On. Round 3's guardian is `mandatory: true` in `ROUND_CONFIGS`, and the duel
 * is what that mandate is for — a team that skipped the Blaze does not walk
 * into the arena on the strength of its crafting alone.
 *
 * The panel reads this same flag, so the checklist follows it: turn it off and
 * the Blaze line stops being drawn as well as stops being enforced.
 */
export const PVP_REQUIRES_BLAZE_GUARDIAN = true;

export interface PvpEntryEligibility {
  hasIronArmor: boolean;
  hasBlazeGuardian: boolean;
  requiresBlazeGuardian: boolean;
  isEligible: boolean;
  /** Sentence for the participant when they cannot enter. */
  reason: string | null;
}

export async function pvpEntryEligibility(teamId: string): Promise<PvpEntryEligibility> {
  const [armorResult, blazeResult] = await Promise.all([
    db.from('crafting_log').select('item').eq('team_id', teamId).eq('item', 'iron_armor').maybeSingle(),
    db
      .from('guardian_battles')
      .select('id')
      .eq('team_id', teamId)
      .eq('guardian_name', 'blaze_guardian')
      .eq('status', 'won')
      .limit(1)
      .maybeSingle(),
  ]);

  const hasIronArmor = Boolean(armorResult.data);
  const hasBlazeGuardian = Boolean(blazeResult.data);

  const isEligible =
    hasIronArmor && (!PVP_REQUIRES_BLAZE_GUARDIAN || hasBlazeGuardian);

  let reason: string | null = null;
  if (!hasIronArmor) {
    reason = 'Craft the Iron Armor (40 Iron + 25 Gold) to enter the duel.';
  } else if (PVP_REQUIRES_BLAZE_GUARDIAN && !hasBlazeGuardian) {
    reason = 'Defeat the Blaze Guardian to enter the duel.';
  }

  return { hasIronArmor, hasBlazeGuardian, requiresBlazeGuardian: PVP_REQUIRES_BLAZE_GUARDIAN, isEligible, reason };
}
