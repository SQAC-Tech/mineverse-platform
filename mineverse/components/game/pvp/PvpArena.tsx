'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Swords, Check, ChevronRight, Loader2, Trophy, Frown } from 'lucide-react';
import { promptBlocks } from '../custom-round-ui/round-presentation';
import type { PvpMatch } from './types';
import './pvp-arena.css';

function remaining(deadline: string | null) {
  if (!deadline) return '--:--';
  const total = Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000));
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}

export interface PvpArenaProps {
  match: PvpMatch;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

/**
 * The duel itself.
 *
 * ## Save and next, not submit per question
 *
 * Every question is written to the server as the team moves off it. That is not
 * an autosave convenience — it is what makes the finish rule fair. The duel
 * ends the moment either side presses SUBMIT, and the opponent is marked on
 * whatever the server holds for them at that instant. A local draft would mean
 * a team that had answered four questions correctly but never sent them scored
 * zero because somebody else was quicker to the button.
 *
 * ## One submit, at the end
 *
 * The last question's button ends the duel for both teams: it grades each side
 * against the sealed pack, picks a winner and pays the award, with no organiser
 * involved. It is deliberately the only irreversible control on the screen, and
 * it only appears once there is nowhere left to go next.
 */
export function PvpArena({ match, onClose, onRefresh }: PvpArenaProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [index, setIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [, setTick] = useState(0);

  const questions = match.questions;
  const question = questions[index] ?? null;
  const isLast = index === questions.length - 1;
  const isLive = match.status === 'live';

  const submissions = useMemo(() => {
    const map = new Map<string, PvpMatch['submissions'][number]>();
    for (const sub of match.submissions) map.set(sub.match_question_id, sub);
    return map;
  }, [match.submissions]);

  /**
   * Seed the boxes from what the server already holds.
   *
   * Only for questions the team has not typed into this sitting — overwriting a
   * live draft on a poll tick would delete what somebody was in the middle of
   * writing.
   */
  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      let changed = false;
      for (const sub of match.submissions) {
        const saved = (sub as { answer_text?: string }).answer_text;
        if (saved !== undefined && next[sub.match_question_id] === undefined) {
          next[sub.match_question_id] = saved;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [match.submissions]);

  useEffect(() => {
    if (!isLive) return;
    const clock = window.setInterval(() => setTick((value) => value + 1), 1_000);
    return () => window.clearInterval(clock);
  }, [isLive]);

  /** Writes the current answer, and reports whether it got through. */
  const save = useCallback(
    async (questionId: string): Promise<boolean> => {
      const answer = (drafts[questionId] ?? '').trim();
      // An empty box is a question the team chose to skip. Nothing to store,
      // and the finish path treats a missing answer as unanswered anyway.
      if (!answer) return true;

      try {
        const response = await fetch('/api/team/pvp/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
          body: JSON.stringify({ match_question_id: questionId, answer_text: answer }),
        });
        const payload = await response.json();
        if (!payload.success) {
          toast.error(payload.error?.message ?? 'Could not save that answer.');
          return false;
        }
        return true;
      } catch {
        toast.error('Could not reach the server — your answer was not saved.');
        return false;
      }
    },
    [drafts],
  );

  const saveAndNext = useCallback(async () => {
    if (!question) return;
    setBusy(true);
    try {
      const ok = await save(question.id);
      // Moving on regardless would be the worst of both: the team believes the
      // answer is in, and the server never got it.
      if (ok) setIndex((value) => Math.min(questions.length - 1, value + 1));
    } finally {
      setBusy(false);
    }
  }, [question, save, questions.length]);

  const submitAll = useCallback(async () => {
    setBusy(true);
    setConfirming(false);
    try {
      if (question) await save(question.id);

      const response = await fetch('/api/team/pvp/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: match.id }),
      });
      const payload = await response.json();

      if (!payload.success) {
        toast.error(payload.error?.message ?? 'Could not end the duel.');
        return;
      }
      await onRefresh();
    } catch {
      toast.error('Could not reach the server. Your answers are saved — try SUBMIT again.');
    } finally {
      setBusy(false);
    }
  }, [question, save, match.id, onRefresh]);

  /**
   * The clock running out ends the duel too.
   *
   * Without this, a duel where neither side pressed SUBMIT would sit live for
   * ever, holding both teams out of the queue. Whichever browser is still open
   * calls it; the server is idempotent, so both calling is harmless.
   */
  const expiredRef = useRef(false);
  useEffect(() => {
    if (!isLive || !match.deadline_at || expiredRef.current) return;
    if (new Date(match.deadline_at).getTime() > Date.now()) return;
    expiredRef.current = true;
    void submitAll();
  }, [isLive, match.deadline_at, submitAll]);

  // ── Resolved ────────────────────────────────────────────────────
  if (match.status === 'resolved') {
    const won = match.result?.won ?? false;
    return (
      <main className="pvpa pvpa--result">
        <div className="pvpa__backdrop" aria-hidden="true" />
        <div className={`pvpa__resultcard ${won ? 'pvpa__resultcard--won' : 'pvpa__resultcard--lost'}`}>
          {won ? <Trophy size={64} aria-hidden="true" /> : <Frown size={64} aria-hidden="true" />}
          <h1>{won ? 'DUEL WON' : 'DUEL LOST'}</h1>
          <p>
            {won
              ? 'The Nether Portal materials and a Nether Core are in your inventory.'
              : 'Your opponent finished first. Better luck in the next round.'}
          </p>
          <button type="button" className="pvpa__btn pvpa__btn--primary" onClick={onClose}>
            RETURN TO DASHBOARD
          </button>
        </div>
      </main>
    );
  }

  // ── Paired, not yet running ─────────────────────────────────────
  if (!isLive) {
    return (
      <main className="pvpa pvpa--result">
        <div className="pvpa__backdrop" aria-hidden="true" />
        <div className="pvpa__resultcard">
          <Loader2 size={56} aria-hidden="true" />
          <h1>ARENA OPENING</h1>
          <p role="status">Your duel is being set up.</p>
          <button type="button" className="pvpa__btn" onClick={onClose}>BACK TO DASHBOARD</button>
        </div>
      </main>
    );
  }

  // ── Live ────────────────────────────────────────────────────────
  return (
    <main className="pvpa">
      <div className="pvpa__backdrop" aria-hidden="true" />

      <header className="pvpa__bar">
        <div className="pvpa__brand">
          <Swords size={22} aria-hidden="true" />
          <div>
            <p className="pvpa__brand-name">THE DUEL</p>
            <p className="pvpa__brand-tag">First to submit ends the match</p>
          </div>
        </div>

        <div className="pvpa__pips" aria-label={`Question ${index + 1} of ${questions.length}`}>
          {questions.map((entry, position) => (
            <span
              key={entry.id}
              className={[
                'pvpa__pip',
                position === index ? 'pvpa__pip--active' : '',
                submissions.has(entry.id) ? 'pvpa__pip--saved' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {submissions.has(entry.id) ? <Check size={11} aria-hidden="true" /> : position + 1}
            </span>
          ))}
        </div>

        <div className="pvpa__clock">
          <span className="pvpa__clock-label">TIME LEFT</span>
          <b>{remaining(match.deadline_at)}</b>
        </div>
      </header>

      <section className="pvpa__board">
        <div className="pvpa__qhead">
          <h1>
            Question {index + 1}
            <span>of {questions.length}</span>
          </h1>
        </div>

        {question && (
          <>
            <div className="pvpa__prompt">
              {promptBlocks(question.prompt).map((block, position) =>
                block.kind === 'code' ? (
                  <pre key={position} className="pvpa__code">
                    <code>{block.body}</code>
                  </pre>
                ) : (
                  <p key={position}>{block.body}</p>
                ),
              )}
            </div>

            <label className="pvpa__answer">
              <span className="pvpa__answer-label">YOUR ANSWER</span>
              <textarea
                value={drafts[question.id] ?? ''}
                onChange={(event) =>
                  setDrafts((current) => ({ ...current, [question.id]: event.target.value }))
                }
                placeholder="Type your answer here…"
                rows={3}
                autoFocus
              />
            </label>

            <div className="pvpa__actions">
              <button
                type="button"
                className="pvpa__btn"
                disabled={index === 0 || busy}
                onClick={() => setIndex((value) => Math.max(0, value - 1))}
              >
                BACK
              </button>

              {isLast ? (
                <button
                  type="button"
                  className="pvpa__btn pvpa__btn--submit"
                  disabled={busy}
                  onClick={() => setConfirming(true)}
                >
                  {busy ? 'SUBMITTING…' : 'SUBMIT'}
                </button>
              ) : (
                <button
                  type="button"
                  className="pvpa__btn pvpa__btn--primary"
                  disabled={busy}
                  onClick={() => void saveAndNext()}
                >
                  {busy ? 'SAVING…' : 'SAVE & NEXT'}
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {confirming && (
        <div className="pvpa__confirm" role="dialog" aria-modal="true" aria-label="Confirm submission">
          <div className="pvpa__confirm-card">
            <h2>Submit the duel?</h2>
            <p>
              This ends the match for both teams straight away. Your opponent is marked on
              whatever they have saved so far, and the result is final.
            </p>
            <div className="pvpa__confirm-actions">
              <button type="button" className="pvpa__btn" onClick={() => setConfirming(false)}>
                KEEP PLAYING
              </button>
              <button
                type="button"
                className="pvpa__btn pvpa__btn--submit"
                onClick={() => void submitAll()}
              >
                SUBMIT &amp; END
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
