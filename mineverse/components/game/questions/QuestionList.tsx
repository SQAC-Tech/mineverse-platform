'use client';

import { useEffect, useMemo, useState } from 'react';

interface Question {
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

interface QuestionListProps {
  roundId: number;
  questions: Question[];
  onSubmitted: () => void | Promise<void>;
}

function draftKey(roundId: number, questionId: string) {
  return `mineverse:round:${roundId}:question:${questionId}:draft`;
}

function statusLabel(question: Question) {
  if (!question.submission_status) return 'Not submitted';
  if (question.submission_revision) return `${question.submission_status} r${question.submission_revision}`;
  return question.submission_status;
}

export function QuestionList({ roundId, questions, onSubmitted }: QuestionListProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loaded: Record<string, string> = {};
    for (const question of questions) loaded[question.id] = window.localStorage.getItem(draftKey(roundId, question.id)) ?? '';
    setDrafts(loaded);
  }, [roundId, questions]);

  const ordered = useMemo(() => [...questions].sort((a, b) => a.order_index - b.order_index), [questions]);

  const setDraft = (questionId: string, value: string) => {
    setDrafts((current) => ({ ...current, [questionId]: value }));
    window.localStorage.setItem(draftKey(roundId, questionId), value);
  };

  const submit = async (question: Question) => {
    setSubmitting(question.id);
    setError(null);
    try {
      const draft = drafts[question.id] ?? '';
      const isCode = question.type === 'coding' || question.type === 'code_completion';
      const body = isCode
        ? { question_id: question.id, code: draft, language: question.language_options[0] ?? null }
        : { question_id: question.id, answer_text: draft };

      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? json.error?.code ?? 'Submission failed');
        return;
      }

      window.localStorage.removeItem(draftKey(roundId, question.id));
      setDraft(question.id, '');
      await onSubmitted();
    } catch {
      setError('Submission failed.');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      {error ? <div className="rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-100">{error}</div> : null}
      {ordered.length === 0 ? (
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4 text-zinc-300">No questions are available yet.</div>
      ) : null}
      {ordered.map((question) => {
        const isCode = question.type === 'coding' || question.type === 'code_completion';
        return (
          <article key={question.id} className="rounded border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-xs uppercase text-zinc-500">Question {question.order_index} - {question.type.replace('_', ' ')}</div>
                <h2 className="mt-1 text-lg font-semibold text-white">{question.prompt}</h2>
              </div>
              <span className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300">{statusLabel(question)}</span>
            </div>
            {isCode ? (
              <textarea
                value={drafts[question.id] ?? ''}
                onChange={(event) => setDraft(question.id, event.target.value)}
                className="min-h-48 w-full resize-y rounded border border-zinc-700 bg-zinc-950 p-3 font-mono text-sm text-zinc-100 outline-none focus:border-emerald-500"
                placeholder="Write your solution here"
              />
            ) : (
              <textarea
                value={drafts[question.id] ?? ''}
                onChange={(event) => setDraft(question.id, event.target.value)}
                className="min-h-28 w-full resize-y rounded border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                placeholder="Type your answer"
              />
            )}
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => submit(question)}
                disabled={submitting === question.id || !(drafts[question.id] ?? '').trim()}
                className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                {submitting === question.id ? 'Submitting...' : question.submission_status ? 'Revise' : 'Submit'}
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}