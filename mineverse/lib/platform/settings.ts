import { supabaseServer } from '@/lib/supabase/server';

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

export const REGISTRATION_OPEN_KEY = 'registration_open';

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
