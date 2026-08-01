'use client';

import { useEffect, useState } from 'react';

interface LeaderboardRow {
  rank: number;
  team_name: string;
  team_code: string;
  score: number;
}

interface LeaderboardData {
  rows: LeaderboardRow[];
  note: string;
  last_updated: string;
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard', { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? json.error?.code ?? 'Leaderboard unavailable');
        return;
      }
      setData(json.data);
      setError(null);
    } catch {
      setError('Leaderboard unavailable');
    }
  };

  useEffect(() => {
    void fetchLeaderboard();
    const poll = window.setInterval(fetchLeaderboard, 30000);
    return () => window.clearInterval(poll);
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-col gap-3 border-b border-zinc-800 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-emerald-300">Mineverse</p>
            <h1 className="text-3xl font-semibold text-white">Leaderboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">{data?.note ?? 'Leaderboard is informational and does not determine Day 2 qualification.'}</p>
          </div>
          <div className="text-sm text-zinc-500">Last updated: {data ? new Date(data.last_updated).toLocaleTimeString() : '--'}</div>
        </header>

        {error ? <div className="rounded border border-red-900 bg-red-950/40 p-4 text-red-100">{error}</div> : null}

        <section className="overflow-hidden rounded border border-zinc-800 bg-zinc-900">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-zinc-950 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3 text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).map((row) => (
                <tr key={row.team_code} className="border-t border-zinc-800">
                  <td className="px-4 py-3 font-mono text-amber-200">#{row.rank}</td>
                  <td className="px-4 py-3 text-white">{row.team_name}</td>
                  <td className="px-4 py-3 text-zinc-400">{row.team_code}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-200">{row.score}</td>
                </tr>
              ))}
              {!data ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-400">Loading leaderboard...</td>
                </tr>
              ) : data.rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-400">No teams are visible yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}