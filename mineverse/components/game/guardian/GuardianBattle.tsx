'use client';

import { useState, useEffect } from 'react';
import { GuardianName } from '@/lib/gameplay/guardians/service';

interface GuardianBattleProps {
  guardianName: GuardianName;
  roundId: number;
}

interface GuardianState {
  id: string;
  status: 'started' | 'won' | 'lost';
  attempt_number: number;
  retry_after: string | null;
}

export function GuardianBattle({ guardianName, roundId }: GuardianBattleProps) {
  const [state, setState] = useState<GuardianState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(0);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/team/guardian/status?guardian_name=${guardianName}&round_id=${roundId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setState(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch guardian status', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [guardianName, roundId]);

  useEffect(() => {
    if (state?.retry_after) {
      const interval = setInterval(() => {
        const diff = new Date(state.retry_after!).getTime() - Date.now();
        if (diff <= 0) {
          setCountdown(0);
          clearInterval(interval);
        } else {
          setCountdown(Math.ceil(diff / 1000));
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state?.retry_after]);

  const handleStart = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/team/guardian/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guardian_name: guardianName, round_id: roundId })
      });
      const json = await res.json();
      if (json.success) {
        setState(json.data);
      } else {
        setError(json.error.message || 'Failed to start battle');
      }
    } catch (err) {
      setError('An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/team/guardian/submit', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({ guardian_name: guardianName, round_id: roundId })
      });
      const json = await res.json();
      if (json.success) {
        setState(json.data);
      } else {
        setError(json.error.message || 'Failed to resolve battle');
      }
    } catch (err) {
      setError('An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4 border rounded shadow-sm bg-neutral-900 text-white">Loading Guardian...</div>;

  return (
    <div className="p-6 border rounded-lg shadow-md bg-neutral-950 text-neutral-200">
      <h3 className="text-xl font-bold mb-4 capitalize text-emerald-400">
        {guardianName.replace('_', ' ')}
      </h3>
      
      {error && <div className="bg-red-900/50 text-red-200 p-2 rounded mb-4">{error}</div>}

      {!state && (
        <div>
          <p className="mb-4 text-sm text-neutral-400">You have not challenged this Guardian yet.</p>
          <button 
            onClick={handleStart}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium transition-colors"
          >
            Challenge Guardian
          </button>
        </div>
      )}

      {state?.status === 'started' && (
        <div className="space-y-4">
          <div className="bg-amber-900/30 text-amber-200 p-3 rounded text-sm">
            Battle in progress! Attempt #{state.attempt_number}
          </div>
          {/* Dev 4 would render actual questions here */}
          <div className="flex gap-4 pt-4">
            <button onClick={handleResolve} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-white font-medium">Resolve Battle</button>
          </div>
        </div>
      )}

      {state?.status === 'won' && (
        <div className="bg-emerald-900/30 text-emerald-200 p-4 rounded text-center border border-emerald-800">
          <p className="font-bold text-lg mb-1">Guardian Defeated!</p>
          <p className="text-sm">Rewards have been claimed.</p>
        </div>
      )}

      {state?.status === 'lost' && (
        <div className="space-y-4">
          <div className="bg-red-900/30 text-red-200 p-4 rounded border border-red-800">
            <p className="font-bold mb-1">Defeated</p>
            <p className="text-sm opacity-80">You lost to the Guardian and incurred a penalty.</p>
          </div>
          
          {countdown > 0 ? (
            <div className="text-sm text-neutral-400">
              Cooldown: {countdown} seconds remaining before retry...
            </div>
          ) : (
            <button 
              onClick={handleStart}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium transition-colors"
            >
              Retry Challenge
            </button>
          )}
        </div>
      )}
    </div>
  );
}
