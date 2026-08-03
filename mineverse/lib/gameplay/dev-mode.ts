/**
 * Dev-only round unlock.
 *
 * When `NEXT_PUBLIC_DEV_UNLOCK_ALL_ROUNDS=true`, every round is enterable without
 * an admin unlocking it in round control. This exists so the gameplay UI can be
 * walked end to end before the event; it is opt-in and absent by default.
 *
 * It bypasses ONLY the round lock. A valid team session is still required, and
 * every resource mutation, idempotency rule, and grading path is unchanged — so
 * a stray flag cannot award anything or leak another team's data.
 *
 * NEVER set this in the production environment.
 */
export const DEV_UNLOCK_ALL_ROUNDS = process.env.NEXT_PUBLIC_DEV_UNLOCK_ALL_ROUNDS === 'true';

let warned = false;

/** Logs once per server process so an accidentally-deployed flag is obvious. */
export function noteDevUnlockBypass(context: string) {
  if (!DEV_UNLOCK_ALL_ROUNDS) return;
  if (!warned && typeof window === 'undefined') {
    warned = true;
    console.warn(
      '[dev-mode] NEXT_PUBLIC_DEV_UNLOCK_ALL_ROUNDS is enabled — round locks are bypassed. Do not run this in production.',
    );
  }
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[dev-mode] round lock bypassed for ${context}`);
  }
}
