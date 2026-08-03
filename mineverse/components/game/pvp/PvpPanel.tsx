'use client';

import { useEffect, useMemo, useState } from 'react';

interface PvpQuestion {
  id: string;
  display_order: number;
  type: string;
  prompt: string;
  content: unknown;
}

interface PvpMatch {
  id: string;
  status: string;
  started_at: string | null;
  deadline_at: string | null;
  resolved_at: string | null;
  own_outcome: string | null;
  result: { won: boolean; summary: string | null } | null;
  questions: PvpQuestion[];
  submissions: Array<{ match_question_id: string; revision: number; status: string; submitted_at: string }>;
}

interface PvpData {
  available: boolean;
  code?: string;
  server_time?: string;
  match?: PvpMatch | null;
}

function remaining(deadline: string | null) {
  if (!deadline) return '--:--';
  const total = Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000));
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}

export function PvpPanel() {
  const [data, setData] = useState<PvpData | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const fetchPvp = async () => {
    try {
      const res = await fetch('/api/team/pvp/current', { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? json.error?.code ?? 'PvP unavailable');
        return;
      }
      setData(json.data);
      setError(null);
    } catch {
      setError('PvP unavailable');
    }
  };

  useEffect(() => {
    void fetchPvp();
    const poll = window.setInterval(fetchPvp, 5000);
    const clock = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  }, []);

  const submissions = useMemo(() => {
    const map = new Map<string, PvpMatch['submissions'][number]>();
    for (const submission of data?.match?.submissions ?? []) map.set(submission.match_question_id, submission);
    return map;
  }, [data?.match?.submissions]);

  const submit = async (questionId: string) => {
    setSubmitting(questionId);
    setError(null);
    try {
      const res = await fetch('/api/team/pvp/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ match_question_id: questionId, answer_text: drafts[questionId] ?? '' }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? json.error?.code ?? 'PvP submit failed');
        return;
      }
      setDrafts((current) => ({ ...current, [questionId]: '' }));
      await fetchPvp();
    } catch {
      setError('PvP submit failed');
    } finally {
      setSubmitting(null);
    }
  };

  if (!data && !error) {
    return <section className="rounded border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">Loading PvP...</section>;
  }

  if (error) {
    return <section className="rounded border border-red-900 bg-red-950/40 p-4 text-sm text-red-100">{error}</section>;
  }

  if (!data?.available) {
    return <section className="rounded border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">PvP is not available yet.</section>;
  }

  if (!data.match) {
    return <section className="rounded border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">No private PvP match has been selected for your team.</section>;
  }

  if (data.match.status !== 'live' && data.match.status !== 'resolved') {
    return (
      <section className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-lg font-semibold text-white">Private PvP</h2>
        <p className="mt-2 text-sm text-zinc-400">You are selected. Waiting for the organizer to start the match.</p>
      </section>
    );
  }

  return (
    <section className="rounded border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Private PvP</h2>
          <p className="mt-1 text-xs text-zinc-500">Server state is authoritative.</p>
        </div>
        <div className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-center">
          <div className="text-xs text-zinc-500">Deadline</div>
          <div className="font-mono text-amber-200">{remaining(data.match.deadline_at)}</div>
        </div>
      </div>

      {data.match.result ? (
        <div className="mt-3 rounded border border-emerald-800 bg-emerald-950/30 p-3 text-sm text-emerald-100">
          Result: {data.match.result.won ? 'Won' : 'Resolved'}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3">
        {data.match.questions.map((question) => {
          const submission = submissions.get(question.id);
          return (
            <article key={question.id} className="rounded border border-zinc-800 bg-zinc-950 p-3">
              <div className="text-xs uppercase text-zinc-500">PvP Question {question.display_order} - {question.type}</div>
              <h3 className="mt-1 font-medium text-zinc-100">{question.prompt}</h3>
              {submission ? <div className="mt-2 text-xs text-emerald-300">Submitted r{submission.revision}</div> : null}
              {data.match?.status === 'live' ? (
                <>
                  <textarea
                    value={drafts[question.id] ?? ''}
                    onChange={(event) => setDrafts((current) => ({ ...current, [question.id]: event.target.value }))}
                    className="mt-3 min-h-20 w-full resize-y rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                    placeholder="Your answer"
                  />
                  <button
                    type="button"
                    onClick={() => submit(question.id)}
                    disabled={submitting === question.id || !(drafts[question.id] ?? '').trim()}
                    className="mt-2 w-full rounded bg-emerald-700 px-3 py-2 text-sm text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                  >
                    {submitting === question.id ? 'Submitting...' : 'Submit PvP Answer'}
                  </button>
                </>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}