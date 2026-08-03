'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Store, Gem, AlertTriangle } from 'lucide-react';
import { MarketplaceItem } from '@/lib/gameplay/marketplace/service';
import { Panel, Btn } from '@/components/admin/nether-ui';

interface MarketplaceStoreProps {
  onPurchased?: () => void;
  refreshToken?: number;
}

interface StoreItem {
  id: MarketplaceItem;
  name: string;
  description: string;
  costEmerald: number;
}

/** Costs match `MARKETPLACE_ITEMS` in lib/gameplay/marketplace/service.ts. */
const ITEMS: StoreItem[] = [
  { id: 'wood_bundle', name: 'Wood Bundle', description: '+15 Wood', costEmerald: 5 },
  { id: 'stone_bundle', name: 'Stone Bundle', description: '+15 Stone', costEmerald: 6 },
  { id: 'iron_bundle', name: 'Iron Bundle', description: '+10 Iron', costEmerald: 10 },
  { id: 'gold_bundle', name: 'Gold Bundle', description: '+8 Gold', costEmerald: 12 },
  { id: 'diamond_bundle', name: 'Diamond Bundle', description: '+15 Diamond', costEmerald: 20 },
  { id: 'hint', name: 'Hint', description: 'Explains the approach for a question.', costEmerald: 8 },
  { id: 'totem_of_undying', name: 'Totem of Undying', description: 'Absorbs one guardian defeat penalty.', costEmerald: 15 },
  { id: 'guardian_retry_token', name: 'Guardian Retry Token', description: 'Skips a guardian cooldown once.', costEmerald: 12 },
  { id: 'revival_potion', name: 'Revival Potion', description: 'Recovers 50% of the last guardian loss.', costEmerald: 10 },
  { id: 'strength_potion', name: 'Strength Potion', description: '+20% on your next guardian victory.', costEmerald: 10 },
];

export function MarketplaceStore({ onPurchased }: MarketplaceStoreProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const purchase = async (item: StoreItem) => {
    setError(null);
    setBusy(item.id);
    try {
      const res = await fetch('/api/team/marketplace/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ item: item.id, idempotency_key: crypto.randomUUID() }),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(`${item.name} purchased`);
        onPurchased?.();
      } else {
        setError(
          json.error?.code === 'INSUFFICIENT_FUNDS'
            ? `Not enough emeralds — ${item.name} costs ${item.costEmerald}.`
            : json.error?.message ?? 'Purchase failed.',
        );
      }
    } catch {
      setError('Could not reach the server. You were not charged.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Store size={13} /> Marketplace</span>}
      subtitle="Wandering Villager — pays in emeralds"
    >
      {error && (
        <div
          style={{
            display: 'flex', gap: 8, padding: 9, marginBottom: 10, fontSize: 10.5,
            background: 'rgb(from var(--accent-danger) r g b / 45%)',
            border: '1px solid #a3324a', color: '#ff9db0',
          }}
        >
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {ITEMS.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 9, justifyContent: 'space-between',
              padding: 9, background: 'var(--bg-void)',
              border: '1px solid rgb(from var(--accent-muted) r g b / 22%)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10.5 }}>{item.name}</div>
              <div className="n-panel-sub">{item.description}</div>
            </div>
            <Btn small disabled={busy !== null} onClick={() => purchase(item)} style={{ flexShrink: 0 }}>
              <Gem size={10} /> {busy === item.id ? '…' : item.costEmerald}
            </Btn>
          </div>
        ))}
      </div>
    </Panel>
  );
}
