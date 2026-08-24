'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Swords, Loader2 } from 'lucide-react';
import { supabaseClient } from '@/lib/supabase/client';
import { PvpArena } from './PvpArena';
import type { PvpMatch } from './types';
import './pvp-search.css';

/**
 * The duel screen's data, separated from the duel screen's chrome.
 *
 * `PvpArena` draws a match. This decides which match, keeps it current, and
 * handles the two states that are not a match at all — still loading, and
 * nothing to play. Splitting them keeps the arena a pure render of whatever it
 * is handed, which is what makes the result screen and the live screen the same
 * component.
 *
 * ## Why it polls at all
 *
 * The duel ends when the *other* team presses SUBMIT, and this browser has no
 * way to know that on its own. `match_resolved` on the realtime channel is what
 * makes it land immediately; the poll is the fallback for a dropped socket, and
 * it is slow because that is all it is.
 */

const POLL_MS = 6_000;

export function PvpArenaScreen() {
  const router = useRouter();
  const [match, setMatch] = useState<PvpMatch | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/team/pvp/current', { cache: 'no-store' });
      const payload = await response.json();
      if (payload.success) {
        setMatch(payload.data?.match ?? null);
        if (payload.data?.team_id) setTeamId(payload.data.team_id);
      }
    } catch {
      // Keep the last good match on screen; the next tick retries.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(poll);
  }, [load]);

  // The other team finishing is the event this screen most needs and is least
  // able to see for itself.
  useEffect(() => {
    if (!teamId) return;
    const channel = supabaseClient
      .channel('pvp_notifications')
      .on('broadcast', { event: 'match_resolved' }, (message) => {
        const { team_ids: teamIds } = message.payload ?? {};
        if (Array.isArray(teamIds) && teamIds.includes(teamId)) void load();
      })
      .subscribe();
    return () => {
      void supabaseClient.removeChannel(channel);
    };
  }, [teamId, load]);

  // Landing here without a duel means the search was never finished — most
  // often a bookmarked URL. Say so and send them back rather than showing an
  // arena with no questions in it.
  const bouncedRef = useRef(false);
  useEffect(() => {
    if (!loaded || match || bouncedRef.current) return;
    bouncedRef.current = true;
    toast('No duel yet — press ENTER PVP to find an opponent.', { duration: 6000 });
    router.replace('/dashboard');
  }, [loaded, match, router]);

  if (!loaded || !match) {
    return (
      <div className="pvpq">
        <div className="pvpq__scrim" aria-hidden="true" />
        <div className="pvpq__panel">
          <div className="pvpq__glass-stage" aria-hidden="true">
            <Loader2 className="pvpq__swords" size={64} style={{ animation: 'spin 1.4s linear infinite' }} />
          </div>
          <h2 className="pvpq__title">
            <Swords size={14} aria-hidden="true" /> OPENING THE ARENA
          </h2>
          <p className="pvpq__sub" role="status">Loading your duel…</p>
        </div>
      </div>
    );
  }

  return (
    <PvpArena match={match} onRefresh={load} onClose={() => router.push('/dashboard')} />
  );
}
