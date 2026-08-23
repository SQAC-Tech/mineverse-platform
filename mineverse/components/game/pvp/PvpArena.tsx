'use client';

import { useMemo, useState, useEffect } from 'react';
import { X, Swords, Check, XOctagon } from 'lucide-react';
import { promptBlocks } from '../custom-round-ui/round-presentation';
import type { PvpMatch } from './PvpPanel';

function remaining(deadline: string | null) {
  if (!deadline) return '00:00';
  const total = Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000));
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}

export interface PvpArenaProps {
  match: PvpMatch;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

export function PvpArena({ match, onClose, onRefresh }: PvpArenaProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!activeQuestionId && match.questions.length > 0) {
      setActiveQuestionId(match.questions[0].id);
    }
  }, [match.questions, activeQuestionId]);

  useEffect(() => {
    if (match.status !== 'live') return;
    const clock = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(clock);
  }, [match.status]);

  const submissions = useMemo(() => {
    const map = new Map<string, PvpMatch['submissions'][number]>();
    for (const sub of match.submissions) map.set(sub.match_question_id, sub);
    return map;
  }, [match.submissions]);

  const submit = async (questionId: string) => {
    setSubmitting(questionId);
    try {
      const res = await fetch('/api/team/pvp/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ match_question_id: questionId, answer_text: drafts[questionId] ?? '' }),
      });
      const json = await res.json();
      if (json.success) {
        setDrafts((current) => ({ ...current, [questionId]: '' }));
        await onRefresh();
      }
    } finally {
      setSubmitting(null);
    }
  };

  const activeQ = match.questions.find((q) => q.id === activeQuestionId);

  return (
    <div className="round-ui__pvp-arena round-ui round-ui--mountain">
      <div className="round-ui__backdrop" />
      <div className="round-ui__shade" />
      
      <header className="round-ui__header round-ui__panel--glass" style={{ padding: '8px', zIndex: 10 }}>
        <div className="round-ui__brand">
          <Swords size={28} className="text-amber-500" />
          <div>
            <div className="round-ui__brand-name text-amber-500">PRIVATE PVP DUEL</div>
            <div className="round-ui__brand-tag">Round 3 Elimination Match</div>
          </div>
        </div>
        <div className="round-ui__timer" style={{ marginLeft: 'auto' }}>
          <div className="round-ui__timer-label">DEADLINE</div>
          <div className="round-ui__pvp-countdown">{remaining(match.deadline_at)}</div>
        </div>
        <div className="round-ui__tools">
          <button className="round-ui__icon-btn" onClick={onClose} aria-label="Close PvP" title="Exit Match">
            <X size={24} />
          </button>
        </div>
      </header>

      {match.status === 'resolved' && match.result && (
        <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}>
          <div className="round-ui__pvp-result">
            <div className={`round-ui__pvp-result-title ${match.result.won ? 'round-ui__pvp-result-title--won' : 'round-ui__pvp-result-title--lost'}`}>
              {match.result.won ? 'MATCH WON' : 'MATCH LOST'}
            </div>
            {match.result.summary && (
              <div className="round-ui__pvp-result-award">{match.result.summary}</div>
            )}
            <button className="n-btn n-btn-secondary" style={{ marginTop: '16px' }} onClick={onClose}>Return to Game</button>
          </div>
        </div>
      )}

      {match.status === 'draft' && (
        <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}>
          <div className="round-ui__pvp-result">
            <div className="round-ui__pvp-result-title">WAITING FOR ADMIN</div>
            <div className="round-ui__pvp-result-award">The match has been drafted. Please wait for an organizer to start the duel.</div>
            <button className="n-btn n-btn-secondary" style={{ marginTop: '16px' }} onClick={onClose}>Return to Game</button>
          </div>
        </div>
      )}

      {match.status === 'live' && (
        <main className="round-ui__main" style={{ padding: '0 clamp(8px, 1.4vw, 18px) 18px', marginTop: '18px' }}>
          <div className="round-ui__board" style={{ gridColumn: '1 / -1' }}>
            <div className="round-ui__board-head">
              <div>
                <h1>PvP Questions</h1>
                <p>Answer faster than the opposing team to win</p>
              </div>
            </div>
            <div className="round-ui__board-grid" style={{ gridTemplateColumns: 'minmax(250px, 0.4fr) minmax(0, 1fr)' }}>
              <div className="round-ui__tile" style={{ padding: 0 }}>
                <div className="round-ui__qlist">
                  {match.questions.map((q) => {
                    const sub = submissions.get(q.id);
                    return (
                      <div
                        key={q.id}
                        className={`round-ui__qitem ${activeQuestionId === q.id ? 'round-ui__qitem--active' : ''}`}
                        onClick={() => setActiveQuestionId(q.id)}
                      >
                        <div className="round-ui__qitem-no">{q.display_order}</div>
                        <div className="round-ui__qitem-text">
                          <strong>{q.type.replace(/_/g, ' ')}</strong>
                          <small>Submitted r{sub ? sub.revision : 0}</small>
                        </div>
                        <div className={`round-ui__qitem-state ${sub?.status === 'correct' ? 'round-ui__qitem-state--done' : sub?.status === 'incorrect' ? 'bg-red-500' : sub ? 'round-ui__qitem-state--sent' : ''}`}>
                          {sub?.status === 'correct' && <Check size={9} color="white" />}
                          {sub?.status === 'incorrect' && <XOctagon size={9} color="white" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="round-ui__tile round-ui__answer">
                {activeQ ? (
                  <>
                    <div className="round-ui__question-title">
                      Question {activeQ.display_order}
                      <span className="round-ui__type-badge">{activeQ.type.replace(/_/g, ' ')}</span>
                    </div>
                    
                    <div className="round-ui__prompt-blocks" style={{ flex: 1 }}>
                      {promptBlocks(activeQ.prompt).map((block, idx) =>
                        block.kind === 'code' ? (
                          <pre key={idx} className="round-ui__code"><code>{block.body}</code></pre>
                        ) : (
                          <div key={idx} className="round-ui__prompt">{block.body}</div>
                        )
                      )}
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '2px solid var(--rd-board-line)' }}>
                      <div className="round-ui__field-label">YOUR ANSWER</div>
                      <textarea
                        className="n-textarea"
                        style={{ width: '100%', minHeight: '60px', background: 'var(--rd-board-sunk)', border: '2px solid var(--rd-board-line)', color: 'var(--rd-board-ink)', padding: '8px', fontSize: '13px', borderRadius: '2px' }}
                        value={drafts[activeQ.id] ?? ''}
                        onChange={(e) => setDrafts((cur) => ({ ...cur, [activeQ.id]: e.target.value }))}
                        placeholder="Type your answer here..."
                        disabled={submissions.get(activeQ.id)?.status === 'correct'}
                      />
                      
                      <div className="round-ui__section-actions" style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                        <button
                          className="n-btn n-btn-primary"
                          style={{ flex: 1, display: 'block', padding: '12px', fontSize: '14px' }}
                          onClick={() => submit(activeQ.id)}
                          disabled={submitting === activeQ.id || !(drafts[activeQ.id] ?? '').trim() || submissions.get(activeQ.id)?.status === 'correct'}
                        >
                          {submitting === activeQ.id ? 'SUBMITTING...' : submissions.get(activeQ.id)?.status === 'correct' ? 'CORRECT' : 'SUBMIT ANSWER'}
                        </button>
                        <button
                          className="n-btn n-btn-secondary"
                          style={{ padding: '12px', fontSize: '14px', flexShrink: 0 }}
                          onClick={() => {
                            const currentIndex = match.questions.findIndex((q) => q.id === activeQ.id);
                            if (currentIndex < match.questions.length - 1) {
                              setActiveQuestionId(match.questions[currentIndex + 1].id);
                            }
                          }}
                          disabled={match.questions.findIndex((q) => q.id === activeQ.id) === match.questions.length - 1}
                        >
                          NEXT ❯
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="round-ui__empty">Select a question from the list to answer.</div>
                )}
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
