'use client';

import { useState } from 'react';
import { StructureType } from '@/lib/gameplay/structures/service';

interface StructureManagerProps {
  roundId: number;
  availableStructures: Array<{ type: StructureType, name: string, description: string }>;
}

export function StructureManager({ roundId, availableStructures }: StructureManagerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (endpoint: string, type: StructureType) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/team/structures/${endpoint}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({ type, round_id: roundId })
      });
      const json = await res.json();
      if (json.success) {
        // Typically trigger a re-fetch of team state via a context or SWR here
        alert(`Successfully executed ${endpoint} on ${type}`);
      } else {
        setError(json.error.message || `Failed to ${endpoint}`);
      }
    } catch (err) {
      setError('An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 border rounded-lg shadow-md bg-neutral-950 text-neutral-200">
      <h3 className="text-xl font-bold mb-4 text-amber-400">Structures (Round {roundId})</h3>
      
      {error && <div className="bg-red-900/50 text-red-200 p-3 rounded mb-4 text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {availableStructures.map((struct) => (
          <div key={struct.type} className="border border-neutral-800 p-4 rounded bg-neutral-900 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-lg mb-1">{struct.name}</h4>
              <p className="text-sm text-neutral-400 mb-4">{struct.description}</p>
            </div>
            
            <div className="flex flex-wrap gap-2 mt-auto">
              <button 
                onClick={() => handleAction('build', struct.type)}
                disabled={loading}
                className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 rounded text-sm font-medium transition-colors"
              >
                Build
              </button>
              <button 
                onClick={() => handleAction('upgrade', struct.type)}
                disabled={loading}
                className="px-3 py-1.5 bg-indigo-900/60 hover:bg-indigo-900 text-indigo-200 rounded text-sm font-medium transition-colors"
              >
                Upgrade
              </button>
              <button 
                onClick={() => handleAction('repair', struct.type)}
                disabled={loading}
                className="px-3 py-1.5 bg-rose-900/60 hover:bg-rose-900 text-rose-200 rounded text-sm font-medium transition-colors"
              >
                Repair
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
