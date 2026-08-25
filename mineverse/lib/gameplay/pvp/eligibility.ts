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
 * Off, by an organiser ruling on the day. The Blaze turned out to be far
 * harder than the duel it was guarding — ten wins against forty-six defeats —
 * so the gate was keeping teams out of the round rather than qualifying them
 * for it. The Iron Armor still gates the arena, and the craft chain behind it
 * still has to be earned.
 *
 * Day 2 qualification is a separate question and still counts the Blaze win:
 * see `checkTeamEligibility` in the qualification service. Turning this off
 * does not open that door.
 *
 * Everything that asks "may this team enter the duel" goes through
 * `pvpEligibilityFrom` below, so this single flag governs the queue, the round
 * gate and the sentence the dashboard shows — there is no second copy of the
 * rule to keep in step.
 */
export const PVP_REQUIRES_BLAZE_GUARDIAN = false;

export interface PvpEntryEligibility {
  hasIronArmor: boolean;
  hasBlazeGuardian: boolean;
  requiresBlazeGuardian: boolean;
  isEligible: boolean;
  /** Sentence for the participant when they cannot enter. */
  reason: string | null;
}

/**
 * The two facts this needs, when the caller already has them.
 *
 * `/api/dashboard/data` reads both as part of `dashboard_snapshot`, so passing
 * them here saves two round trips on every dashboard tick.
 */
export interface PvpEligibilityInputs {
  hasIronArmor: boolean;
  hasBlazeGuardian: boolean;
}

export function pvpEligibilityFrom(inputs: PvpEligibilityInputs): PvpEntryEligibility {
  const { hasIronArmor, hasBlazeGuardian } = inputs;

  const isEligible = hasIronArmor && (!PVP_REQUIRES_BLAZE_GUARDIAN || hasBlazeGuardian);

  let reason: string | null = null;
  if (!hasIronArmor) {
    reason = 'Craft the Iron Armor (40 Iron + 25 Gold) to enter the duel.';
  } else if (PVP_REQUIRES_BLAZE_GUARDIAN && !hasBlazeGuardian) {
    reason = 'Defeat the Blaze Guardian to enter the duel.';
  }

  return { hasIronArmor, hasBlazeGuardian, requiresBlazeGuardian: PVP_REQUIRES_BLAZE_GUARDIAN, isEligible, reason };
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

  return pvpEligibilityFrom({
    hasIronArmor: Boolean(armorResult.data),
    hasBlazeGuardian: Boolean(blazeResult.data),
  });
}

