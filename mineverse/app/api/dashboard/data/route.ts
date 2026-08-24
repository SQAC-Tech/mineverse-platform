import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { ensureDeviceId, getSession } from '@/lib/auth/session';
import { touchLoginLease } from '@/lib/auth/login-lease';
import { isDemoTeamCode } from '@/lib/gameplay/demo-teams';
import { DEV_UNLOCK_ALL_ROUNDS } from '@/lib/gameplay/dev-mode';
import { CRAFT_RECIPES, requiredCraftForRound, type CraftItem } from '@/lib/gameplay/crafting/rules';
import { ROUND_CONFIGS, PVP_ROUND_ID } from '@/lib/gameplay/round-config';
import { pvpEligibilityFrom } from '@/lib/gameplay/pvp/eligibility';
import { getCachedRound } from '@/lib/cache/reads';
import type { ChoiceKey } from '@/lib/gameplay/choices/service';
import { dashboardEntitlement } from '@/lib/attendance/gates';

export const dynamic = 'force-dynamic';

/** Diamonds the portal repair needs, alongside a core and a fragment. */
const PORTAL_DIAMONDS = 15;

/**
 * One snapshot for the whole dashboard.
 *
 * The spec asks for a single server-backed payload rather than the dashboard
 * fanning out to /api/team/craft/recipes, /day2/status, /qualification/status
 * and the rest — those all guard on Day 2 qualification or return 403s that a
 * status page has no business treating as errors. Everything here is read-only
 * and derived server-side; nothing on this route mutates or grants anything.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const teamId = session.team_id;

  /**
   * The one-device rule's heartbeat, and its only enforcement after login.
   *
   * The dashboard polls this every ten seconds, which makes it the natural
   * place for both halves: it keeps the team's lease alive while they are
   * actually here, and it is how a device that has been taken over finds out —
   * within one tick, rather than playing on beside the team that took the seat.
   *
   * Checking the lease on every team route instead would mean a database read
   * per request to enforce a rule that only bites at the ten-second scale. A
   * 401 sends the shell to the login screen, where the team can take the seat
   * back if it is genuinely theirs.
   */
  const deviceId = await ensureDeviceId();
  const leased = isDemoTeamCode(session.team_code) ? 'held' : await touchLoginLease(teamId, deviceId);

  if (leased === 'evicted') {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized',
        message: 'Your team signed in on another device. Only one device can be signed in at a time.',
      },
      { status: 401 },
    );
  }

  /**
   * Everything this route reads, in one round trip.
   *
   * This used to be eleven separate PostgREST requests — the team, its round
   * access, resources, the crafting log, game state, both portal tables, the
   * End Merchant probe, the shortlist row behind the entitlement check, the
   * Blaze Guardian lookup behind PvP eligibility and the duel queue. On event
   * day this route was the top ten paths in the edge log on its own, and the
   * instance cannot be given more compute, so the round trips had to go.
   *
   * `dashboard_snapshot` returns the same raw rows under the same names, with
   * `rounds` nested inside each access row exactly as the PostgREST embed did.
   * None of the derivation below changed.
   */
  // `as any`: `types/supabase.ts` predates this function, and regenerating the
  // whole file hours before the event is a bigger change than this route wants.
  // The shape is asserted immediately below instead.
  const { data: snapshot, error: snapshotError } = await (supabaseServer as any).rpc('dashboard_snapshot', {
    p_team_id: teamId,
  });

  if (snapshotError || !snapshot) {
    console.error('Dashboard snapshot failed:', snapshotError);
    return NextResponse.json({ success: false, error: 'SNAPSHOT_FAILED' }, { status: 503 });
  }

  const snap = snapshot as unknown as {
    team: { id: string; team_name: string; team_code: string } | null;
    access: Array<Record<string, any>>;
    resources: Record<string, number> | null;
    crafted: Array<{ item: string; crafted_at: string }>;
    state: { nether_core_count: number; armor_crafted: boolean; qualified_for_day2: boolean; elimination_reason: string | null } | null;
    has_fragment: boolean;
    portal_repair: { repaired_at: string } | null;
    end_merchant: { reason: string | null; created_at: string } | null;
    shortlist: { result: string | null; rsvp_confirmed_at: string | null } | null;
    blaze_guardian_won: boolean;
    pvp_queued: boolean;
  };

  /**
   * The dashboard opens on the RSVP, not on attendance.
   *
   * A team needs to see its inventory, its rounds and its team code the night
   * before as much as on the day, and nothing here can be played — the rounds
   * themselves are gated separately, on being in the room. What this does stop
   * is a team that did not qualify, or never replied, seeing a dashboard that
   * implies it is playing.
   *
   * The shortlist row comes from the snapshot, so this costs no extra query.
   */
  const entitled = await dashboardEntitlement(teamId, snap.shortlist);
  if (!entitled.ok) {
    return NextResponse.json(
      { success: false, error: entitled.reason, message: entitled.message },
      { status: 403 },
    );
  }

  const team = snap.team;
  const access = snap.access;
  const resources = snap.resources;

  /**
   * A demo team can open a round the moment it exists.
   *
   * `verifyTeamRoundAccess` has always let a demo team past the round status
   * and the per-team lock — that is the entire point of one — but this list did
   * not know it, so the dashboard drew every round greyed out and there was
   * nothing to click. The API would have allowed the entry the UI refused to
   * offer, which made a demo team useless for exactly the walkthrough it exists
   * for.
   */
  const isDemo = isDemoTeamCode(session.team_code);

  /**
   * What the team has crafted, read before the round list needs it.
   *
   * A biome is opened by the tool that reaches it, and the server enforces that
   * at the door. If this list did not know, the map would offer an ACCESS
   * button that the round route immediately refuses — the same mismatch that
   * once greyed out every round for demo teams, in the other direction.
   */
  const craftedItems = new Set((snap.crafted ?? []).map((row) => row.item));

  const rounds = (access ?? []).map((row: any) => {
    const round = row.rounds ?? {};
    const requiredCraft = requiredCraftForRound(row.round_id);
    const craftMissing = Boolean(requiredCraft) && !craftedItems.has(requiredCraft as string);
    // Progression is not scheduling: the demo bypass waives round status and the
    // per-team lock, never this.
    const unlockedForTeam = !craftMissing && (isDemo || (!row.is_locked && round.status === 'active'));

    return {
      round_id: row.round_id,
      name: round.name ?? `Round ${row.round_id}`,
      day: round.day ?? null,
      sequence: round.sequence ?? null,
      description: round.description ?? '',
      time_allotted: round.time_allotted ?? null,
      round_status: round.status ?? 'locked',
      ends_at: round.ends_at ?? null,
      is_locked: row.is_locked,
      completed_at: row.completed_at,
      score: row.score,
      can_enter: DEV_UNLOCK_ALL_ROUNDS || unlockedForTeam,
      unlocked_by_dev_mode: DEV_UNLOCK_ALL_ROUNDS && !unlockedForTeam,
      // Names the missing tool so the map can say what to do rather than only
      // that the biome is shut.
      needs_craft: craftMissing && requiredCraft ? CRAFT_RECIPES[requiredCraft].label : null,
    };
  });

  /**
   * The duel, which is not an ordinary round here.
   *
   * It has no `team_round_access` row and never will — it is open to whoever
   * finished Round 3 with the Iron Armor — so it cannot arrive through the list
   * above. The round itself is cached; eligibility and the queue come out of
   * the snapshot, so none of this costs a round trip.
   */
  const duelRound = await getCachedRound(PVP_ROUND_ID);
  const duelEligibility = pvpEligibilityFrom({
    hasIronArmor: craftedItems.has('iron_armor'),
    hasBlazeGuardian: snap.blaze_guardian_won,
  });
  const duelOpen = duelRound?.status === 'active';

  if (duelRound && !rounds.some((row) => row.round_id === duelRound.id)) {
    rounds.push({
      round_id: duelRound.id,
      name: duelRound.name ?? 'The Duel',
      day: duelRound.day ?? 1,
      sequence: duelRound.sequence ?? null,
      description: duelRound.description ?? '',
      time_allotted: duelRound.time_allotted ?? null,
      round_status: duelRound.status ?? 'locked',
      ends_at: duelRound.ends_at ?? null,
      // No per-team lock exists for the duel, so nothing can be locked by one.
      is_locked: false,
      completed_at: null,
      score: null,
      can_enter: DEV_UNLOCK_ALL_ROUNDS || isDemo || (duelOpen && duelEligibility.isEligible),
      unlocked_by_dev_mode: DEV_UNLOCK_ALL_ROUNDS && !(duelOpen && duelEligibility.isEligible),
      // The duel's entry requirement is the same craft chain, so it reuses the
      // field the map already knows how to render.
      needs_craft: duelEligibility.isEligible ? null : CRAFT_RECIPES.iron_armor.label,
    });
    rounds.sort((a, b) => a.round_id - b.round_id);
  }

  const craftedAt = new Map<string, string>((snap.crafted ?? []).map((row) => [row.item, row.crafted_at]));

  // The catalog is the source of truth for what exists, so an uncrafted item is
  // still listed — a dashboard that hides what you have not earned tells a team
  // nothing about what to aim for.
  const crafted = (Object.keys(CRAFT_RECIPES) as CraftItem[]).map((item) => ({
    item,
    label: CRAFT_RECIPES[item].label,
    cost: CRAFT_RECIPES[item].base_cost,
    crafted: craftedAt.has(item),
    crafted_at: craftedAt.get(item) ?? null,
  }));

  const state = snap.state ?? null;
  const netherCores = state?.nether_core_count ?? 0;
  const hasFragment = snap.has_fragment;
  const isRepaired = Boolean(snap.portal_repair);
  const diamonds = resources?.diamond ?? 0;

  const missingForPortal = [
    netherCores < 1 ? 'Nether Core' : null,
    !hasFragment ? 'Portal Fragment' : null,
    diamonds < PORTAL_DIAMONDS ? `${PORTAL_DIAMONDS - diamonds} more Diamonds` : null,
  ].filter((entry): entry is string => entry !== null);

  return NextResponse.json({
    success: true,
    team,
    resources: resources ?? { wood: 0, stone: 0, iron: 0, gold: 0, diamond: 0, emerald: 0, obsidian: 0 },
    rounds,
    crafted,
    progress: {
      qualified_for_day2: Boolean(state?.qualified_for_day2),
      elimination_reason: state?.elimination_reason ?? null,
      pvp_eligible: Boolean(state?.armor_crafted),
      nether_core_count: netherCores,
      end_merchant: {
        traded: Boolean(snap.end_merchant),
        reason: snap.end_merchant?.reason ?? null,
      },
      portal: {
        // `repaired` | `ready` | `collecting` — the missing list carries the detail,
        // because "locked" on its own never told a team what to go and get.
        state: isRepaired ? 'repaired' : missingForPortal.length === 0 ? 'ready' : 'collecting',
        has_fragment: hasFragment,
        is_repaired: isRepaired,
        diamonds_required: PORTAL_DIAMONDS,
        missing: missingForPortal,
      },
    },
    /**
     * What the dashboard may open, decided here rather than in the browser.
     *
     * Trading moved off the round pages and onto the dashboard, so the
     * dashboard needs to know when each trader has arrived. The brief puts the
     * marketplace at the Cave Biome and says it stays available for the rest of
     * the event; the Shrine belongs to the same round and the Piglin Merchant
     * to the Mountain. "Has the round started" is the whole test — the traders
     * do not close again when their round does.
     *
     * Derived from `ROUND_CONFIGS` rather than hardcoded here, so a round whose
     * marketplace flag changes cannot leave this behind.
     */
    duel: {
      round_id: PVP_ROUND_ID,
      open: duelOpen,
      eligible: duelEligibility.isEligible,
      reason: duelEligibility.reason,
      queued: snap.pvp_queued,
    },
    market: {
      open: (rounds as Array<{ round_id: number; round_status: string }>).some(
        (row) =>
          ROUND_CONFIGS[row.round_id]?.marketplace &&
          (row.round_status === 'active' || row.round_status === 'completed'),
      ),
    },
    traders: (Object.values(ROUND_CONFIGS) as Array<{ id: number; choice: string | null }>)
      .filter((config): config is { id: number; choice: ChoiceKey } => config.choice === 'ancient_shrine' || config.choice === 'piglin_merchant')
      .map((config) => {
        const round = (rounds as Array<{ round_id: number; round_status: string }>).find((row) => row.round_id === config.id);
        return {
          key: config.choice,
          round_id: config.id,
          open: round?.round_status === 'active' || round?.round_status === 'completed',
        };
      }),
    dev_unlock: DEV_UNLOCK_ALL_ROUNDS,
    server_time: new Date().toISOString(),
  });
}
