'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, X, Flame, RefreshCw, Sparkles } from 'lucide-react';
import { Panel, Btn, Loading, Pill } from '@/components/admin/nether-ui';
import { roundChrome } from '@/components/game/custom-round-ui/round-presentation';
import { PortalFrame } from '@/components/day2/portal/PortalFrame';
import { stageFor } from '@/components/day2/portal/portal-layout';
import '@/components/game/custom-round-ui/round-ui.css';

interface Day2Status {
  portal: {
    state: string;
    has_fragment: boolean;
    is_repaired: boolean;
    diamond_count: number;
    nether_core_count: number;
  };
}

const DIAMONDS_REQUIRED = 15;
/** Matches the ignition animation in portal-repair.css. */
const IGNITION_MS = 1600;

function Requirement({
  met,
  label,
  course,
  have,
  need,
}: {
  met: boolean;
  label: string;
  course: string;
  have: number;
  need: number;
}) {
  const pct = Math.min(100, Math.round((have / need) * 100));
  return (
    <li className="pr-req" data-met={String(met)}>
      {met ? (
        <Check size={15} style={{ color: '#c682ff', flexShrink: 0 }} />
      ) : (
        <X size={15} style={{ color: '#e05b4b', flexShrink: 0 }} />
      )}
      <div className="pr-req__label">
        {label}
        <span className="pr-req__part">{course}</span>
        {need > 1 && (
          <div className="pr-meter">
            <div className="pr-meter__fill" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <span className="pr-req__count">
        {Math.min(have, need)}/{need}
      </span>
    </li>
  );
}

/**
 * Round 4's only on-platform action.
 *
 * The physical games are run and judged in the room; organizers credit Diamonds
 * and the Portal Fragment from /admin/resources. There is deliberately no
 * activity list or result-entry form here — a team entering its own results is
 * exactly what the event does not want.
 *
 * The repair is one server-validated call. Nothing about eligibility is decided
 * here: the button only appears once the server says `ready`, and the endpoint
 * re-checks regardless. The ignition animation runs *after* the server has
 * confirmed, so it can never show a portal that is not actually open.
 */
export function PortalRepairUI() {
  const [status, setStatus] = useState<Day2Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [repairing, setRepairing] = useState(false);
  const [igniting, setIgniting] = useState(false);
  const [error, setError] = useState('');
  const igniteTimer = useRef<number | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/team/day2/status', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) setStatus(data);
      }
    } catch {
      // Keep the last good snapshot on screen; the poll below retries.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    // Organizer grants land out of band, so the requirements have to keep up.
    const interval = window.setInterval(fetchStatus, 5000);
    return () => window.clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => () => {
    if (igniteTimer.current) window.clearTimeout(igniteTimer.current);
  }, []);

  const handleRepair = async () => {
    setRepairing(true);
    setError('');
    try {
      const res = await fetch('/api/team/portal/repair', { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to repair the portal.');
        return;
      }
      // Server said yes — now play the ignition, then settle into the repaired
      // state once the refetch has landed underneath it.
      setIgniting(true);
      igniteTimer.current = window.setTimeout(() => setIgniting(false), IGNITION_MS);
      await fetchStatus();
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setRepairing(false);
    }
  };

  const { themeClass } = roundChrome(4);
  const portal = status?.portal;

  const hasCore = (portal?.nether_core_count ?? 0) >= 1;
  const hasFragment = Boolean(portal?.has_fragment);
  const hasDiamonds = (portal?.diamond_count ?? 0) >= DIAMONDS_REQUIRED;
  const isReady = hasCore && hasFragment && hasDiamonds;

  const stage = stageFor(
    { hasCore, hasFragment, hasDiamonds },
    { isRepaired: Boolean(portal?.is_repaired), isIgniting: igniting },
  );

  return (
    <main className={`biome round-ui-scene ${themeClass}`} style={{ minHeight: '100vh' }}>
      <div className="round-ui-scene__backdrop" aria-hidden="true" />
      <div className="round-ui-scene__shade" aria-hidden="true" />
      <div className="round-ui-scene__scrim" aria-hidden="true" />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 16px 48px' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <Flame size={22} style={{ color: 'var(--accent-primary)' }} />
          <div style={{ marginRight: 'auto' }}>
            <div className="n-stat-label">Round 4</div>
            <h1 style={{ fontSize: 20, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-onDark)' }}>
              Nether Portal Repair
            </h1>
          </div>
          {portal && (
            <Pill tone={portal.is_repaired ? 'ok' : isReady ? 'live' : 'idle'}>
              {portal.is_repaired ? 'Repaired' : isReady ? 'Ready' : 'Collecting'}
            </Pill>
          )}
        </header>

        {loading && !portal ? (
          <Panel>
            <Loading label="Checking your portal" />
          </Panel>
        ) : !portal ? (
          <Panel title="Portal unavailable">
            <p style={{ fontSize: 12, marginBottom: 12 }}>
              We could not load your portal status. This page retries on its own every few seconds.
            </p>
            <Btn onClick={() => void fetchStatus()}>
              <RefreshCw size={12} /> Try again
            </Btn>
          </Panel>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Panel>
              <div className="pr-stage">
                <PortalFrame
                  hasCore={hasCore}
                  hasFragment={hasFragment}
                  hasDiamonds={hasDiamonds}
                  stage={stage}
                />
              </div>
            </Panel>

            <Panel title="Requirements">
              <ul className="pr-reqs" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                <Requirement
                  met={hasCore}
                  label="Nether Core"
                  course="Lays the base"
                  have={portal.nether_core_count}
                  need={1}
                />
                <Requirement
                  met={hasFragment}
                  label="Portal Fragment"
                  course="Raises the pillars"
                  have={portal.has_fragment ? 1 : 0}
                  need={1}
                />
                <Requirement
                  met={hasDiamonds}
                  label="Diamonds"
                  course="Caps the lintel"
                  have={portal.diamond_count}
                  need={DIAMONDS_REQUIRED}
                />
              </ul>
              <p className="n-panel-sub" style={{ marginTop: 12 }}>
                Nothing is consumed by the repair. These are checked, not spent.
              </p>
            </Panel>

            <Panel title="How you earn these">
              <p style={{ fontSize: 12, lineHeight: 1.6 }}>
                The Round 4 games happen in the room, not on this screen. Organizers credit whatever your team earns —
                Diamonds, and the Portal Fragment — straight to your inventory, and it shows up in your resource
                history. There is nothing to submit here.
              </p>
            </Panel>

            {error && (
              <Panel>
                <p style={{ fontSize: 12, color: '#ff9db0' }}>{error}</p>
              </Panel>
            )}

            <Panel title={portal.is_repaired ? 'The portal is open' : 'Repair the portal'}>
              {portal.is_repaired ? (
                <>
                  <p style={{ fontSize: 12, marginBottom: 12 }}>
                    Your Nether Portal is repaired. The End is open — craft the Diamond Pickaxe there, then face the
                    Ender Dragon.
                  </p>
                  <Link
                    href="/round5"
                    className="n-btn n-btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Sparkles size={12} /> Enter The End
                  </Link>
                </>
              ) : isReady ? (
                <>
                  <p style={{ fontSize: 12, marginBottom: 12 }}>
                    Everything the portal needs is in your inventory. Repairing it unlocks Round 5.
                  </p>
                  <Btn variant="primary" onClick={() => void handleRepair()} disabled={repairing || igniting}>
                    <Flame size={12} /> {repairing || igniting ? 'Igniting…' : 'Repair Portal'}
                  </Btn>
                </>
              ) : (
                <p style={{ fontSize: 12 }}>
                  Still short of at least one requirement. This page updates itself as organizers credit your team —
                  you do not need to reload.
                </p>
              )}
            </Panel>

            <Link href="/dashboard" className="n-btn n-btn-secondary" style={{ alignSelf: 'flex-start' }}>
              Back to dashboard
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
