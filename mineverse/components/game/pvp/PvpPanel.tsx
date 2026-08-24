'use client';

import { useCallback, useEffect, useState } from 'react';
import { Swords, CheckCircle2, XCircle } from 'lucide-react';
import { PvpArena } from './PvpArena';
import { supabaseClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export interface PvpQuestion {
  id: string;
  display_order: number;
  type: string;
  prompt: string;
  content: unknown;
}

export interface PvpMatch {
  id: string;
  status: string;
  started_at: string | null;
  deadline_at: string | null;
  resolved_at: string | null;
  own_outcome: string | null;
  result: { won: boolean; summary: string | null } | null;
  questions: PvpQuestion[];
  submissions: Array<{ match_question_id: string; revision: number; status: string; submitted_at: string }>;
}

interface PvpData {
  available: boolean;
  team_id?: string;
  code?: string;
  server_time?: string;
  match?: PvpMatch | null;
}

/**
 * `/api/team/pvp/eligibility`.
 *
 * Not the qualification service's `checkTeamEligibility`, which answers a
 * different question — whether the team goes through to Day 2, which is what
 * the duel decides.
 */
interface EligibilityData {
  hasIronArmor: boolean;
  hasBlazeGuardian: boolean;
  requiresBlazeGuardian: boolean;
  isEligible: boolean;
  reason: string | null;
  round_open: boolean;
  queued: boolean;
}

export function PvpPanel() {
  const [data, setData] = useState<PvpData | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showArena, setShowArena] = useState(false);
  const [entering, setEntering] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);

  const fetchPvp = useCallback(async () => {
    try {
      const [res, eligRes] = await Promise.all([
        fetch('/api/team/pvp/current', { cache: 'no-store' }),
        fetch('/api/team/pvp/eligibility', { cache: 'no-store' }),
      ]);
      const json = await res.json();
      const eligJson = await eligRes.json();

      if (!json.success) {
        setError(json.error?.message ?? json.error?.code ?? 'PvP unavailable');
        return;
      }
      setData(json.data);
      // Capture team_id from the first successful response for realtime filtering
      if (json.data?.team_id) setTeamId(json.data.team_id);
      if (eligJson.success) setEligibility(eligJson.data);
      setError(null);
    } catch {
      setError('PvP unavailable');
    }
  }, []);

  useEffect(() => {
    void fetchPvp();
    const poll = window.setInterval(fetchPvp, 5000);
    return () => window.clearInterval(poll);
  }, [fetchPvp]);

  // Subscribe to match_started events so the panel reacts immediately
  // without waiting for the next poll cycle.
  useEffect(() => {
    if (!teamId) return;
    const channel = supabaseClient.channel('pvp_notifications')
      .on('broadcast', { event: 'match_started' }, (msg) => {
        const { team_ids } = msg.payload ?? {};
        if (Array.isArray(team_ids) && team_ids.includes(teamId)) {
          toast('⚔ Your PvP match has started! Enter the Arena now.', {
            duration: 10000,
            icon: <Swords size={16} style={{ color: '#f59e0b' }} />,
          });
          void fetchPvp();
        }
      })
      .subscribe();

    return () => { void supabaseClient.removeChannel(channel); };
  }, [teamId, fetchPvp]);

  /**
   * Ask to be paired.
   *
   * The server does the seeding on this call and answers with either a match or
   * a place in the queue, so there is nothing to poll for in between. Pressing
   * it again is harmless: the queue is keyed on the team.
   */
  const findOpponent = useCallback(async () => {
    setEntering(true);
    try {
      const response = await fetch('/api/team/pvp/enter', { method: 'POST' });
      const payload = await response.json();

      if (!payload.success) {
        toast.error(payload.error?.message ?? 'Could not enter the duel.', { duration: 8000 });
        return;
      }

      if (payload.data.state === 'matched') {
        toast.success('Opponent found — the duel is live.');
        setShowArena(true);
      } else {
        toast('Waiting for an opponent. You will be paired as soon as one enters.', { duration: 8000 });
      }
      void fetchPvp();
    } catch {
      toast.error('Could not reach the arena. Try again.');
    } finally {
      setEntering(false);
    }
  }, [fetchPvp]);

  if (!data && !error) return null;

  const match = data?.match ?? null;
  const isLive = match?.status === 'live';
  const isResolved = match?.status === 'resolved';
  // Nothing to enter yet, but the team is allowed to go and find someone.
  const canSeek = !match && Boolean(eligibility?.isEligible) && Boolean(eligibility?.round_open);

  return (
    <>
      <div className="round-ui__tile">
        <div className="round-ui__tile-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Swords size={14} className="text-amber-500" /> THE DUEL
        </div>

        <div className="round-ui__pvp-card">
          <div className="round-ui__pvp-status">
            {error ? (
              <span className="text-red-400">{error}</span>
            ) : !data?.available ? (
              'PvP is not available yet.'
            ) : !eligibility?.round_open ? (
              'The Duel has not opened yet.'
            ) : !match ? (
              eligibility?.queued
                ? 'In the queue — waiting for an opponent of your year and standing.'
                : 'Press FIND OPPONENT and you will be paired automatically.'
            ) : isLive ? (
              <strong className="text-amber-400">Match is LIVE!</strong>
            ) : isResolved ? (
              <strong>Match resolved. {match.result?.won ? 'You won!' : 'You lost.'}</strong>
            ) : (
              'Match paired. Waiting for the arena to open.'
            )}
          </div>

          <div className="round-ui__pvp-reqs">
            <div className="round-ui__field-label" style={{ marginBottom: 0 }}>REQUIREMENTS</div>
            <div className={`round-ui__pvp-req ${eligibility?.hasIronArmor ? 'round-ui__pvp-req--met' : ''}`}>
              {eligibility?.hasIronArmor ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
              Craft Iron Armor
            </div>
            {/* Only drawn when it is actually enforced — a permanently red line
                a team cannot clear reads as a bug, not as a requirement. */}
            {eligibility?.requiresBlazeGuardian && (
              <div className={`round-ui__pvp-req ${eligibility?.hasBlazeGuardian ? 'round-ui__pvp-req--met' : ''}`}>
                {eligibility?.hasBlazeGuardian ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                Defeat Blaze Guardian
              </div>
            )}
          </div>

          {canSeek ? (
            <button
              className="n-btn n-btn-primary"
              disabled={entering}
              onClick={() => void findOpponent()}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {entering ? 'FINDING OPPONENT…' : eligibility?.queued ? 'STILL WAITING — CHECK AGAIN' : 'FIND OPPONENT'}
            </button>
          ) : (
            <button
              className="n-btn n-btn-primary"
              disabled={!match || match.status === 'draft' || !eligibility?.isEligible}
              onClick={() => setShowArena(true)}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {isResolved ? 'VIEW RESULTS' : 'ENTER ARENA'}
            </button>
          )}
        </div>
      </div>

      {showArena && match && (
        <PvpArena match={match} onClose={() => setShowArena(false)} onRefresh={fetchPvp} />
      )}
    </>
  );
}
