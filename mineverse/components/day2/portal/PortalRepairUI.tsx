'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Check, Flame, RefreshCw, Sword } from 'lucide-react';
import { roundChrome } from '@/components/game/custom-round-ui/round-presentation';
import { PortalFrame } from '@/components/day2/portal/PortalFrame';
import { stageFor } from '@/components/day2/portal/portal-layout';
// The kit and the palette are imported here, not left to a layout. `/portal`
// lives in the (day2) group, which has no layout, so it loaded neither — every
// token resolved to nothing, panels went transparent and the text fell back to
// the global near-black on a dark scene.
import '@/app/theme-kit.css';
import '@/app/(game)/biome.css';
import '@/components/game/custom-round-ui/round-ui.css';
import './portal-repair.css';

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

/* Two of the three materials have no sprite in /public, so they are drawn here
   rather than borrowing an unrelated icon. */
function CoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2 3 7v10l9 5 9-5V7z" fill="#3b1d63" stroke="#a86bf0" strokeWidth="1.4" />
      <path d="M12 2v20M3 7l9 5 9-5" stroke="#c9a0ff" strokeWidth="1" opacity=".75" fill="none" />
      <circle cx="12" cy="12" r="2.6" fill="#e0c2ff" />
    </svg>
  );
}

function FragmentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13 2 5 13h5l-2 9 10-12h-5z" fill="#7a2bbd" stroke="#d9b6ff" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

interface Material {
  key: string;
  name: string;
  sub: string;
  have: number;
  need: number;
  icon: React.ReactNode;
}

function ProgressRing({ percent }: { percent: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="pr-ring">
      <svg viewBox="0 0 100 100">
        <circle className="pr-ring__track" cx="50" cy="50" r={radius} />
        <circle
          className="pr-ring__value"
          cx="50"
          cy="50"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
        />
      </svg>
      <div className="pr-ring__label">
        <div className="pr-ring__pct">{percent}%</div>
        <div className="pr-ring__word">COMPLETE</div>
      </div>
    </div>
  );
}

