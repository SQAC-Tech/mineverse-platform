'use client';

import { useEffect, useMemo, useState } from 'react';
import { ResourcesBar } from '@/components/game/resources/ResourcesBar';
import { CraftingPanel } from '@/components/game/crafting/CraftingPanel';
import { PvpPanel } from '@/components/game/pvp/PvpPanel';
import { QuestionList } from '@/components/game/questions/QuestionList';

interface RoundShellProps {
  roundId: number;
}

interface RoundQuestion {
  id: string;
  type: string;
  prompt: string;
  content: unknown;
  order_index: number;
  language_options: string[];
  time_limit_seconds: number | null;
  submission_status: string | null;
  submission_revision: number | null;
}

interface RoundData {
  round_id: number;
  round_name: string;
  ends_at: string | null;
  server_time: string;
  questions: RoundQuestion[];
}

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function RoundShell({ roundId }: RoundShellProps) {
  const [round, setRound] = useState<RoundData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [now, setNow] = useState(Date.now());

  const fetchRound = async () => {
    try {
      const res = await fetch(`/api/rounds/${roundId}/questions`, { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? json.error?.code ?? 'Round unavailable');
        return;
      }
      setRound(json.data);
      setError(null);
      setRefreshToken((value) => value + 1);
    } catch {
      setError('Round data is unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRound();
    const poll = window.setInterval(fetchRound, 10000);
    return () => window.clearInterval(poll);
  }, [roundId]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const remaining = useMemo(() => {
    if (!round?.ends_at) return null;
    return formatRemaining(new Date(round.ends_at).getTime() - now);
  }, [round?.ends_at, now]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-zinc-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-emerald-300">Mineverse Round {roundId}</p>
            <h1 className="text-2xl font-semibold text-white">{round?.round_name ?? 'Gameplay Round'}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="min-w-24 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-center">
              <div className="text-xs text-zinc-400">Time Left</div>
              <div className="font-mono text-xl text-amber-200">{remaining ?? '--:--'}</div>
            </div>
            <button
              type="button"
              onClick={fetchRound}
              className="rounded border border-emerald-700 px-3 py-2 text-sm text-emerald-100 transition hover:bg-emerald-950"
            >
              Refresh
            </button>
          </div>
        </header>

        <ResourcesBar refreshToken={refreshToken} />

        {loading ? (
          <section className="rounded border border-zinc-800 bg-zinc-900 p-4 text-zinc-300">Loading round...</section>
        ) : error ? (
          <section className="rounded border border-red-900 bg-red-950/40 p-4 text-red-100">{error}</section>
        ) : round ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <QuestionList roundId={roundId} questions={round.questions} onSubmitted={fetchRound} />
            <aside className="flex flex-col gap-4">
              <CraftingPanel onCrafted={fetchRound} />
              {roundId === 3 ? <PvpPanel /> : null}
            </aside>
          </div>
        ) : null}
      </div>
    </main>
  );
}