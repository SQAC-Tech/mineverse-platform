/**
 * A polling timer that stops costing anything when nobody is looking.
 *
 * Every screen on this platform polls, and the Vercel bill is the sum of those
 * timers times the number of teams in the hall. Two things were wrong with a
 * bare `setInterval`:
 *
 *   - a backgrounded tab kept polling forever, so a team that opened the
 *     dashboard and switched away carried on spending requests all afternoon;
 *   - coming back to the tab showed stale data until the next tick.
 *
 * Skipping hidden ticks fixes the first. Refetching on the way back fixes the
 * second, and does it with one request rather than the dozens that were spent
 * while the tab was buried.
 *
 * Returns a cleanup function, so it drops straight into a `useEffect`.
 */
export function startPoll(run: () => void, intervalMs: number): () => void {
  if (typeof document === 'undefined') return () => {};

  const timer = window.setInterval(() => {
    // The tick is skipped, not queued: catching up on missed ticks would undo
    // the saving the moment the tab came back.
    if (document.hidden) return;
    run();
  }, intervalMs);

  const onVisible = () => {
    if (!document.hidden) run();
  };
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
