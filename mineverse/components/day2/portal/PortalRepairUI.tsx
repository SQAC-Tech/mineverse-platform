'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Day2Status {
  portal: {
    state: string;
    has_fragment: boolean;
    is_repaired: boolean;
    diamond_count: number;
    nether_core_count: number;
  };
}

export function PortalRepairUI() {
  const [status, setStatus] = useState<Day2Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [repairing, setRepairing] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/team/day2/status');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStatus(data);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRepair = async () => {
    setRepairing(true);
    setError('');
    try {
      const res = await fetch('/api/team/portal/repair', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchStatus();
      } else {
        setError(data.error || 'Failed to repair portal');
      }
    } catch (e) {
      setError('An unexpected error occurred');
    } finally {
      setRepairing(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!status) return <div>Failed to load portal status</div>;

  const { portal } = status;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Portal Repair</h1>
      
      <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
        <h2 className="text-xl font-semibold mb-4">Requirements</h2>
        <ul className="space-y-2">
          <li className="flex items-center gap-2">
            <span className={portal.nether_core_count >= 1 ? "text-green-500" : "text-red-500"}>
              {portal.nether_core_count >= 1 ? '✓' : '✗'}
            </span>
            Nether Core (1/1)
          </li>
          <li className="flex items-center gap-2">
            <span className={portal.has_fragment ? "text-green-500" : "text-red-500"}>
              {portal.has_fragment ? '✓' : '✗'}
            </span>
            Portal Fragment ({portal.has_fragment ? '1' : '0'}/1)
          </li>
          <li className="flex items-center gap-2">
            <span className={portal.diamond_count >= 15 ? "text-green-500" : "text-red-500"}>
              {portal.diamond_count >= 15 ? '✓' : '✗'}
            </span>
            Diamonds ({portal.diamond_count}/15)
          </li>
        </ul>
      </div>

      <div className="p-4 rounded-lg bg-blue-950/30 border border-blue-900">
        <p className="text-sm text-blue-200">
          Note: Volunteers and organizers will record the outcomes of your physical offline games (Memory Challenge, Spot the Difference, etc.) which will grant you the Portal Fragment and Diamonds. There is no self-entry for these.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="text-lg font-medium">
          Status: <span className="uppercase tracking-wider">{portal.state}</span>
        </div>

        {error && <div className="text-red-500 text-sm">{error}</div>}

        {!portal.is_repaired && portal.state === 'ready' && (
          <button 
            onClick={handleRepair}
            disabled={repairing}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded shadow-lg transition"
          >
            {repairing ? 'Repairing...' : 'Repair Portal'}
          </button>
        )}

        {portal.is_repaired && (
          <button
            onClick={() => router.push('/final-boss')}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded shadow-lg transition"
          >
            Enter The End
          </button>
        )}
      </div>
    </div>
  );
}
