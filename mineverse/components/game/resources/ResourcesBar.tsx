'use client';

import { useEffect, useState } from 'react';

type Balance = Record<'wood' | 'stone' | 'iron' | 'gold' | 'diamond' | 'emerald' | 'obsidian', number>;

interface ResourceData {
  balance: Balance;
  version: number;
  server_time: string;
  active_modifiers: Array<{ label?: string; expires_at?: string }>;
  pending_grading: boolean;
}

const labels: Array<keyof Balance> = ['wood', 'stone', 'iron', 'gold', 'diamond', 'emerald', 'obsidian'];

export function ResourcesBar({ refreshToken }: { refreshToken: number }) {
  const [data, setData] = useState<ResourceData | null>(null);
  const [error, setError] = useState(false);

  const fetchResources = async () => {
    try {
      const res = await fetch('/api/team/resources', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setError(false);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    void fetchResources();
    const poll = window.setInterval(fetchResources, 10000);
    return () => window.clearInterval(poll);
  }, []);

  useEffect(() => {
    void fetchResources();
  }, [refreshToken]);

  if (error) return <section className="rounded border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-300">Resources unavailable.</section>;
  if (!data) return <section className="rounded border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-300">Loading resources...</section>;

  return (
    <section className="rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-200">Resources</h2>
        <div className="text-xs text-zinc-500">Version {data.version}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {labels.map((key) => (
          <div key={key} className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2">
            <div className="text-xs uppercase text-zinc-500">{key}</div>
            <div className="text-lg font-semibold text-white">{data.balance[key]}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {data.active_modifiers.length === 0 ? <span className="text-zinc-500">No active modifiers</span> : null}
        {data.active_modifiers.map((modifier, index) => (
          <span key={index} className="rounded border border-amber-700 px-2 py-1 text-amber-100">{modifier.label ?? 'Modifier active'}</span>
        ))}
        {data.pending_grading ? <span className="rounded border border-sky-700 px-2 py-1 text-sky-100">Pending grading may change balances</span> : null}
      </div>
    </section>
  );
}