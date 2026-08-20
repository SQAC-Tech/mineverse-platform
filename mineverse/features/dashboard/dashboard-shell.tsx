'use client';

import './dashboard.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  ChevronRight,
  Clock,
  Flame,
  LogOut,
  ScrollText,
  Shield,
  Swords,
  Trophy,
} from 'lucide-react';

import { Hotbar } from '@/components/game/inventory/Hotbar';
import { Rulebook } from '@/features/dashboard/rulebook';
import { WorldMap } from '@/features/dashboard/world-map';
import { ResourceLedger } from '@/features/dashboard/resource-ledger';
import { SteveAvatar } from '@/features/dashboard/steve-avatar';
import { loadoutFrom } from '@/features/dashboard/gear';
import type { CraftedItem, DashboardProgress, DashboardRound, DashboardTeam } from '@/features/dashboard/types';
import { supabaseClient } from '@/lib/supabase/client';

/**
 * The dashboard.
 *
 * One fixed screen that never scrolls: chrome across the top, the stage in the
 * middle, the inventory along the bottom. Anything that needs more room than
 * that opens as a card over it — the map, the rulebook, the resource history —
 * and scrolls inside itself.
 *
 * Everything here is display-only. Dashboard state is never permission to act:
 * each round page calls `requireRoundAccess` and every mutation re-checks on the
 * server, so a chip that is stale is a cosmetic bug rather than a way in.
 */

