'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Swords, X } from 'lucide-react';
import { supabaseClient } from '@/lib/supabase/client';
import './pvp-search.css';

/**
 * Finding an opponent, on the dashboard, without opening the arena first.
 *
 * The old flow put a team inside a round screen to press a button that put them
 * in a queue — so the arena existed before the duel did, and a team sat in an
 * empty one wondering whether anything had happened. Here the search is the
 * whole screen: press ENTER PVP, watch it look, and walk into the arena only
 * once there is somebody in it.
 *
 * ## How the pairing arrives
 *
 * Two ways, deliberately. The realtime `match_started` broadcast is what makes
 * it land the instant the server pairs them; the poll underneath is what makes
 * it land at all if the socket dropped. The poll is slow (three seconds)
 * because it is the fallback, not the mechanism.
 */

const POLL_MS = 3_000;

/** How long the team gets to press ENTER ARENA before they are taken in anyway. */
const AUTO_ENTER_SECONDS = 5;

export interface PvpSearchProps {
  /** Where the duel is played. */
  arenaHref: string;
  /** Leaving the search — only offered while still unpaired. */
  onCancel: () => void;
}

type Phase = 'searching' | 'found';

export function PvpSearch({ arenaHref, onCancel }: PvpSearchProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('searching');
  const [countdown, setCountdown] = useState(AUTO_ENTER_SECONDS);
  const [waited, setWaited] = useState(0);

  // The arena is entered exactly once, whichever of the three routes gets there
  // first: the button, the countdown, or a second poll landing mid-navigation.
  const enteredRef = useRef(false);
  const enterArena = useCallback(() => {
    if (enteredRef.current) return;
    enteredRef.current = true;
    router.push(arenaHref);
  }, [router, arenaHref]);

  const check = useCallback(async () => {
    try {
      const response = await fetch('/api/team/pvp/eligibility', { cache: 'no-store' });
      const payload = await response.json();
      if (!payload.success) return;

      const { match_id: matchId, match_status: matchStatus } = payload.data;
      // A resolved duel is not something to walk into. The arena shows the
      // result for a team that goes back to it, but the search must not send
      // anyone there as though a new match had been found.
      if (matchId && matchStatus === 'live') setPhase('found');
    } catch {
      // Offline for a tick. The next poll picks it up.
    }
  }, []);

  useEffect(() => {
    if (phase !== 'searching') return;
    void check();
    const poll = window.setInterval(() => void check(), POLL_MS);
    const elapsed = window.setInterval(() => setWaited((value) => value + 1), 1_000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(elapsed);
    };
  }, [phase, check]);

  // The fast path. Without it a team waits up to a full poll to be told about a
  // duel the server already started.
  useEffect(() => {
    if (phase !== 'searching') return;
    const channel = supabaseClient
      .channel('pvp_notifications')
      .on('broadcast', { event: 'match_started' }, () => void check())
      .subscribe();
    return () => {
      void supabaseClient.removeChannel(channel);
    };
  }, [phase, check]);

  useEffect(() => {
    if (phase !== 'found') return;
    const tick = window.setInterval(() => {
      setCountdown((value) => {
        if (value <= 1) {
          window.clearInterval(tick);
          enterArena();
          return 0;
        }
        return value - 1;
      });
    }, 1_000);
    return () => window.clearInterval(tick);
  }, [phase, enterArena]);

  const minutes = Math.floor(waited / 60);
  const seconds = waited % 60;

  return (
    <div className="pvpq" role="dialog" aria-modal="true" aria-label="Finding an opponent">
      <div className="pvpq__scrim" aria-hidden="true" />

      <div className="pvpq__panel">
        {phase === 'searching' ? (
          <>
            <div className="pvpq__glass-stage" aria-hidden="true">
              {/* The lens sweeps; the marks underneath are what it sweeps over.
                  Both are decoration — the status is announced in text below. */}
              <span className="pvpq__spark pvpq__spark--a" />
              <span className="pvpq__spark pvpq__spark--b" />
              <span className="pvpq__spark pvpq__spark--c" />
              <img className="pvpq__glass" src="/pvp/magnifier.webp" alt="" />
            </div>

            <h2 className="pvpq__title">SEARCHING FOR A MATCH</h2>
            <p className="pvpq__sub" role="status">
              Looking for a team of your year and standing…
            </p>
            <p className="pvpq__timer">
              {minutes > 0 ? `${minutes}m ` : ''}{seconds}s
            </p>

            <button type="button" className="pvpq__cancel" onClick={onCancel}>
              <X size={14} aria-hidden="true" /> Leave the queue
            </button>
          </>
        ) : (
          <>
            <div className="pvpq__glass-stage pvpq__glass-stage--found" aria-hidden="true">
              <Swords className="pvpq__swords" size={92} />
            </div>

            <h2 className="pvpq__title pvpq__title--found">OPPONENT FOUND</h2>
            <p className="pvpq__sub" role="status">
              Entering the arena in {countdown}…
            </p>

            <button type="button" className="pvpq__enter" onClick={enterArena} autoFocus>
              <Swords size={16} aria-hidden="true" /> ENTER ARENA
            </button>
            <p className="pvpq__note">You will be taken in automatically.</p>
          </>
        )}
      </div>
    </div>
  );
}
