'use client';

import { useState, useEffect } from 'react';

interface GameState {
  qualified_for_day2: boolean;
  qualification_frozen_at: string | null;
  elimination_reason: string | null;
}

export function QualificationStatus() {
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/team/qualification/status');
        const json = await res.json();
        if (json.success) {
          setState(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch qualification status', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
    // In a real implementation, this might poll every 10-30s during the qualification period.
  }, []);

  if (loading) return null;

  if (!state?.qualification_frozen_at) {
    return (
      <div className="p-4 border rounded-lg bg-neutral-900 border-neutral-800 text-neutral-300 text-sm text-center">
        Qualification results are pending. Complete your Iron Armor and PvP matches!
      </div>
    );
  }

  if (state.qualified_for_day2) {
    return (
      <div className="p-6 border-2 rounded-lg bg-emerald-950/40 border-emerald-500/50 text-emerald-100 text-center shadow-[0_0_15px_rgba(16,185,129,0.2)]">
        <h2 className="text-2xl font-bold mb-2">🎉 Congratulations!</h2>
        <p className="text-lg">Your team has qualified for Day 2 of MINEVERSE.</p>
        <p className="text-sm mt-4 opacity-80">Prepare to enter The End.</p>
      </div>
    );
  }

  return (
    <div className="p-6 border rounded-lg bg-neutral-900 border-neutral-800 text-neutral-300 text-center">
      <h2 className="text-xl font-bold mb-2">Thank you for playing MINEVERSE!</h2>
      <p className="mb-2">Unfortunately, your team did not qualify for Day 2.</p>
      {state.elimination_reason && (
        <p className="text-sm text-neutral-500 italic">Reason: {state.elimination_reason}</p>
      )}
    </div>
  );
}
