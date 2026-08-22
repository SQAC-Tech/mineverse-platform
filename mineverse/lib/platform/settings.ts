import { supabaseServer } from '@/lib/supabase/server';
import { istDateString, isEventDay, isScreeningDay } from '@/lib/auth/otp';

/**
 * Switches an organizer can flip without a redeploy.
 *
 * Registration opened and closed through `NEXT_PUBLIC_REGISTRATION_OPEN`, which
 * lives in the Vercel environment — closing it meant editing an env var and
 * waiting on a build, which is not something anyone wants to be doing while a
 * queue forms at the desk. `platform_settings` is the override, and the env var
 * stays as the default for any key with no row, so behaviour is unchanged until
 * somebody actually flips it.
 *
 * Reads are cached for a few seconds. The landing page is the busiest thing on
 * the site during registration week and it asks on every request; a switch that
 * takes five seconds to take effect is indistinguishable from instant to the
 * person pressing it, and it keeps a burst of traffic off the database.
 */

const db = supabaseServer as unknown as {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => { maybeSingle: () => PromiseLike<{ data: { value: unknown } | null }> };
    };
    upsert: (row: Record<string, unknown>, options: { onConflict: string }) => PromiseLike<{ error: unknown }>;
    delete: () => { eq: (column: string, value: string) => PromiseLike<{ error: unknown }> };
  };
};

/**
 * Round 0's window, read directly rather than through `lib/screening/service`.
 *
 * Keeps the login path off the screening module — this runs on every OTP
 * request, and the alternative pulls the whole qualifier in behind it.
 */
const roundsDb = supabaseServer as unknown as {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: number) => {
        maybeSingle: () => PromiseLike<{ data: { starts_at: string | null; ends_at: string | null } | null }>;
      };
    };
  };
};

const SCREENING_ROUND_ID = 0;

export const REGISTRATION_OPEN_KEY = 'registration_open';
export const LOGIN_OPEN_KEY = 'login_open';

const CACHE_TTL_MS = 5_000;

const cache = new Map<string, { value: unknown; expiresAt: number }>();

/** Drops the cached value so the next read goes to the database. */
export function invalidateSetting(key: string) {
  cache.delete(key);
}

async function readSetting(key: string): Promise<unknown> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  try {
    const { data } = await db.from('platform_settings').select('value').eq('key', key).maybeSingle();
    const value = data ? data.value : undefined;
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  } catch (error) {
    // A settings read must never be what takes the landing page down. An
    // unreachable table falls back to the environment default, which is the
    // behaviour this replaced.
    console.error(`Reading platform setting ${key} failed:`, error);
    return undefined;
  }
}

/** The environment default, used whenever the database has no opinion. */
export function registrationOpenDefault(): boolean {
  return process.env.NEXT_PUBLIC_REGISTRATION_OPEN === 'true';
}

export interface RegistrationState {
  open: boolean;
  /** Where the answer came from, so the console can say so. */
  source: 'database' | 'environment';
}

export async function getRegistrationState(): Promise<RegistrationState> {
  const stored = await readSetting(REGISTRATION_OPEN_KEY);
  if (typeof stored === 'boolean') return { open: stored, source: 'database' };
  return { open: registrationOpenDefault(), source: 'environment' };
}

export async function isRegistrationOpen(): Promise<boolean> {
  return (await getRegistrationState()).open;
}

export async function setRegistrationOpen(open: boolean, actor: string): Promise<boolean> {
  const { error } = await db.from('platform_settings').upsert(
    {
      key: REGISTRATION_OPEN_KEY,
      value: open,
      updated_at: new Date().toISOString(),
      updated_by: actor,
    },
    { onConflict: 'key' },
  );

  if (error) {
    console.error('Writing registration_open failed:', error);
    return false;
  }

  invalidateSetting(REGISTRATION_OPEN_KEY);
  return true;
}

/**
 * Hands the key back to the environment variable.
 *
 * Not the same as setting it false — it removes the override entirely, so the
 * deployment's own default applies again. Worth having so an organizer who
 * flipped a switch by accident can put it back the way it shipped rather than
 * guessing what the env var said.
 */
export async function clearRegistrationOverride(): Promise<boolean> {
  const { error } = await db.from('platform_settings').delete().eq('key', REGISTRATION_OPEN_KEY);
  if (error) {
    console.error('Clearing registration_open failed:', error);
    return false;
  }
  invalidateSetting(REGISTRATION_OPEN_KEY);
  return true;
}


/* ------------------------------------------------------------ team login */

/**
 * Whether teams may log in at all right now.
 *
 * The gate used to be one line in `request-otp`: `isEventDay()`, or a 403. That
 * is right for the game itself and wrong for everything before it — the
 * screening qualifier runs two days ahead of the event, and on its own evening
 * every real team would have been told "Login is only available on event day."
 * The demo teams were the only accounts that could get in, which is exactly why
 * it survived testing.
 *
 * Two dates open it now, `EVENT_DATE` and the optional `SCREENING_DATE`, and an
 * organizer can override either from the console. The override matters more
 * than it looks: both dates live in the Vercel environment, so without it a
 * wrong date on the evening of the qualifier means a redeploy while 90 teams
 * wait.
 */
