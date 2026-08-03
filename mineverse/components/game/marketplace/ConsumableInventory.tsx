'use client';

import { useState, useEffect } from 'react';

interface InventoryItem {
  transaction_id: string;
  item_type: string;
  created_at: string;
  used: boolean;
  consumed_at: string | null;
}

const ITEM_META: Record<string, { name: string; usage: string }> = {
  hint: { name: 'Hint', usage: 'Returns an approach for a question (provider pending).' },
  totem_of_undying: { name: 'Totem of Undying', usage: 'Consumed automatically to ignore one guardian defeat penalty.' },
  guardian_retry_token: { name: 'Guardian Retry Token', usage: 'Consumed when you retry during an active cooldown.' },
  revival_potion: { name: 'Revival Potion', usage: 'Immediately recovers 50% of resources lost in the previous guardian battle.' },
  strength_potion: { name: 'Strength Potion', usage: 'Consumed on your next guardian victory (+20% rewards).' },
};

export function ConsumableInventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadInventory = async () => {
    try {
      const res = await fetch('/api/team/marketplace/inventory');
      const json = await res.json();
      if (json.success) setItems(json.data || []);
    } catch {
      setError('Failed to load your consumables.');
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/team/marketplace/inventory');
        const json = await res.json();
        if (!cancelled && json.success) setItems(json.data || []);
      } catch {
        if (!cancelled) setError('Failed to load your consumables.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUse = async (item: InventoryItem) => {
    setError(null);
    setMessage(null);
    setBusy(item.transaction_id);

    const questionId = item.item_type === 'hint' ? window.prompt('Enter the question id to request a hint for:') ?? undefined : undefined;
    if (item.item_type === 'hint' && !questionId) {
      setBusy(null);
      return;
    }

    try {
      const res = await fetch('/api/team/marketplace/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: item.transaction_id, question_id: questionId }),
      });
      const json = await res.json();

      if (json.success) {
        const meta = ITEM_META[item.item_type];
        setMessage(meta ? `Used ${meta.name}!` : 'Item used.');
        await loadInventory();
      } else {
        setError(json.error.message || `Failed (${json.error.code}).`);
      }
    } catch {
      setError('An error occurred.');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return null;

  const usable = items.filter((item) => !item.used);

  return (
    <div className="p-6 border rounded-lg bg-neutral-950 text-neutral-200 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-bold text-emerald-400">My Consumables</h4>
        <span className="text-xs bg-neutral-900 px-2 py-1 rounded border border-neutral-800">
          {usable.length} usable
        </span>
      </div>

      {error && <div className="bg-red-900/50 text-red-200 p-3 rounded mb-4 text-sm">{error}</div>}
      {message && <div className="bg-emerald-900/50 text-emerald-200 p-3 rounded mb-4 text-sm">{message}</div>}

      {usable.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No consumables yet. Purchase Totem, Retry Token, Revival Potion, Strength Potion, or a Hint above.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {usable.map((item) => {
            const meta = ITEM_META[item.item_type];
            return (
              <div
                key={item.transaction_id}
                className="border border-neutral-800 p-4 rounded bg-neutral-900 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="font-bold text-sm">{meta?.name ?? item.item_type}</div>
                  <p className="text-xs text-neutral-500 mt-1">{meta?.usage}</p>
                </div>
                <button
                  onClick={() => handleUse(item)}
                  disabled={busy === item.transaction_id}
                  className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-700 text-black rounded font-medium transition-colors text-sm"
                >
                  {busy === item.transaction_id ? 'Using...' : 'Use'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
