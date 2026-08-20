'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Store, Gem, AlertTriangle } from 'lucide-react';
import { marketplaceList, type MarketplaceEntry } from '@/lib/gameplay/marketplace/catalog';
import { Panel, Btn } from '@/components/admin/nether-ui';

interface MarketplaceStoreProps {
  onPurchased?: () => void;
  refreshToken?: number;
}

/* Prices and copy come from the catalog the purchase route charges against. */
const ITEMS = marketplaceList();

export function MarketplaceStore({ onPurchased }: MarketplaceStoreProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const purchase = async (item: MarketplaceEntry) => {
    setError(null);
    setBusy(item.item);
    try {
      const res = await fetch('/api/team/marketplace/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ item: item.item, idempotency_key: crypto.randomUUID() }),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(`${item.label} purchased`);
        onPurchased?.();
      } else {
        setError(
          json.error?.code === 'INSUFFICIENT_FUNDS'
            ? `Not enough emeralds — ${item.label} costs ${item.costEmerald}.`
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
            key={item.item}
            style={{
              display: 'flex', alignItems: 'center', gap: 9, justifyContent: 'space-between',
              padding: 9, background: 'var(--bg-void)',
              border: '1px solid rgb(from var(--accent-muted) r g b / 22%)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10.5 }}>{item.label}</div>
              <div className="n-panel-sub">{item.description}</div>
            </div>
            <Btn small disabled={busy !== null} onClick={() => purchase(item)} style={{ flexShrink: 0 }}>
              <Gem size={10} /> {busy === item.item ? '…' : item.costEmerald}
            </Btn>
          </div>
        ))}
      </div>
    </Panel>
  );
}
