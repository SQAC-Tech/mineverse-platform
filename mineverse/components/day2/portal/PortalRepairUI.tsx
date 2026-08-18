'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, X, Flame, RefreshCw, Sparkles } from 'lucide-react';
import { Panel, Btn, Loading, Pill } from '@/components/admin/nether-ui';
import { roundChrome } from '@/components/game/custom-round-ui/round-presentation';
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

function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, padding: '7px 0' }}>
      {met ? (
        <Check size={14} style={{ color: '#6cc244', flexShrink: 0 }} />
      ) : (
        <X size={14} style={{ color: '#e05b4b', flexShrink: 0 }} />
      )}
      <span style={{ color: met ? 'var(--text-onDark)' : '#c9b7b4' }}>{label}</span>
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
 * The repair itself is one server-validated call. Nothing about eligibility is
 * decided here: the button only appears once the server says `ready`, and the
 * endpoint re-checks anyway.
 */
export function PortalRepairUI() {
  const [status, setStatus] = useState<Day2Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [repairing, setRepairing] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/team/day2/status', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) setStatus(data);
      }
    } catch {
      // Keep the last good snapshot on screen; the poll below will retry.
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

  const handleRepair = async () => {
    setRepairing(true);
    setError('');
    try {
      const res = await fetch('/api/team/portal/repair', { method: 'POST' });
      const data = await res.json();
      if (data.success) await fetchStatus();
      else setError(data.error || 'Failed to repair the portal.');
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setRepairing(false);
    }
  };

  const { themeClass } = roundChrome(4);
  const portal = status?.portal;

  return (
    <main className={`biome round-ui-scene ${themeClass}`} style={{ minHeight: '100vh' }}>
      <div className="round-ui-scene__backdrop" aria-hidden="true" />
      <div className="round-ui-scene__shade" aria-hidden="true" />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 16px 48px' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <Flame size={22} style={{ color: 'var(--accent-primary)' }} />
          <div style={{ marginRight: 'auto' }}>
            <div className="n-stat-label">Round 4</div>
            <h1 style={{ fontSize: 20, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-onDark)' }}>
              Nether Portal Repair
            </h1>
          </div>
          {portal && (
            <Pill tone={portal.is_repaired ? 'ok' : portal.state === 'ready' ? 'live' : 'idle'}>
              {portal.is_repaired ? 'Repaired' : portal.state === 'ready' ? 'Ready' : 'Collecting'}
            </Pill>
          )}
        </header>

        {loading && !portal ? (
          <Panel>
            <Loading label="Checking your portal" />
          </Panel>
        ) : !portal ? (
          <Panel title="Portal unavailable">
            <p style={{ fontSize: 11.5, marginBottom: 12 }}>
              We could not load your portal status. This page retries on its own every few seconds.
            </p>
            <Btn onClick={() => void fetchStatus()}>
              <RefreshCw size={12} /> Try again
            </Btn>
          </Panel>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Panel title="Requirements">
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                <Requirement met={portal.nether_core_count >= 1} label={`Nether Core — ${Math.min(portal.nether_core_count, 1)}/1`} />
                <Requirement met={portal.has_fragment} label={`Portal Fragment — ${portal.has_fragment ? 1 : 0}/1`} />
                <Requirement
                  met={portal.diamond_count >= DIAMONDS_REQUIRED}
                  label={`Diamonds — ${portal.diamond_count}/${DIAMONDS_REQUIRED}`}
                />
              </ul>
              <p className="n-panel-sub" style={{ marginTop: 12 }}>
                Nothing is consumed by the repair. These are checked, not spent.
              </p>
            </Panel>

            <Panel title="How you earn these">
              <p style={{ fontSize: 11.5, lineHeight: 1.6 }}>
                The Round 4 games happen in the room, not on this screen. Organizers credit whatever your team earns —
                Diamonds, and the Portal Fragment — straight to your inventory, and it shows up in your resource
                history. There is nothing to submit here.
              </p>
            </Panel>

            {error && (
              <Panel>
                <p style={{ fontSize: 11.5, color: '#ff9db0' }}>{error}</p>
              </Panel>
            )}

            <Panel title={portal.is_repaired ? 'The portal is open' : 'Repair the portal'}>
              {portal.is_repaired ? (
                <>
                  <p style={{ fontSize: 11.5, marginBottom: 12 }}>
                    Your Nether Portal is repaired. The End is open — craft the Diamond Pickaxe there, then face the
                    Ender Dragon.
                  </p>
                  <Link href="/round5" className="n-btn n-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={12} /> Enter The End
                  </Link>
                </>
              ) : portal.state === 'ready' ? (
                <>
                  <p style={{ fontSize: 11.5, marginBottom: 12 }}>
                    Everything the portal needs is in your inventory. Repairing it unlocks Round 5.
                  </p>
                  <Btn variant="primary" onClick={() => void handleRepair()} disabled={repairing}>
                    <Flame size={12} /> {repairing ? 'Repairing…' : 'Repair Portal'}
                  </Btn>
                </>
              ) : (
                <p style={{ fontSize: 11.5 }}>
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
