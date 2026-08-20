'use client';

import './dashboard.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, LogOut, Shield } from 'lucide-react';

import { Hotbar } from '@/components/game/inventory/Hotbar';
import { roundChrome } from '@/components/game/custom-round-ui/round-presentation';
import { Rulebook } from '@/features/dashboard/rulebook';
import { WorldMap } from '@/features/dashboard/world-map';
import { SteveAvatar } from '@/features/dashboard/steve-avatar';
import { CraftingTable } from '@/features/dashboard/crafting-table';
import { loadoutFrom } from '@/features/dashboard/gear';
import type { CraftedItem, DashboardProgress, DashboardRound, DashboardTeam } from '@/features/dashboard/types';
import { supabaseClient } from '@/lib/supabase/client';

/**
 * The dashboard.
 *
 * One fixed screen that never scrolls: chrome across the top, Steve and the two
 * actions in the middle, the inventory along the bottom. The map and the
 * rulebook open over it and scroll inside themselves.
 *
 * Everything here is display-only. Dashboard state is never permission to act:
 * each round page calls `requireRoundAccess` and every mutation re-checks on the
 * server, so a chip that is stale is a cosmetic bug rather than a way in.
 */
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
  const [transitionTo, setTransitionTo] = useState<string | null>(null);
  const [slot, setSlot] = useState(1);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard/data', { cache: 'no-store' });
      const payload = await response.json();
      if (!payload.success) return;

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

  /* The crafting log as bare item ids, which is what the gate check wants. */
  const craftedItems = useMemo(
    () => crafted.filter((entry) => entry.crafted).map((entry) => entry.item),
    [crafted],
  );

  // The biome's own icon, from the catalog the round header draws with.
  const RoundIcon = roundChrome(activeRound?.round_id ?? 1).Icon;

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

          <div className="d-round">
            <span className="d-round__icon">
              <RoundIcon size={21} />
            </span>
            <span className="d-round__body">
              <span className="d-round__eyebrow">
                {activeRound ? `DAY ${activeRound.day ?? 1} · ROUND ${activeRound.round_id}` : 'MINEVERSE'}
              </span>
              <span className="d-round__name">{activeRound?.name ?? 'Standby'}</span>
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
        {/* Absolute, bottom-left: Steve stands on the terrain instead of being a
            grid cell that centres him in mid-air. */}
        <section className="dash__hero">
          <SteveAvatar loadout={loadout} />
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

          {/* Caption for the button above it, which is why it sits between the
              two rather than under the pair. */}
          <div className="dash__enter-sub">✧ OPEN MINEVERSE MAP ✧</div>

          <button type="button" className="d-enter d-enter--rules" onClick={() => setShowRules(true)}>
            RULEBOOK
          </button>

          {/* Straight on the background, no panel behind it. */}
          <div className="dash__steps">
            <span>Explore</span>
            <span>Complete challenges</span>
            <span>Earn resources</span>
            <span>Defeat guardians</span>
          </div>
        </section>

        {/* Bottom-right, mirroring Steve. Crafting is not round-scoped — the
            craft route only needs a session — so the bench belongs here too. */}
        <CraftingTable
          balance={resources}
          crafted={craftedItems}
          qualifiedForDay2={progress?.qualified_for_day2 ?? false}
          portalRepaired={progress?.portal?.is_repaired ?? false}
          onCrafted={load}
        />
      </main>

      {/* ── Inventory ── */}
      <footer className="dash__foot">
        <Hotbar balance={resources} activeSlot={slot} onSelect={setSlot} maxWidth="min(600px, 100%)" />
      </footer>

      {/* ── Overlays ── */}
      {showMap && <WorldMap rounds={rounds} onClose={() => setShowMap(false)} onEnter={(path) => setTransitionTo(path)} />}
      {showRules && <Rulebook onClose={() => setShowRules(false)} />}

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