/** How the timer reads before it drops under a minute. */
function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function DashboardShell() {
  const router = useRouter();

  const [team, setTeam] = useState<DashboardTeam | null>(null);
  const [rounds, setRounds] = useState<DashboardRound[]>([]);
  const [resources, setResources] = useState<Record<string, number>>({});
  const [crafted, setCrafted] = useState<CraftedItem[]>([]);
  const [progress, setProgress] = useState<DashboardProgress | null>(null);
  const [devUnlock, setDevUnlock] = useState(false);

  const [showMap, setShowMap] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [transitionTo, setTransitionTo] = useState<string | null>(null);

  const [slot, setSlot] = useState(1);

  /* The round timer counts against the server's clock, not the laptop's. A
     machine whose clock is ten minutes fast would otherwise close the round
     early for that team alone. State rather than a ref: the countdown reads it
     while rendering, and a ref read during render is not reactive. */
  const [clockSkew, setClockSkew] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard/data', { cache: 'no-store' });
      const payload = await response.json();
      if (!payload.success) return;

      if (payload.server_time) {
        const skew = Date.parse(payload.server_time) - Date.now();
        // Only when it actually moves — every poll would otherwise re-render for
        // a few milliseconds of jitter.
        setClockSkew((current) => (Math.abs(skew - current) > 1000 ? skew : current));
      }
      setTeam(payload.team ?? null);
      setRounds(payload.rounds ?? []);
      setResources(payload.resources ?? {});
      setCrafted(payload.crafted ?? []);
      setProgress(payload.progress ?? null);
      setDevUnlock(Boolean(payload.dev_unlock));
    } catch {
      // Keep the last good snapshot. Rounds stay locked until a fetch succeeds.
    }
  }, []);

  useEffect(() => {
    void load();
    const poll = window.setInterval(load, 10_000);
    return () => window.clearInterval(poll);
  }, [load]);

  // Refetch the moment an admin unlocks a round, rather than up to 10s later.
  useEffect(() => {
    const channel = supabaseClient
      .channel('round_status')
      .on('broadcast', { event: 'unlock' }, () => void load())
      .subscribe();
    return () => {
      void supabaseClient.removeChannel(channel);
    };
  }, [load]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  // Play the transition clip, then route. Muted retry covers autoplay policies.
  const transitionRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!transitionTo) return;
    const video = transitionRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.play().catch(() => {
      video.muted = true;
      void video.play().catch(() => undefined);
    });
  }, [transitionTo]);

  const loadout = useMemo(
    () => loadoutFrom({ crafted, portalRepaired: progress?.portal?.is_repaired ?? false }),
    [crafted, progress?.portal?.is_repaired],
  );

  /* The round a team is in right now: the first one it can enter and has not
     finished. Falling back to the last completed round keeps the chip showing
     where the team got to during a buffer, instead of going blank. */
  const activeRound = useMemo(() => {
    // Round 0 is the pre-event screening qualifier: no day, no biome, and not
    // something a team is "in" on event day. It is never the active round.
    const playable = rounds.filter((round) => round.round_id > 0);
    const open = playable.find((round) => round.can_enter && !round.completed_at);
    if (open) return open;
    return [...playable].reverse().find((round) => round.completed_at) ?? null;
  }, [rounds]);

  const remaining = useMemo(() => {
    if (!activeRound?.ends_at || activeRound.completed_at) return null;
    const left = Date.parse(activeRound.ends_at) - (now + clockSkew);
    return Number.isNaN(left) ? null : left;
  }, [activeRound, now, clockSkew]);

  /* Three states, not two: no window set, still running, and closed. A round
     whose `ends_at` has passed used to sit at a red 00:00 forever, which reads
     like a bug rather than like a round that is over. */
  const timer =
    remaining === null ? { text: '--:--', urgent: false }
      : remaining <= 0 ? { text: 'CLOSED', urgent: false }
        : { text: formatRemaining(remaining), urgent: remaining < 5 * 60_000 };

  const qualified = progress?.qualified_for_day2 ?? false;
  const portal = progress?.portal;

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
    }
  };

  return (
    <div className="dash">
      {/* Plain <img>: this is a full-bleed background, and next/image's sizing
          machinery buys nothing over object-fit here. */}
      <img className="dash__bg" src="/dashboard-world.webp" alt="" loading="eager" fetchPriority="high" aria-hidden="true" />
      <div className="dash__shade" aria-hidden="true" />

      {/* ── Top chrome ── */}
      <header className="dash__top">
        <div className="dash__brand">
          <img src="/font.svg" alt="Mineverse" />
        </div>

        <div className="dash__top-mid">
          <div className="d-panel d-chip d-chip--team">
            <span className="d-chip__icon">
              <Shield size={18} />
            </span>
            <span className="d-chip__body">
              <span className="d-chip__label">TEAM</span>
              <span className="d-chip__value">{team?.team_name ?? '—'}</span>
            </span>
            <span className="d-chip__body">
              <span className="d-chip__label">ID</span>
              <span className="d-chip__value">{team?.team_code ?? '—'}</span>
            </span>
          </div>

          <div className="d-panel d-chip d-chip--round">
            <span className="d-chip__body">
              <span className="d-chip__label">
                {activeRound?.day ? `DAY ${activeRound.day}` : 'MINEVERSE'}
              </span>
              <span className="d-chip__value">
                {activeRound ? `ROUND ${activeRound.round_id} · ${activeRound.name}` : 'STANDBY'}
              </span>
            </span>
          </div>

          <div className={timer.urgent ? 'd-panel d-chip d-chip--timer is-urgent' : 'd-panel d-chip d-chip--timer'}>
            <span className="d-chip__icon">
              <Clock size={18} />
            </span>
            <span className="d-chip__body">
              <span className="d-chip__label">TIME LEFT</span>
              <span className="d-chip__value">{timer.text}</span>
            </span>
          </div>
        </div>

        <div className="dash__top-end">
          {devUnlock && (
            <span className="d-dev">
              <Flame size={11} /> DEV MODE
            </span>
          )}
          <button type="button" className="d-panel d-icon-btn" onClick={logout} title="Log out" aria-label="Log out">
            <LogOut size={17} />
          </button>
        </div>
      </header>

      {/* ── Stage ── */}
      <main className="dash__stage">
        <section className="dash__hero">
          <SteveAvatar loadout={loadout} />
          <div className="d-panel dash__gear">
            <b>{loadout.title}</b>
            <span>{loadout.caption}</span>
          </div>

          <div className="dash__pills">
            <div className={progress?.pvp_eligible ? 'd-pill d-pill--on' : 'd-pill'}>
              <Swords size={11} />
              {progress?.pvp_eligible ? 'PvP eligible' : 'PvP needs Iron Armor'}
            </div>
            <div className={qualified ? 'd-pill d-pill--on' : progress?.elimination_reason ? 'd-pill d-pill--bad' : 'd-pill'}>
              <Trophy size={11} />
              {qualified ? 'Qualified for Day 2' : progress?.elimination_reason || 'Day 2 not decided yet'}
            </div>
            {/* Before qualification the portal is noise, not information. */}
            {qualified && portal && (
              <div className={portal.is_repaired ? 'd-pill d-pill--on' : 'd-pill d-pill--warn'}>
                <Flame size={11} />
                {portal.is_repaired
                  ? 'Nether Portal repaired'
                  : portal.state === 'ready'
                    ? 'Portal ready to repair'
                    : `Portal needs ${portal.missing.join(', ')}`}
              </div>
            )}
          </div>
        </section>

        <section className="dash__centre">
          <div className="dash__enter-wrap">
            <button type="button" className="d-enter" onClick={() => setShowMap(true)}>
              ENTER WORLD
            </button>
            {/* Decorative portal motes. */}
            {[
              { left: '4%', top: '62%', delay: '0s' },
              { left: '14%', top: '18%', delay: '0.7s' },
              { left: '88%', top: '30%', delay: '1.3s' },
              { left: '96%', top: '70%', delay: '2s' },
              { left: '48%', top: '96%', delay: '2.6s' },
              { left: '66%', top: '4%', delay: '1.7s' },
            ].map((mote) => (
              <span
                key={mote.delay + mote.left}
                className="d-mote"
                aria-hidden="true"
                style={{ left: mote.left, top: mote.top, animationDelay: mote.delay }}
              />
            ))}
          </div>

          <div className="dash__enter-sub">✧ OPEN MINEVERSE MAP ✧</div>

          <div className="d-panel dash__steps">
            <span>Explore</span>
            <span>Complete challenges</span>
            <span>Earn resources</span>
            <span>Defeat guardians</span>
          </div>
        </section>

        <nav className="dash__rail" aria-label="Dashboard links">
          <button type="button" className="d-panel d-card d-card--rules" onClick={() => setShowRules(true)}>
            <span className="d-card__icon">
              <ScrollText size={22} />
            </span>
            <span className="d-card__body">
              <b>RULEBOOK</b>
              <span>Rules, rounds, question types and prices.</span>
            </span>
            <ChevronRight size={17} className="d-card__chev" />
          </button>

          <a href="/leaderboard" className="d-panel d-card d-card--board">
            <span className="d-card__icon">
              <BarChart3 size={22} />
            </span>
            <span className="d-card__body">
              <b>LEADERBOARD</b>
              <span>Where your team stands right now.</span>
            </span>
            <ChevronRight size={17} className="d-card__chev" />
          </a>

          <a href="/qualification" className="d-panel d-card d-card--qual">
            <span className="d-card__icon">
              <Trophy size={22} />
            </span>
            <span className="d-card__body">
              <b>QUALIFICATION</b>
              <span>Day 2 status and what it turns on.</span>
            </span>
            <ChevronRight size={17} className="d-card__chev" />
          </a>

          {/* Day 2 only — the portal page rejects everyone else anyway. */}
          {qualified && (
            <a href="/portal" className="d-panel d-card d-card--portal">
              <span className="d-card__icon">
                <Flame size={22} />
              </span>
              <span className="d-card__body">
                <b>NETHER PORTAL</b>
                <span>Repair it to open The End.</span>
              </span>
              <ChevronRight size={17} className="d-card__chev" />
            </a>
          )}
        </nav>
      </main>

      {/* ── Inventory ── */}
      <footer className="dash__foot">
        <section className="d-panel dash__inv">
          <div className="dash__inv-head">
            <b>INVENTORY</b>
            <span>Live resource balance</span>
          </div>
          <Hotbar balance={resources} activeSlot={slot} onSelect={setSlot} maxWidth="min(640px, 100%)" />
        </section>

        <div className="dash__foot-actions">
          <button type="button" className="d-btn" onClick={() => setShowLedger(true)}>
            <ScrollText size={12} /> RESOURCE HISTORY
          </button>
        </div>
      </footer>

      {/* ── Overlays ── */}
      {showMap && (
        <WorldMap
          rounds={rounds}
          onClose={() => setShowMap(false)}
          onEnter={(path) => setTransitionTo(path)}
        />
      )}
      {showRules && <Rulebook onClose={() => setShowRules(false)} />}
      {showLedger && <ResourceLedger onClose={() => setShowLedger(false)} />}

      {transitionTo && (
        <div className="dash__transition">
          <video
            ref={transitionRef}
            src="/transition1.mp4"
            autoPlay
            playsInline
            onEnded={() => router.push(transitionTo)}
          />
          <button type="button" className="dash__skip" onClick={() => router.push(transitionTo)}>
            SKIP ›
          </button>
        </div>
      )}
    </div>
  );
}