/**
 * Round 4's only on-platform action.
 *
 * The physical games are run and judged in the room; organizers credit Diamonds
 * and the Portal Fragment from /admin/resources. There is deliberately no
 * activity list or result-entry form here — a team entering its own results is
 * exactly what the event does not want, and it is why this screen is so short
 * on words.
 *
 * The repair is one server-validated call. Nothing about eligibility is decided
 * here: the button only appears once the server says every material is held, and
 * the endpoint re-checks regardless. The ignition animation runs *after* the
 * server has confirmed, so it can never show a portal that is not open.
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
    // Organizer grants land out of band, so the materials have to keep up.
    const interval = window.setInterval(fetchStatus, 5000);
    return () => window.clearInterval(interval);
  }, [fetchStatus]);

  useEffect(
    () => () => {
      if (igniteTimer.current) window.clearTimeout(igniteTimer.current);
    },
    [],
  );

  const handleRepair = async () => {
    setRepairing(true);
    setError('');
    try {
      const res = await fetch('/api/team/portal/repair', { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'The server refused the repair.');
        return;
      }
      // Server said yes — play the ignition, then settle into the repaired state
      // once the refetch has landed underneath it.
      setIgniting(true);
      igniteTimer.current = window.setTimeout(() => setIgniting(false), IGNITION_MS);
      await fetchStatus();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setRepairing(false);
    }
  };

  const { themeClass } = roundChrome(4);
  const portal = status?.portal;

  const cores = portal?.nether_core_count ?? 0;
  const diamonds = portal?.diamond_count ?? 0;
  const hasCore = cores >= 1;
  const hasFragment = Boolean(portal?.has_fragment);
  const hasDiamonds = diamonds >= DIAMONDS_REQUIRED;
  const isRepaired = Boolean(portal?.is_repaired);
  const stage = stageFor({ hasCore, hasFragment, hasDiamonds }, { isRepaired, isIgniting: igniting });

  const materials: Material[] = [
    { key: 'core', name: 'Nether Core', sub: 'Activates the base', have: cores, need: 1, icon: <CoreIcon /> },
    {
      key: 'fragment',
      name: 'Portal Fragment',
      sub: 'Raises the pillars',
      have: hasFragment ? 1 : 0,
      need: 1,
      icon: <FragmentIcon />,
    },
    {
      key: 'diamond',
      name: 'Diamonds',
      sub: 'Caps the lintel',
      have: diamonds,
      need: DIAMONDS_REQUIRED,
      icon: <Image src="/diamond.svg" alt="" width={26} height={26} />,
    },
  ];

  // Four steps, the last being the repair itself — holding every material is not
  // the same as having lit the portal.
  const steps = [
    { label: 'Base activated', done: hasCore },
    { label: 'Pillars restored', done: hasFragment },
    { label: 'Lintel capped', done: hasDiamonds },
    { label: 'Portal stabilized', done: isRepaired },
  ];
  const percent = Math.round((steps.filter((step) => step.done).length / steps.length) * 100);

  const missing = materials.filter((material) => material.have < material.need).length;
  // An igniting portal is already past every gate, so the status reads warm
  // rather than falling back to the collecting tone mid-animation.
  const armed = isRepaired || stage === 'igniting' || stage === 'ready';
  const tone = stage === 'igniting' ? 'ready' : isRepaired ? 'repaired' : armed ? 'ready' : 'waiting';

  return (
    <main className={`biome round-ui-scene ${themeClass}`}>
      <div className="round-ui-scene__backdrop" aria-hidden="true" />
      <div className="round-ui-scene__shade" aria-hidden="true" />
      <div className="round-ui-scene__scrim" aria-hidden="true" />

      <div className="pr-page">
        <header className="pr-head">
          <span className="pr-head__eyebrow">
            <Flame size={15} /> ROUND 4
          </span>
          <h1 className="pr-head__title">NETHER PORTAL REPAIR</h1>
          <p className="pr-head__sub">
            {stage === 'igniting'
              ? 'The obsidian is catching.'
              : isRepaired
                ? 'The portal is restored. The path to The End is open.'
                : stage === 'ready'
                  ? 'Every material is in hand. Light it.'
                  : 'Organizers credit what your team wins in the hall.'}
          </p>
          <div className="pr-status" data-tone={tone}>
            {isRepaired && stage !== 'igniting' && <Check size={13} />}
            {stage === 'igniting' ? 'IGNITING' : isRepaired ? 'REPAIRED' : stage === 'ready' ? 'READY' : 'COLLECTING'}
          </div>
        </header>

        <div className="pr-stage">
          <section className="pr-panel">
            <h2 className="pr-panel__title">REQUIRED MATERIALS</h2>
            <ul className="pr-mats">
              {materials.map((material) => {
                const met = material.have >= material.need;
                return (
                  <li key={material.key} className="pr-mat" data-met={String(met)}>
                    <span className="pr-mat__icon">{material.icon}</span>
                    <span>
                      <span className="pr-mat__name">{material.name}</span>
                      <span className="pr-mat__sub">{material.sub}</span>
                    </span>
                    <span className="pr-mat__right">
                      <span className="pr-mat__count">
                        {Math.min(material.have, material.need)}/{material.need}
                      </span>
                      {met && <Check size={14} style={{ color: '#6cdc8a' }} />}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="pr-centre">
            <PortalFrame hasCore={hasCore} hasFragment={hasFragment} hasDiamonds={hasDiamonds} stage={stage} />
          </div>

          <section className="pr-panel">
            <h2 className="pr-panel__title">REPAIR PROGRESS</h2>
            <div className="pr-progress">
              <ProgressRing percent={percent} />
              <ul className="pr-steps">
                {steps.map((step) => (
                  <li key={step.label} className="pr-step" data-done={String(step.done)}>
                    <Check size={14} style={{ color: step.done ? '#6cdc8a' : '#4a4550', flexShrink: 0 }} />
                    {step.label}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <footer className="pr-foot">
          <Link href="/" className="pr-back">
            <ArrowLeft size={13} /> BACK TO HOME
          </Link>

          <div className="pr-mission">
            {loading && !portal ? (
              <p className="pr-mission__body" style={{ margin: 0 }}>
                Checking your portal…
              </p>
            ) : !portal ? (
              <>
                <h2 className="pr-mission__title">PORTAL UNAVAILABLE</h2>
                <p className="pr-mission__body">This page retries on its own every few seconds.</p>
                <button type="button" className="pr-cta pr-cta--ignite" onClick={() => void fetchStatus()}>
                  <RefreshCw size={16} /> TRY AGAIN
                </button>
              </>
            ) : stage === 'igniting' ? (
              <>
                <h2 className="pr-mission__title">IGNITING</h2>
                <p className="pr-mission__body">The obsidian is catching. Stand back.</p>
                <button type="button" className="pr-cta pr-cta--ignite" disabled>
                  <Flame size={18} /> IGNITING…
                </button>
              </>
            ) : isRepaired ? (
              <>
                <h2 className="pr-mission__title">MISSION COMPLETE</h2>
                <p className="pr-mission__body">
                  The End awaits. Craft the Diamond Pickaxe, then face the Ender Dragon.
                </p>
                <Link href="/round5" className="pr-cta">
                  <Sword size={18} /> ENTER THE END
                </Link>
              </>
            ) : stage === 'ready' ? (
              <>
                <h2 className="pr-mission__title">READY TO IGNITE</h2>
                <p className="pr-mission__body">
                  {error || 'Nothing is consumed — your materials are checked, not spent.'}
                </p>
                <button
                  type="button"
                  className="pr-cta pr-cta--ignite"
                  onClick={() => void handleRepair()}
                  disabled={repairing || igniting}
                >
                  <Flame size={18} /> {repairing || igniting ? 'IGNITING…' : 'REPAIR PORTAL'}
                </button>
              </>
            ) : (
              <>
                <h2 className="pr-mission__title">MATERIALS MISSING</h2>
                <p className="pr-mission__body" style={{ marginBottom: 0 }}>
                  {error || `Waiting on ${missing} material${missing === 1 ? '' : 's'}. This screen updates itself.`}
                </p>
              </>
            )}
          </div>
        </footer>
      </div>
    </main>
  );
}
