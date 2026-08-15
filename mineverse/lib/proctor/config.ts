/**
 * Proctoring rules as plain data, with no database import.
 *
 * Client components need the budgets to render "warning 2 of 4", so this file has
 * to stay importable from the browser. Same split as `gameplay/guardians/config.ts`:
 * nothing here may touch `supabaseServer`, which carries the service-role key.
 */

export type ProctorEventKind =
  | 'session_start'
  | 'tab_hidden'
  | 'tab_visible'
  | 'window_blur'
  | 'fullscreen_exit'
  | 'fullscreen_restored'
  | 'copy'
  | 'paste'
  | 'context_menu'
  | 'blocked_key'
  | 'reload_attempt'
  | 'heartbeat'
  | 'session_end';

export type ProctorSeverity = 'warning' | 'key_violation' | 'info';

/**
 * Which budget each kind spends. Restores and heartbeats are recorded but never
 * escalate — they are the context that makes an exit interpretable ("out of
 * fullscreen for 4 minutes" vs "alt-tabbed and came straight back").
 */
export const EVENT_SEVERITY: Record<ProctorEventKind, ProctorSeverity> = {
  session_start: 'info',
  tab_hidden: 'warning',
  tab_visible: 'info',
  window_blur: 'info',
  fullscreen_exit: 'warning',
  fullscreen_restored: 'info',
  copy: 'key_violation',
  paste: 'key_violation',
  context_menu: 'key_violation',
  blocked_key: 'key_violation',
  reload_attempt: 'warning',
  heartbeat: 'info',
  session_end: 'info',
};

/**
 * Event-day kill switch.
 *
 * Default on — a proctor nobody remembered to enable is worthless. Set
 * `NEXT_PUBLIC_PROCTOR_ENABLED=false` to turn the whole layer off without a code
 * change: the gate stops appearing, the listeners never attach, and the ingest
 * routes accept nothing. With 41 teams live, a proctor that misfires has to be
 * switchable off in the time it takes to restart the process.
 */
export const PROCTOR_ENABLED = process.env.NEXT_PUBLIC_PROCTOR_ENABLED !== 'false';

export interface ProctorRules {
  /** Tab switches / fullscreen exits tolerated before the team is flagged. */
  warningBudget: number;
  /** Blocked shortcuts, copy/paste and right-clicks tolerated before flagging. */
  keyViolationBudget: number;
  /** Require fullscreen, and show a blocking scrim when it is left. */
  enforceFullscreen: boolean;
  /** Swallow copy / paste / contextmenu instead of only recording them. */
  blockClipboard: boolean;
  /**
   * Seal the team's work when a budget runs out.
   *
   * Off everywhere by default and deliberately so: `lockTeamSection` is
   * irreversible and this platform has no `redo-round` escape hatch, so a false
   * positive would destroy a team's round with no way back. Crossing a budget
   * raises a flag on the organizer console instead, and a human decides.
   */
  autoSubmitOnExhaustion: boolean;
}

const DEFAULT_RULES: ProctorRules = {
  warningBudget: 4,
  keyViolationBudget: 6,
  enforceFullscreen: true,
  blockClipboard: true,
  autoSubmitOnExhaustion: false,
};

/**
 * Per-round overrides. Round 4 is only the Nether Portal repair — a short
 * cooperative step rather than an assessment — so it runs looser.
 */
const ROUND_RULES: Partial<Record<number, Partial<ProctorRules>>> = {
  // Round 0 is the screening qualifier. Strictest budgets on the platform: it is
  // unsupervised, it decides who gets in at all, and it is only 30 minutes, so
  // there is far less room for the honest stray keypress a two-hour round
  // accumulates.
  0: { warningBudget: 3, keyViolationBudget: 4 },
  4: { enforceFullscreen: false, blockClipboard: false, warningBudget: 8 },
};

export function proctorRules(roundId: number): ProctorRules {
  return { ...DEFAULT_RULES, ...(ROUND_RULES[roundId] ?? {}) };
}

/** How often the browser tells the server it is still there. */
export const HEARTBEAT_INTERVAL_MS = 30_000;

/** How long the queue waits before shipping a batch of events. */
export const FLUSH_INTERVAL_MS = 3_000;

/**
 * A session with no heartbeat for this long is shown as "dark" on the console.
 * Two missed heartbeats plus slack, so one dropped request is not an alarm.
 */
export const STALE_AFTER_MS = 75_000;

/** Largest batch the ingest route will accept in one request. */
export const MAX_EVENTS_PER_BATCH = 50;

export function isFlagged(
  counts: { warning_count: number; key_violation_count: number },
  rules: ProctorRules,
): boolean {
  return (
    counts.warning_count >= rules.warningBudget ||
    counts.key_violation_count >= rules.keyViolationBudget
  );
}
