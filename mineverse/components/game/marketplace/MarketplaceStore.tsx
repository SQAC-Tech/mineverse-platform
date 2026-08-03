'use client';

import { useState } from 'react';
import { MarketplaceItem } from '@/lib/gameplay/marketplace/service';
import { ConsumableInventory } from '@/components/game/marketplace/ConsumableInventory';

interface StoreItem {
  id: MarketplaceItem;
  name: string;
  description: string;
  costEmerald: number;
}

const ITEMS: StoreItem[] = [
  { id: 'hint', name: 'Hint', description: 'Explains the approach or algorithm.', costEmerald: 8 },
  { id: 'wood_bundle', name: 'Wood Bundle', description: '+15 Wood', costEmerald: 5 },
  { id: 'stone_bundle', name: 'Stone Bundle', description: '+15 Stone', costEmerald: 6 },
  { id: 'iron_bundle', name: 'Iron Bundle', description: '+10 Iron', costEmerald: 10 },
  { id: 'gold_bundle', name: 'Gold Bundle', description: '+8 Gold', costEmerald: 12 },
  { id: 'diamond_bundle', name: 'Diamond Bundle', description: '+15 Diamond', costEmerald: 20 },
  { id: 'totem_of_undying', name: 'Totem of Undying', description: 'Ignore one guardian defeat penalty', costEmerald: 15 },
  { id: 'guardian_retry_token', name: 'Guardian Retry Token', description: 'Instantly retry a Guardian (no cooldown)', costEmerald: 12 },
  { id: 'revival_potion', name: 'Revival Potion', description: 'Recover 50% of resources lost in the previous guardian battle', costEmerald: 10 },
  { id: 'strength_potion', name: 'Strength Potion', description: 'Guardian victory rewards increased by 20%', costEmerald: 10 },
];

export function MarketplaceStore() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePurchase = async (item: MarketplaceItem) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/team/marketplace/purchase', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({ item })
      });
      const json = await res.json();
      if (json.success) {
        alert(`Successfully purchased ${item.replace('_', ' ')}!`);
        // Typically trigger a re-fetch of team state via context/SWR to update emerald balance
      } else {
        setError(json.error.message || `Failed to purchase ${item}`);
      }
    } catch {
      setError('An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 border rounded-lg shadow-md bg-neutral-950 text-neutral-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-emerald-400">Marketplace</h3>
        {/* The resource bar (Dev 4) would normally be visible somewhere in the parent UI */}
        <span className="text-xs bg-emerald-900/50 text-emerald-200 px-2 py-1 rounded">Wandering Villager</span>
      </div>
      
      {error && <div className="bg-red-900/50 text-red-200 p-3 rounded mb-4 text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {ITEMS.map((item) => (
          <div key={item.id} className="border border-neutral-800 p-4 rounded bg-neutral-900 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-md">{item.name}</h4>
                <span className="text-sm font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-full flex items-center gap-1">
                  {item.costEmerald} <span className="text-[10px]">Emeralds</span>
                </span>
              </div>
              <p className="text-sm text-neutral-400 mb-4">{item.description}</p>
            </div>
            
            <button 
              onClick={() => handlePurchase(item.id)}
              disabled={loading}
              className="w-full mt-auto py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-700 text-white rounded font-medium transition-colors text-sm"
            >
              Purchase
            </button>
          </div>
        ))}
      </div>

      <ConsumableInventory />
    </div>
  );
}
