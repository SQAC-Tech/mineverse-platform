'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Lightbulb, RotateCcw, Shield, Sparkles } from 'lucide-react';
import { marketplaceList, type MarketplaceEntry } from '@/lib/gameplay/marketplace/catalog';
import { RESOURCE_META } from '@/components/game/custom-round-ui/round-presentation';
import '@/features/dashboard/shop-ui.css';

interface MarketplaceStoreProps {
  onPurchased?: () => void;
  refreshToken?: number;
  /** Live emerald balance, so an item that cannot be afforded says so up front. */
  emeralds?: number;
}

/* Prices and copy come from the catalog the purchase route charges against. */
const ITEMS = marketplaceList();

const EMERALD = RESOURCE_META.find((meta) => meta.key === 'emerald')?.icon ?? '/emerald.svg';

/**
 * The icon for a row.
 *
 * The five bundles pay a resource, so they show that resource's own block —
 * the same SVG the hotbar draws, so a Wood Bundle is visibly the thing it
 * gives you. The consumables have no block to show and get a glyph rather than
 * an invented asset.
 */
const CONSUMABLE_ICONS: Record<string, typeof Lightbulb> = {
  hint: Lightbulb,
  totem_of_undying: Shield,
  guardian_retry_token: RotateCcw,
  revival_potion: Sparkles,
  strength_potion: Sparkles,
};

function RowIcon({ entry }: { entry: MarketplaceEntry }) {
  const reward = entry.resourceReward ?? {};
  const key = Object.keys(reward)[0];
  const meta = key ? RESOURCE_META.find((resource) => resource.key === key) : null;

  if (meta) return <img src={meta.icon} alt="" />;

  const Glyph = CONSUMABLE_ICONS[entry.item] ?? Sparkles;
  return <Glyph size={24} aria-hidden="true" />;
}

export function MarketplaceStore({ onPurchased, emeralds }: MarketplaceStoreProps) {
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
    <div className="shop">
      {error && <p className="shop__error">{error}</p>}

      {ITEMS.map((entry) => {
        // Only greyed out when the balance is actually known — the server is
        // still the one that decides, and a missing balance must not lock the
        // shop.
        const unaffordable = typeof emeralds === 'number' && emeralds < entry.costEmerald;

        return (
          <div className="shop__row" key={entry.item}>
            <span className="shop__slot">
              <RowIcon entry={entry} />
            </span>

            <span className="shop__name">
              <b>{entry.label}</b>
              <span>{entry.description}</span>
            </span>

            <span className={unaffordable ? 'shop__price shop__price--short' : 'shop__price'}>
              <img src={EMERALD} alt="emeralds" />
              {entry.costEmerald}
            </span>

            <button
              type="button"
              className="shop__btn"
              disabled={busy !== null || unaffordable}
              onClick={() => void purchase(entry)}
              title={unaffordable ? `Costs ${entry.costEmerald} emeralds` : `Buy ${entry.label}`}
            >
              {busy === entry.item ? '…' : 'BUY'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
