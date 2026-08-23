import { supabaseServer } from '@/lib/supabase/server';

/**
 * The one-device rule, as a lease rather than a latch.
 *
 * The rule itself has not changed: a team plays from one browser, so three
 * people cannot split a paper between three laptops. What changed is what
 * happens when that browser goes away.
 *
 * The old check asked "has this team ever logged in?" and refused if so — it
 * recorded an IP but never compared it, so the same laptop was turned away on
 * its second login, and pressing LOGOUT barred the team outright. Every escape
 * hatch was a volunteer clicking Release in the admin panel.
 *
 * A lease is held by a *device* and kept alive by *activity*:
 *
 *   - the same device always gets back in — refresh, expiry, restart, logout
 *     and log back in, all of it;
 *   - a different device waits until the holder goes quiet for
 *     `LEASE_STALE_MS`, then takes over on its own;
 *   - logging out hands the seat back immediately.
 *
 * The IP is still recorded, because the desk wants to see where a team logged
 * in from, but it decides nothing. It never could: the venue is one NAT address
 * so every team there looks the same, and a phone's address rotates mid-session
 * so one team looks like several.
 */

/**
 * How long a holder can be silent before the seat is up for grabs.
 *
 * Fifteen minutes is the compromise between the two failure modes. Shorter, and
 * a team that reads a question for a while comes back to find its own seat
 * taken by a teammate's idle tab. Longer, and a team whose laptop died at the
 * start of a 30-minute round spends half of it at the desk.
 */
export const LEASE_STALE_MS = 15 * 60_000;

/** How stale the heartbeat must be before we spend a write refreshing it. */
const TOUCH_THROTTLE_MS = 60_000;

interface LeaseRow {
  active_login_device: string | null;
  active_login_ip: string | null;
  active_login_seen_at: string | null;
}

async function readLease(teamId: string): Promise<LeaseRow | null> {
  const { data } = await supabaseServer
    .from('teams')
    .select('active_login_device, active_login_ip, active_login_seen_at')
    .eq('id', teamId)
    .maybeSingle();

  return data ?? null;
}

/**
 * Whether a lease is old enough to take over.
 *
 * A null timestamp counts as stale, which is what quietly retires the latches
 * left by the old scheme: they carry an IP but no device and no heartbeat, so
 * they can never be matched against the browser that set them. Treating them as
 * expired means the first team to log in reclaims its own seat, instead of 80
 * teams queueing at the desk on event morning.
 */
function isStale(seenAt: string | null): boolean {
  if (!seenAt) return true;
  const seen = new Date(seenAt).getTime();
  if (Number.isNaN(seen)) return true;
  return Date.now() - seen > LEASE_STALE_MS;
}

function waitSeconds(seenAt: string | null): number {
  if (!seenAt) return 0;
  const elapsed = Date.now() - new Date(seenAt).getTime();
  return Math.max(0, Math.ceil((LEASE_STALE_MS - elapsed) / 1000));
}

export type LeaseCheck =
  | { ok: true; takeover: boolean }
  | { ok: false; message: string; retryAfterSeconds: number };

/**
 * Whether this device may log in as this team right now.
 *
 * Refusal is deliberately specific about the wait. "Only one device is allowed"
 * tells a team with a dead laptop nothing they can act on; a number tells them
 * whether to wait or to walk to the desk.
 */
export async function checkLoginLease(teamId: string, deviceId: string): Promise<LeaseCheck> {
  const lease = await readLease(teamId);
  if (!lease) return { ok: true, takeover: false };

  if (!lease.active_login_device) return { ok: true, takeover: false };
  if (lease.active_login_device === deviceId) return { ok: true, takeover: false };
  if (isStale(lease.active_login_seen_at)) return { ok: true, takeover: true };

  const retryAfterSeconds = waitSeconds(lease.active_login_seen_at);
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));

  return {
    ok: false,
    retryAfterSeconds,
    message:
      `Your team is already logged in on another device. Only one device is allowed. ` +
      `Log out there, or wait about ${minutes} minute${minutes === 1 ? '' : 's'} after it goes idle ` +
      `and this device can take over. An organizer at the desk can release it immediately.`,
  };
}

/** Takes the seat for this device, and starts its heartbeat. */
export async function claimLoginLease(teamId: string, deviceId: string, ip: string | null): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabaseServer
    .from('teams')
    .update({
      active_login_device: deviceId,
      active_login_ip: ip,
      active_login_at: now,
      active_login_seen_at: now,
    })
    .eq('id', teamId);

  if (error) console.error('Claiming login lease failed:', error);
}

/**
 * Hands the seat back.
 *
 * Scoped to the holding device, so a stray logout from a browser that has
 * already been taken over cannot free the seat out from under whoever is
 * currently playing.
 */
export async function releaseLoginLease(teamId: string, deviceId: string | null): Promise<void> {
  let query = supabaseServer
    .from('teams')
    .update({
      active_login_device: null,
      active_login_ip: null,
      active_login_at: null,
      active_login_seen_at: null,
    })
    .eq('id', teamId);

  // A session predating the device cookie has nothing to match on. It is still
  // the team's own logout, so honour it.
  if (deviceId) query = query.eq('active_login_device', deviceId);

  const { error } = await query;
  if (error) console.error('Releasing login lease failed:', error);
}

export type LeaseTouch = 'held' | 'evicted';

/**
 * Marks the holder alive, and reports if this device has been displaced.
 *
 * This is the only place the rule is enforced after login, so it is called from
 * the dashboard's ten-second poll: a device whose seat was taken finds out
 * within one tick rather than playing on beside the team that took it.
 *
 * An unheld seat is adopted rather than refused. Sessions that predate this
 * scheme carry no lease at all, and throwing those teams out on deploy would be
 * a self-inflicted outage.
 */
export async function touchLoginLease(teamId: string, deviceId: string): Promise<LeaseTouch> {
  const lease = await readLease(teamId);
  if (!lease) return 'held';

  const held = lease.active_login_device === deviceId;

  if (!held && lease.active_login_device && !isStale(lease.active_login_seen_at)) {
    return 'evicted';
  }

  if (!held) {
    await claimLoginLease(teamId, deviceId, null);
    return 'held';
  }

  // The poll runs every ten seconds for every team in the hall. Writing on each
  // one buys nothing: the lease only has to be fresher than LEASE_STALE_MS.
  if (Date.now() - new Date(lease.active_login_seen_at ?? 0).getTime() < TOUCH_THROTTLE_MS) {
    return 'held';
  }

  await supabaseServer
    .from('teams')
    .update({ active_login_seen_at: new Date().toISOString() })
    .eq('id', teamId)
    .eq('active_login_device', deviceId);

  return 'held';
}
