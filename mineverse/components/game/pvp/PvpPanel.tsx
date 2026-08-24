'use client';

import { useEffect, useState } from 'react';
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
 * The duel asks one question now: is the team in the room.
 *
 * It used to require the Iron Armor and the Blaze Guardian, which locked teams
 * held up by a craft out of the part of the evening they came for.
 */
interface EligibilityData {
  attendanceMarked: boolean;
  isEligible: boolean;
  reason: string | null;
}

export function PvpPanel() {
  const [data, setData] = useState<PvpData | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showArena, setShowArena] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);

  const fetchPvp = async () => {
    try {
      const [res, eligRes] = await Promise.all([
        fetch('/api/team/pvp/current', { cache: 'no-store' }),
        fetch('/api/team/pvp/eligibility', { cache: 'no-store' })
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
      if (eligJson.success) {
        setEligibility(eligJson.data);
      }
      setError(null);
    } catch {
      setError('PvP unavailable');
    }
  };

  useEffect(() => {
    void fetchPvp();
    const poll = window.setInterval(fetchPvp, 5000);
    return () => window.clearInterval(poll);
  }, []);

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
  }, [teamId]);

  if (!data && !error) return null;

  return (
    <>
      <div className="round-ui__tile">
        <div className="round-ui__tile-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Swords size={14} className="text-amber-500" /> PVP ELIMINATION
        </div>
        
        <div className="round-ui__pvp-card">
          <div className="round-ui__pvp-status">
            {error ? (
              <span className="text-red-400">{error}</span>
            ) : !data?.available ? (
              'PvP is not available yet.'
            ) : !data.match ? (
              'Waiting to be paired by an organizer.'
            ) : data.match.status === 'live' ? (
              <strong className="text-amber-400">Match is LIVE!</strong>
            ) : data.match.status === 'resolved' ? (
              <strong>Match resolved. {data.match.result?.won ? 'You won!' : 'You lost.'}</strong>
            ) : (
              'Match paired. Waiting for organizer to start.'
            )}
          </div>
          
          <div className="round-ui__pvp-reqs">
            <div className="round-ui__field-label" style={{ marginBottom: 0 }}>REQUIREMENTS</div>
            <div className={`round-ui__pvp-req ${eligibility?.attendanceMarked ? 'round-ui__pvp-req--met' : ''}`}>
              {eligibility?.attendanceMarked ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
              Marked present at the Round 3 desk
            </div>
            {eligibility && !eligibility.isEligible && eligibility.reason ? (
              <div className="round-ui__pvp-req">{eligibility.reason}</div>
            ) : null}
          </div>
          
          <button 
            className="n-btn n-btn-primary" 
            disabled={!data?.match || data.match.status === 'draft' || !eligibility?.isEligible}
            onClick={() => setShowArena(true)}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {data?.match?.status === 'live' ? 'ENTER ARENA' : data?.match?.status === 'resolved' ? 'VIEW RESULTS' : 'ENTER ARENA'}
          </button>
        </div>
      </div>
      
      {showArena && data?.match && (
        <PvpArena match={data.match} onClose={() => setShowArena(false)} onRefresh={fetchPvp} />
      )}
    </>
  );
}