interface ScreeningWindowRow {
  starts_at: string | null;
  ends_at: string | null;
}

/** Cached alongside the settings, for the same reason: this is on the OTP path. */
async function readScreeningWindow(): Promise<ScreeningWindowRow> {
  const hit = cache.get(SCREENING_WINDOW_CACHE_KEY);
  if (hit && hit.expiresAt > Date.now()) return hit.value as ScreeningWindowRow;

  try {
    const { data } = await roundsDb
      .from('rounds')
      .select('starts_at, ends_at')
      .eq('id', SCREENING_ROUND_ID)
      .maybeSingle();

    const value: ScreeningWindowRow = { starts_at: data?.starts_at ?? null, ends_at: data?.ends_at ?? null };
    cache.set(SCREENING_WINDOW_CACHE_KEY, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  } catch (error) {
    console.error('Reading the screening window failed:', error);
    return { starts_at: null, ends_at: null };
  }
}

const SCREENING_WINDOW_CACHE_KEY = '__screening_window';

/**
 * Whether the schedule alone opens login.
 *
 * The screening day comes off round 0's own window first, and only falls back
 * to `SCREENING_DATE`. That ordering matters: the window is set in the console
 * by whoever schedules the qualifier, so it cannot drift from the day teams are
 * actually told to turn up. An env var has to be set correctly in two places
 * and is silently wrong in the third — which is exactly how the login screen
 * ended up naming event day on the evening of the screening.
 */
export function loginOpenDefault(now: Date = new Date(), screeningStartsAt?: string | null): boolean {
  if (isEventDay(now) || isScreeningDay(now)) return true;
  return Boolean(screeningStartsAt) && istDateString(new Date(screeningStartsAt!)) === istDateString(now);
}

/**
 * When login next opens, phrased for someone who turned up on the wrong day.
 *
 * The screening entry carries its time because that is what a team is waiting
 * for; event day does not, because the reporting time is in their mail and the
 * gate opens at midnight either way.
 */
export function nextLoginOpening(state: LoginState, now: Date = new Date()): string | null {
  const options: Array<{ at: Date; label: string }> = [];

  if (state.screening_starts_at) {
    const at = new Date(state.screening_starts_at);
    options.push({
      at,
      label: `${at.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })} at ${at.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true })} for the screening round`,
    });
  }

  if (state.event_date) {
    const at = new Date(`${state.event_date}T00:00:00+05:30`);
    options.push({
      at,
      label: new Date(`${state.event_date}T09:00:00+05:30`).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short',
      }),
    });
  }

  const upcoming = options
    .filter((option) => option.at.getTime() > now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  return upcoming[0]?.label ?? null;
}

export interface LoginState {
  open: boolean;
  source: 'database' | 'schedule';
  /** What the schedule alone would say, so the console can show both. */
  scheduled: boolean;
  event_date: string | null;
  screening_date: string | null;
  /** Round 0's window start, the authoritative screening day. */
  screening_starts_at: string | null;
}

export async function getLoginState(now: Date = new Date()): Promise<LoginState> {
  const [stored, window] = await Promise.all([readSetting(LOGIN_OPEN_KEY), readScreeningWindow()]);
  const scheduled = loginOpenDefault(now, window.starts_at);

  return {
    open: typeof stored === 'boolean' ? stored : scheduled,
    source: typeof stored === 'boolean' ? 'database' : 'schedule',
    scheduled,
    event_date: process.env.EVENT_DATE ?? null,
    screening_date: process.env.SCREENING_DATE ?? null,
    screening_starts_at: window.starts_at,
  };
}

export async function isLoginOpen(now: Date = new Date()): Promise<boolean> {
  return (await getLoginState(now)).open;
}

export async function setLoginOpen(open: boolean, actor: string): Promise<boolean> {
  const { error } = await db.from('platform_settings').upsert(
    {
      key: LOGIN_OPEN_KEY,
      value: open,
      updated_at: new Date().toISOString(),
      updated_by: actor,
    },
    { onConflict: 'key' },
  );

  if (error) {
    console.error('Writing login_open failed:', error);
    return false;
  }

  invalidateSetting(LOGIN_OPEN_KEY);
  return true;
}

/** Hands the gate back to the schedule. See `clearRegistrationOverride`. */
export async function clearLoginOverride(): Promise<boolean> {
  const { error } = await db.from('platform_settings').delete().eq('key', LOGIN_OPEN_KEY);
  if (error) {
    console.error('Clearing login_open failed:', error);
    return false;
  }
  invalidateSetting(LOGIN_OPEN_KEY);
  return true;
}
