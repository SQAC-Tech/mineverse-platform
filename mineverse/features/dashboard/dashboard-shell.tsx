'use client';

import './dashboard.css';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Flame, LogOut, Shield, ShoppingBag, Sparkles } from 'lucide-react';

import { Hotbar } from '@/components/game/inventory/Hotbar';
import { roundChrome } from '@/components/game/custom-round-ui/round-presentation';
import { Rulebook } from '@/features/dashboard/rulebook';
import { WorldMap } from '@/features/dashboard/world-map';
import { SteveAvatar } from '@/features/dashboard/steve-avatar';
import { CraftingTable } from '@/features/dashboard/crafting-table';
import { DashOverlay } from '@/features/dashboard/dash-overlay';
import { MarketplaceStore } from '@/components/game/marketplace/MarketplaceStore';
import { ConsumableInventory } from '@/components/game/marketplace/ConsumableInventory';
import { ChoicePanel } from '@/components/game/choices/ChoicePanel';
import { loadoutFrom } from '@/features/dashboard/gear';
import type { CraftedItem, DashboardProgress, DashboardRound, DashboardTeam, DashboardTrader } from '@/features/dashboard/types';
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
/** The traders' proper names, for when only one of them is waiting. */
const TRADER_LABELS: Record<DashboardTrader['key'], string> = {
  ancient_shrine: 'Ancient Shrine',
  piglin_merchant: 'Piglin Merchant',
};

export function DashboardShell() {
  const router = useRouter();

  const [team, setTeam] = useState<DashboardTeam | null>(null);
  const [rounds, setRounds] = useState<DashboardRound[]>([]);
  const [resources, setResources] = useState<Record<string, number>>({});
  const [crafted, setCrafted] = useState<CraftedItem[]>([]);
  const [progress, setProgress] = useState<DashboardProgress | null>(null);
  const [devUnlock, setDevUnlock] = useState(false);

  const [marketOpen, setMarketOpen] = useState(false);
  const [traders, setTraders] = useState<DashboardTrader[]>([]);

  const [showMap, setShowMap] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showMarket, setShowMarket] = useState(false);
  const [showTrader, setShowTrader] = useState(false);
  const [slot, setSlot] = useState(1);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard/data', { cache: 'no-store' });
      const payload = await response.json();

      // A 401 mid-poll means the session ended under us — it expired, or the
      // team signed in somewhere else and this device lost the seat. Sitting on
      // the last good snapshot would leave a dashboard that looks live and can
      // open nothing, so send them to the login screen with the reason.
      if (response.status === 401) {
        if (typeof payload.message === 'string') toast.error(payload.message, { duration: 8000 });
        router.push('/login');
        return;
      }

      /**
       * A refused dashboard has to say so.
       *
       * This returned silently on any failure, which meant an entitlement 403
       * rendered as a dashboard stuck on empty — no team name, no rounds, no
       * reason. Every team hit exactly that when the RSVP gate refused all
       * fifty of them, and from the outside it looked like data not loading.
       */
      if (!payload.success) {
        if (response.status === 403 && typeof payload.message === 'string') {
          toast.error(payload.message, { id: 'dashboard-entitlement', duration: 10000 });
        }
        return;
      }

      setTeam(payload.team ?? null);
      setRounds(payload.rounds ?? []);
      setResources(payload.resources ?? {});
      setCrafted(payload.crafted ?? []);
      setProgress(payload.progress ?? null);
      setDevUnlock(Boolean(payload.dev_unlock));
      setMarketOpen(Boolean(payload.market?.open));
      setTraders(payload.traders ?? []);
    } catch {
      // Keep the last good snapshot. Rounds stay locked until a fetch succeeds.
    }
  }, [router]);

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

  /* Only traders whose round has opened. A locked one is not worth a button. */
  const openTraders = useMemo(() => traders.filter((trader) => trader.open), [traders]);

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
      {/* Drifting motes over the scene. Two elements, each carrying a field of
          box-shadow stamps, so "lively" costs no DOM and nothing to lay out. */}
      <div className="dash__ambience" aria-hidden="true" />

      {/* ── Top chrome ── */}
      {/* Three zones: team on the left, wordmark in the middle, round on the
          right. A 1fr/auto/1fr grid rather than flex, so the wordmark is
          centred on the page and not on whatever the two sides happen to
          weigh. */}
      <header className="dash__top">
        <div className="dash__top-left">
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
        </div>

        <div className="dash__brand">
          <img src="/font.svg" alt="Mineverse" />
        </div>

        <div className="dash__top-right">
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

            {/* Out of flow, hanging under the button. In the column these two
                counted toward the centring and pushed ENTER WORLD about 30px
                above the stage's middle; absolute, the button is the only thing
                being centred and lands on the line. */}
            <div className="dash__enter-below">
              <div className="dash__enter-sub">✧ OPEN MINEVERSE MAP ✧</div>

              {/* Straight on the background, no panel behind it. */}
              <div className="dash__steps">
                <span>Explore</span>
                <span>Complete challenges</span>
                <span>Earn resources</span>
                <span>Defeat guardians</span>
              </div>
            </div>
          </div>
        </section>

        {/* Trading lives here now, not inside a round: the marketplace and the
            traders are between-rounds decisions made with the round's takings
            in hand, and a team should not be spending its timed round on them. */}
        <div className="dash__shops">
          <button
            type="button"
            className="dash__shop"
            disabled={!marketOpen}
            title={marketOpen ? 'Trade emeralds with the Villager Merchant' : 'The marketplace opens in the Cave Biome'}
            onClick={() => setShowMarket(true)}
          >
            <ShoppingBag size={13} aria-hidden="true" />
            MARKETPLACE
          </button>

          <button
            type="button"
            className="dash__shop"
            disabled={openTraders.length === 0}
            title={openTraders.length > 0 ? 'A trader is waiting' : 'No trader has arrived yet'}
            onClick={() => setShowTrader(true)}
          >
            <Sparkles size={13} aria-hidden="true" />
            {openTraders.length > 0 ? `TRADER (${openTraders.length})` : 'TRADER'}
          </button>
        </div>

        <button type="button" className="d-enter d-enter--rules" onClick={() => setShowRules(true)}>
          RULEBOOK
        </button>

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
        {/* `crafted` was fetched, used for the avatar's loadout, and then not
            handed to the inventory — so a pickaxe a team had just crafted was
            missing from the one place they would look for it. */}
        <Hotbar balance={resources} crafted={crafted} activeSlot={slot} onSelect={setSlot} maxWidth="min(600px, 100%)" />
      </footer>

      {/* ── Overlays ── */}
      {showMap && <WorldMap rounds={rounds} onClose={() => setShowMap(false)} onEnter={(path) => router.push(path)} />}
      {showRules && <Rulebook onClose={() => setShowRules(false)} />}

      {showMarket && (
        <DashOverlay
          title="Marketplace"
          subtitle="The Villager Merchant trades knowledge and supplies for Emeralds. Open all event."
          onClose={() => setShowMarket(false)}
        >
          <MarketplaceStore onPurchased={load} />
          <ConsumableInventory onUsed={load} />
        </DashOverlay>
      )}

      {showTrader && (
        <DashOverlay
          title={openTraders.length === 1 ? TRADER_LABELS[openTraders[0].key] : 'Traders'}
          subtitle="One decision each, and it cannot be taken back."
          onClose={() => setShowTrader(false)}
        >
          {openTraders.map((trader) => (
            <ChoicePanel key={trader.key} choiceKey={trader.key} onDecided={load} />
          ))}
        </DashOverlay>
      )}

    </div>
  );
}
