'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Backpack, AlertTriangle } from 'lucide-react';
import { Panel, Btn, Pill, Loading } from '@/components/admin/nether-ui';

interface ConsumableInventoryProps {
  refreshToken?: number;
  onUsed?: () => void;
}

interface InventoryItem {
  transaction_id: string;
  item_type: string;
  created_at: string;
  used: boolean;
  consumed_at: string | null;
}

const ITEM_META: Record<string, { name: string; usage: string; manual: boolean }> = {
  hint: { name: 'Hint', usage: 'Returns an approach for a chosen question.', manual: true },
  totem_of_undying: { name: 'Totem of Undying', usage: 'Spent automatically on your next guardian defeat.', manual: false },
  guardian_retry_token: { name: 'Guardian Retry Token', usage: 'Spent automatically when you retry during a cooldown.', manual: false },
  revival_potion: { name: 'Revival Potion', usage: 'Recovers 50% of the resources lost in your last guardian battle.', manual: true },
  strength_potion: { name: 'Strength Potion', usage: 'Spent automatically on your next guardian victory (+20%).', manual: false },
};

export function ConsumableInventory({ refreshToken, onUsed }: ConsumableInventoryProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/team/marketplace/inventory', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setItems(json.data || []);
    } catch {
      setError('Could not load your consumables.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, refreshToken]);

  const use = async (item: InventoryItem, questionId?: string) => {
    setError(null);
    setBusy(item.transaction_id);
    try {
      const res = await fetch('/api/team/marketplace/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: item.transaction_id, question_id: questionId }),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(`${ITEM_META[item.item_type]?.name ?? 'Item'} used`);
        await load();
        onUsed?.();
      } else {
        setError(json.error?.message ?? `Could not use that item (${json.error?.code ?? 'error'}).`);
      }
    } catch {
      setError('Could not reach the server. The item was not consumed.');
    } finally {
      setBusy(null);
    }
  };

  const usable = items.filter((item) => !item.used);

  return (
    <Panel
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Backpack size={13} /> Consumables</span>}
      actions={<Pill tone={usable.length > 0 ? 'ok' : 'idle'}>{usable.length} usable</Pill>}
    >
      {loading ? (
        <Loading label="Loading inventory" />
      ) : (
        <>
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

          {usable.length === 0 ? (
            <div className="n-empty">Nothing in your pack — buy something from the marketplace.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {usable.map((item) => {
                const meta = ITEM_META[item.item_type];
                return (
                  <div
                    key={item.transaction_id}
                    style={{
                      padding: 9,
                      background: 'var(--bg-void)',
                      border: '1px solid rgb(from var(--accent-muted) r g b / 22%)',
                    }}
                  >
                    <div style={{ fontSize: 10.5 }}>{meta?.name ?? item.item_type}</div>
                    <p className="n-panel-sub" style={{ marginTop: 3, marginBottom: meta?.manual ? 8 : 0 }}>
                      {meta?.usage ?? 'Consumable item.'}
                    </p>
                    {/* Passive items are spent by the server at the right moment, so
                        showing a Use button for them would only mislead. */}
                    {meta?.manual && (
                      <Btn
                        small
                        style={{ width: '100%' }}
                        disabled={busy === item.transaction_id}
                        onClick={() => {
                          if (item.item_type === 'hint') {
                            const questionId = window.prompt('Question id to get a hint for:')?.trim();
                            if (!questionId) return;
                            void use(item, questionId);
                          } else {
                            void use(item);
                          }
                        }}
                      >
                        {busy === item.transaction_id ? 'Using…' : 'Use'}
                      </Btn>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
