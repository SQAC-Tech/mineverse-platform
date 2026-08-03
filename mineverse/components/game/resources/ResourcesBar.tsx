'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Hourglass, Zap, WifiOff } from 'lucide-react';
import { Pill } from '@/components/admin/nether-ui';

type Balance = Record<'wood' | 'stone' | 'iron' | 'gold' | 'diamond' | 'emerald' | 'obsidian', number>;

interface ResourceData {
  balance: Balance;
  version: number;
  server_time: string;
  active_modifiers: Array<{ event_key?: string; label?: string; modifier?: Record<string, number>; expires_at?: string | null }>;
  pending_grading: boolean;
}

const KEYS: Array<keyof Balance> = ['wood', 'stone', 'iron', 'gold', 'diamond', 'emerald', 'obsidian'];

export function ResourcesBar({ refreshToken }: { refreshToken: number }) {
  const [data, setData] = useState<ResourceData | null>(null);
  const [stale, setStale] = useState(false);
  /** Keys whose value just changed, so the chip can pulse once. */
  const [bumped, setBumped] = useState<Set<string>>(new Set());
  const previous = useRef<Balance | null>(null);

  const fetchResources = useCallback(async () => {
    try {
      const res = await fetch('/api/team/resources', { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) { setStale(true); return; }

      const next: ResourceData = json.data;
      if (previous.current) {
        const changed = new Set<string>();
        for (const key of KEYS) {
          if (previous.current[key] !== next.balance[key]) changed.add(key);
        }
        if (changed.size > 0) {
          setBumped(changed);
          window.setTimeout(() => setBumped(new Set()), 900);
        }
      }
      previous.current = next.balance;
      setData(next);
      setStale(false);
    } catch {
      // Keep the last known balance rather than blanking the bar mid-round.
      setStale(true);
    }
  }, []);

  useEffect(() => {
    void fetchResources();
    const poll = window.setInterval(fetchResources, 10000);
    return () => window.clearInterval(poll);
  }, [fetchResources]);

  useEffect(() => { void fetchResources(); }, [refreshToken, fetchResources]);

  if (!data) {
    return (
      <div className="n-panel" style={{ padding: 12 }}>
        <span className="n-panel-sub">Loading resources…</span>
      </div>
    );
  }

  return (
    <div className="n-panel" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 9, flexWrap: 'wrap' }}>
        <span className="n-stat-label">Resources</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {stale && <Pill tone="danger"><WifiOff size={10} /> stale</Pill>}
          {data.pending_grading && <Pill tone="warn"><Hourglass size={10} /> grading pending</Pill>}
          {data.active_modifiers?.map((m, i) => (
            <Pill key={m.event_key ?? i} tone="live">
              <Zap size={10} /> {m.label ?? 'modifier'}
              {m.modifier ? ` ×${Object.values(m.modifier)[0]}` : ''}
            </Pill>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(76px, 1fr))', gap: 7 }}>
        {KEYS.map((key) => (
          <div key={key} className={`n-res ${bumped.has(key) ? 'n-res-bumped' : ''}`} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <span className="n-res-label">{key}</span>
            <span className="n-res-value">{data.balance[key] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
