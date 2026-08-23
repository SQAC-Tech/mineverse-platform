/**
 * The shape of `/api/dashboard/data`.
 *
 * One snapshot feeds the whole dashboard. Everything here is display-only: the
 * spec is explicit that dashboard state is never permission to act, so each
 * linked page and every mutation re-checks on the server regardless of what
 * these fields say.
 */

export interface DashboardTeam {
  id: string;
  team_name: string;
  team_code: string;
}

export interface DashboardRound {
  round_id: number;
  name: string;
  day: number | null;
  sequence: number | null;
  description: string;
  time_allotted: number | null;
  round_status: string;
  /** When the round closes, ISO. The dashboard counts down against this. */
  ends_at: string | null;
  is_locked: boolean;
  completed_at: string | null;
  score: number | null;
  can_enter: boolean;
  unlocked_by_dev_mode: boolean;
  /** The tool this biome needs, when the team has not crafted it yet. */
  needs_craft: string | null;
}

export interface CraftedItem {
  item: string;
  label: string;
  cost: Record<string, number>;
  crafted: boolean;
  crafted_at: string | null;
}

export interface PortalProgress {
  state: 'repaired' | 'ready' | 'collecting';
  has_fragment: boolean;
  is_repaired: boolean;
  diamonds_required: number;
  /** Human-readable outstanding requirements, empty when ready. */
  missing: string[];
}

export interface EndMerchantProgress {
  /** The End Merchant is a one-time trade; this is the ledger saying it happened. */
  traded: boolean;
  reason: string | null;
}

export interface DashboardProgress {
  qualified_for_day2: boolean;
  elimination_reason: string | null;
  pvp_eligible: boolean;
  nether_core_count: number;
  end_merchant: EndMerchantProgress;
  portal: PortalProgress;
}

export interface LedgerEntry {
  id: string;
  delta: Record<string, number> | null;
  balance_after: Record<string, number> | null;
  source_type: string;
  source_id: string | null;
  actor_type: string | null;
  reason: string | null;
  created_at: string;
}

/** Which traders have arrived. Decided server-side from the rounds' status. */
export interface DashboardTrader {
  key: 'ancient_shrine' | 'piglin_merchant';
  round_id: number;
  open: boolean;
}
