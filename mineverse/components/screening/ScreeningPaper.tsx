'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Flag, Loader2, Timer, WifiOff } from 'lucide-react';
import { useProctorSession } from '@/components/game/proctor/ProctorProvider';
import { SCREENING_QUESTION_COUNT } from '@/lib/screening/config';
import './screening-ui.css';

interface Question {
  id: string;
  number: number;
  prompt: string;
  options: string[];
  selected_slot: number | null;
}

interface Attempt {
  attempt_id: string;
  deadline_at: string;
  seconds_remaining: number;
  questions: Question[];
  status: 'in_progress' | 'submitted' | 'expired';
  submitted_at: string | null;
}

const OPTION_KEYS = ['A', 'B', 'C', 'D'];

function clock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

/**
 * Prose stays prose; a bare row of numbers or a list becomes a monospace block.
 * A series like "2, 6, 12, 20, 30, ?" is markedly harder to read in a
 * proportional face, and these questions live or die on reading them right.
 */
function promptBlocks(prompt: string) {
  return prompt.split('\n').map((line) => ({
    text: line,
    mono: /^[\s\d,.\[\]?:+×x/-]+$/.test(line.trim()) && /\d/.test(line),
  }));
}

export function ScreeningPaper({ initial }: { initial: Attempt }) {
  const router = useRouter();
  const proctor = useProctorSession();

  const [questions, setQuestions] = useState<Question[]>(initial.questions);
  const [index, setIndex] = useState(0);
  const [deadline] = useState(() => new Date(initial.deadline_at).getTime());
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [offline, setOffline] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submittedRef = useRef(false);

  const remaining = Math.max(0, Math.floor((deadline - now) / 1000));
  const answered = questions.filter((question) => question.selected_slot !== null).length;
  const current = questions[index];

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(tick);
  }, []);

  const finish = useCallback(
    async (auto: boolean) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      try {
        await fetch('/api/screening/attempt', { method: 'POST', keepalive: true });
      } catch {
        // The server expires the attempt on its own deadline, so a failed
        // request here delays the record rather than losing the paper.
      }
      // Ends the proctor session and leaves fullscreen before navigating, so the
      // result screen is not stuck behind a fullscreen scrim.
      await proctor?.finish();
      router.replace(auto ? '/screening/done?auto=1' : '/screening/done');
    },
    [proctor, router],
  );

  // The clock is the server's; this only notices when it has run out.
  useEffect(() => {
    if (remaining === 0 && !submittedRef.current) void finish(true);
  }, [remaining, finish]);

  const pick = async (slot: number) => {
    if (!current || submittedRef.current) return;

    const previous = current.selected_slot;
    // Optimistic: at 72 seconds a question, waiting on a round trip to see your
    // own click is the wrong trade.
    setQuestions((all) =>
      all.map((question) => (question.id === current.id ? { ...question, selected_slot: slot } : question)),
    );
    setSaving(true);

    try {
      const res = await fetch('/api/screening/attempt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: current.id, selected_slot: slot }),
      });
      const json = await res.json();
      if (!json.success) {
        if (json.error?.code === 'TIME_UP') {
          void finish(true);
          return;
        }
        throw new Error(json.error?.code ?? 'SAVE_FAILED');
      }
      setOffline(false);
    } catch {
      // Roll back rather than showing an answer the server does not have.
      setQuestions((all) =>
        all.map((question) => (question.id === current.id ? { ...question, selected_slot: previous } : question)),
      );
      setOffline(true);
    } finally {
      setSaving(false);
    }
  };

  const go = (to: number) => setIndex(Math.max(0, Math.min(questions.length - 1, to)));

  // A, B, C, D pick; arrows move. Keeps hands off the mouse when the clock is short.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (confirming || submittedRef.current) return;
      const key = event.key.toUpperCase();
      const slot = OPTION_KEYS.indexOf(key);
      if (slot >= 0) { void pick(slot); return; }
      if (event.key === 'ArrowRight') go(index + 1);
      if (event.key === 'ArrowLeft') go(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const clockClass = useMemo(() => {
    if (remaining <= 60) return 'scr__clock scr__clock--critical';
    if (remaining <= 300) return 'scr__clock scr__clock--warn';
    return 'scr__clock';
  }, [remaining]);

  if (!current) return null;

  return (
    <div className="round-ui--night scr">
      <div className="scr__backdrop" aria-hidden="true" />
      <div className="scr__shade" aria-hidden="true" />

      <div className="scr__inner">
        <header className="scr__bar">
          <div className="scr__brand">
            <b>Screening Round</b>
            <span>One attempt · no going back after you submit</span>
          </div>
          <span className="scr__progress">
            <b>{answered}</b> of {questions.length} answered
          </span>
          <div className={clockClass} role="timer" aria-live="off">
            <Timer size={15} aria-hidden="true" />
            {clock(remaining)}
          </div>
        </header>

        <div className="scr__grid">
          <nav className="scr__panel" aria-label="Question navigator">
            <div className="scr__panel-head">Questions</div>
            <div className="scr__nav">
              {questions.map((question, position) => (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => go(position)}
                  aria-label={`Question ${question.number}${question.selected_slot !== null ? ', answered' : ', not answered'}`}
                  aria-current={position === index ? 'true' : undefined}
                  className={[
                    'scr__dot',
                    question.selected_slot !== null ? 'scr__dot--done' : '',
                    position === index ? 'scr__dot--current' : '',
                  ].filter(Boolean).join(' ')}
                >
                  {question.number}
                </button>
              ))}
            </div>
            <div className="scr__legend">
              <div><span className="scr__swatch scr__swatch--done" /> Answered</div>
              <div><span className="scr__swatch" /> Not answered yet</div>
            </div>
          </nav>

          <section className="scr__panel scr__q">
            <div className="scr__q-head">
              <span className="scr__q-num">Question {current.number}</span>
              <span className="scr__q-of">of {questions.length}</span>
              {offline && (
                <span className="scr__progress" style={{ color: 'var(--rd-bad)' }}>
                  <WifiOff size={12} aria-hidden="true" /> Not saved — check your connection
                </span>
              )}
            </div>

            <div className="scr__prompt">
              {promptBlocks(current.prompt).map((block, position) =>
                block.text.trim() === '' ? null : block.mono ? (
                  <pre key={position}>{block.text}</pre>
                ) : (
                  <p key={position}>{block.text}</p>
                ),
              )}
            </div>

            <div className="scr__options" role="radiogroup" aria-label={`Options for question ${current.number}`}>
              {current.options.map((option, slot) => (
                <button
                  key={slot}
                  type="button"
                  role="radio"
                  aria-checked={current.selected_slot === slot}
                  className={`scr__opt ${current.selected_slot === slot ? 'scr__opt--on' : ''}`}
                  onClick={() => void pick(slot)}
                >
                  <span className="scr__key" aria-hidden="true">{OPTION_KEYS[slot]}</span>
                  <span>{option}</span>
                </button>
              ))}
            </div>

            <div className="scr__actions">
              <span className="scr__saving">
                {saving ? 'Saving…' : 'Every answer is saved as you pick it'}
              </span>
              <button type="button" className="scr__btn" onClick={() => go(index - 1)} disabled={index === 0}>
                <ChevronLeft size={14} aria-hidden="true" /> Previous
              </button>
              {index < questions.length - 1 ? (
                <button type="button" className="scr__btn scr__btn--go" onClick={() => go(index + 1)}>
                  Save &amp; next <ChevronRight size={14} aria-hidden="true" />
                </button>
              ) : (
                <button type="button" className="scr__btn scr__btn--submit" onClick={() => setConfirming(true)}>
                  <Flag size={14} aria-hidden="true" /> Submit paper
                </button>
              )}
            </div>
          </section>
        </div>

        {/* Reachable from anywhere, not only the last question — a team that is
            done at question 12 should not have to click through thirteen more. */}
        {index < questions.length - 1 && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button type="button" className="scr__btn scr__btn--submit" onClick={() => setConfirming(true)}>
              <Flag size={14} aria-hidden="true" /> Submit paper and finish
            </button>
          </div>
        )}
      </div>

      {confirming && (
        <div className="scr__modal" role="alertdialog" aria-modal="true" aria-labelledby="scr-confirm">
          <div className="scr__modal-card">
            <h2 id="scr-confirm">Submit your paper?</h2>
            {answered < questions.length ? (
              <p>
                You have answered <strong>{answered} of {questions.length}</strong>. The other{' '}
                <strong>{questions.length - answered}</strong> will be left blank.
              </p>
            ) : (
              <p>All {questions.length} questions are answered.</p>
            )}
            <p>This cannot be undone, and you cannot sit the paper again.</p>
            <div className="scr__modal-actions">
              <button type="button" className="scr__btn" onClick={() => setConfirming(false)} disabled={submitting}>
                Keep working
              </button>
              <button
                type="button"
                className="scr__btn scr__btn--submit"
                onClick={() => void finish(false)}
                disabled={submitting}
              >
                {submitting ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Submitting…</> : 'Submit for good'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { SCREENING_QUESTION_COUNT };
