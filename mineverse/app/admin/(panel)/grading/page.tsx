'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Play, RefreshCw, ChevronRight, Gavel, Sparkles, Check, X, Loader2 } from 'lucide-react';
import { Panel, Btn, Pill, statusTone, Table, Empty, Loading, PageTitle, apiCall, Grid, StatTile, Field } from '@/components/admin/nether-ui';

type RoundRow = { id: number; name: string; status: string };
type RunRow = {
  id: string;
  round_id: number;
  state: string;
  processed_count: number;
  total_count: number;
  manual_review_count: number;
  error: string | null;
  processed_in_batch?: number;
  items_by_state?: Record<string, number>;
};
type ReviewRow = {
  id: string;
  team_id: string;
  round_id: number;
  question_id: string;
  answer_text: string | null;
  code: string | null;
  revision: number;
  submitted_at: string;
};

interface AiVerdict {
  score: number;
  reasoning: string;
}

export default function AdminGradingPage() {
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [run, setRun] = useState<RunRow | null>(null);
  const [review, setReview] = useState<ReviewRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedRound, setSelectedRound] = useState<number | ''>('');

  const [overrideFor, setOverrideFor] = useState<ReviewRow | null>(null);
  const [overrideScore, setOverrideScore] = useState('1');
  const [overrideReason, setOverrideReason] = useState('');

  // AI grading state
  const [aiGrading, setAiGrading] = useState<Record<string, boolean>>({});
  const [aiVerdicts, setAiVerdicts] = useState<Record<string, AiVerdict>>({});
  const [batchGrading, setBatchGrading] = useState(false);
  // Tracks which submissions are being quick-marked
  const [quickMarking, setQuickMarking] = useState<Record<string, boolean>>({});

  const loadRounds = useCallback(async () => {
    const res = await apiCall<RoundRow[]>('/api/admin/rounds');
    if (res.ok) setRounds(res.data ?? []);
  }, []);

  const loadReview = useCallback(async () => {
    const res = await apiCall<{ submissions: ReviewRow[] }>('/api/admin/grade/manual-review');
    if (res.ok) setReview(res.data.submissions ?? []);
    else toast.error(res.message);
  }, []);

  useEffect(() => {
    void loadRounds();
    void loadReview();
  }, [loadRounds, loadReview]);

  const startRun = async () => {
    if (selectedRound === '') return;
    setBusy(true);
    const res = await apiCall<RunRow>('/api/admin/grade/runs', {
      method: 'POST',
      body: JSON.stringify({ round_id: Number(selectedRound), process: true }),
    });
    setBusy(false);

    if (res.ok) {
      setRun(res.data);
      toast.success(`Graded ${res.data.processed_in_batch ?? 0} submissions in this batch`);
      void loadReview();
    } else {
      toast.error(res.message);
    }
  };

  const continueRun = async () => {
    if (!run) return;
    setBusy(true);
    const res = await apiCall<RunRow>(`/api/admin/grade/runs/${run.id}`, { method: 'POST' });
    setBusy(false);

    if (res.ok) {
      setRun(res.data);
      if ((res.data.processed_in_batch ?? 0) === 0) toast.success('Grading run complete');
      else toast.success(`Graded ${res.data.processed_in_batch} more`);
      void loadReview();
    } else {
      toast.error(res.message);
    }
  };

  const refreshRun = async () => {
    if (!run) return;
    const res = await apiCall<RunRow>(`/api/admin/grade/runs/${run.id}`);
    if (res.ok) setRun(res.data);
  };

  const submitOverride = async () => {
    if (!overrideFor) return;
    if (!overrideReason.trim()) {
      toast.error('A reason is required for an audited override');
      return;
    }

    setBusy(true);
    const res = await apiCall('/api/admin/grade/overrides', {
      method: 'POST',
      body: JSON.stringify({
        submission_id: overrideFor.id,
        score: Number(overrideScore),
        reason: overrideReason.trim(),
      }),
    });
    setBusy(false);

    if (res.ok) {
      toast.success('Override applied — only the score difference was paid');
      setOverrideFor(null);
      setOverrideReason('');
      void loadReview();
    } else {
      toast.error(res.message);
    }
  };

  // ── AI grading ────────────────────────────────────────────────

  /** Ask the AI for a verdict on one submission (does NOT apply it). */
  const aiGradeOne = async (submissionId: string) => {
    setAiGrading((prev) => ({ ...prev, [submissionId]: true }));
    const res = await apiCall<{ verdict: AiVerdict | null; strategy: string; question_prompt?: string }>(
      '/api/admin/grade/auto-review',
      { method: 'POST', body: JSON.stringify({ submission_id: submissionId }) },
    );
    setAiGrading((prev) => ({ ...prev, [submissionId]: false }));

    if (res.ok && res.data.verdict) {
      setAiVerdicts((prev) => ({ ...prev, [submissionId]: res.data.verdict! }));
      toast.success(`AI scored ${res.data.verdict.score.toFixed(2)}: ${res.data.verdict.reasoning}`);
    } else if (res.ok && !res.data.verdict) {
      toast.error('AI could not produce a verdict. Score manually.');
    } else if (!res.ok) {
      toast.error(res.message ?? 'AI grading failed');
    }
  };

  /** Ask AI to grade and auto-apply the score for one submission. */
  const aiGradeAndApply = async (submissionId: string) => {
    setAiGrading((prev) => ({ ...prev, [submissionId]: true }));
    const res = await apiCall<{ verdict: AiVerdict | null; applied: boolean; applied_score?: number }>(
      '/api/admin/grade/auto-review',
      { method: 'POST', body: JSON.stringify({ submission_id: submissionId, apply: true }) },
    );
    setAiGrading((prev) => ({ ...prev, [submissionId]: false }));

    if (res.ok && res.data.applied) {
      toast.success(`AI applied score ${res.data.applied_score}: ${res.data.verdict?.reasoning ?? ''}`);
      void loadReview();
    } else if (res.ok && !res.data.verdict) {
      toast.error('AI could not produce a verdict. Score manually.');
    } else if (!res.ok) {
      toast.error(res.message ?? 'AI grading failed');
    }
  };

  /** Batch: auto-grade all pending submissions with AI, 5 at a time. */
  const aiGradeAll = async () => {
    if (!review || review.length === 0) return;
    setBatchGrading(true);
    let graded = 0;
    let failed = 0;
    const BATCH_SIZE = 5;

    for (let i = 0; i < review.length; i += BATCH_SIZE) {
      const chunk = review.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        chunk.map((row) =>
          apiCall<{ verdict: AiVerdict | null; applied: boolean }>(
            '/api/admin/grade/auto-review',
            { method: 'POST', body: JSON.stringify({ submission_id: row.id, apply: true }) },
          ),
        ),
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.ok && result.value.data.applied) graded++;
        else failed++;
      }

      toast.info(`AI batch: ${graded + failed} / ${review.length} done (${graded} graded, ${failed} need review)`);
    }

    setBatchGrading(false);
    toast.success(`AI batch complete: ${graded} graded, ${failed} need manual review`);
    void loadReview();
  };

  /** Quick mark: apply score directly without requiring a reason. */
  const quickMark = async (submissionId: string, score: number) => {
    setQuickMarking((prev) => ({ ...prev, [submissionId]: true }));
    const reason = score === 1 ? 'Marked correct by admin' : 'Marked incorrect by admin';
    const res = await apiCall('/api/admin/grade/overrides', {
      method: 'POST',
      body: JSON.stringify({ submission_id: submissionId, score, reason }),
    });
    setQuickMarking((prev) => ({ ...prev, [submissionId]: false }));

    if (res.ok) {
      toast.success(score === 1 ? 'Marked correct ✓' : 'Marked incorrect ✗');
      void loadReview();
    } else {
      toast.error(res.message);
    }
  };

  const gradableRounds = rounds.filter((r) => r.status !== 'active');

  return (
    <>
      <PageTitle
        title="Grading"
        subtitle="Deterministic answers are scored and paid immediately; anything without an answer key waits here for a decision"
        actions={<Btn onClick={() => { void loadRounds(); void loadReview(); }}><RefreshCw size={12} /> Refresh</Btn>}
      />

      <Panel title="Start a grading run" subtitle="A round must be locked in round control before it can be graded">
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 220 }}>
            <Field label="Round">
              <select
                className="n-select"
                value={selectedRound}
                onChange={(e) => setSelectedRound(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">Select a locked round…</option>
                {rounds.map((r) => (
                  <option key={r.id} value={r.id} disabled={r.status === 'active'}>
                    {r.name} {r.status === 'active' ? '(still active)' : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Btn variant="primary" disabled={busy || selectedRound === ''} onClick={startRun}>
            <Play size={12} /> {busy ? 'Working…' : 'Start / resume run'}
          </Btn>
        </div>

        {gradableRounds.length === 0 && (
          <p className="n-panel-sub" style={{ marginTop: 10 }}>
            No round is locked yet. End a round in Round control first.
          </p>
        )}
      </Panel>

      {run && (
        <div style={{ marginTop: 12 }}>
          <Panel
            title="Current run"
            subtitle={run.id}
            actions={
              <>
                <Pill tone={statusTone(run.state)}>{run.state}</Pill>
                <Btn small onClick={refreshRun}><RefreshCw size={11} /> Status</Btn>
                <Btn
                  small
                  variant="primary"
                  disabled={busy || run.state === 'completed'}
                  onClick={continueRun}
                >
                  <ChevronRight size={11} /> Next batch
                </Btn>
              </>
            }
          >
            <Grid min={170}>
              <StatTile label="Processed" value={run.processed_count ?? 0} hint={`of ${run.total_count ?? 0} submissions`} />
              <StatTile label="Manual review" value={run.manual_review_count ?? 0} hint="No answer key" />
              <StatTile label="Round" value={run.round_id} />
            </Grid>
            {run.error && (
              <p style={{ marginTop: 10, color: '#ff9db0', fontSize: 12.5 }}>{run.error}</p>
            )}
          </Panel>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <Panel
          title={`Manual review (${review?.length ?? 0})`}
          subtitle="Answers with no deterministic key — use AI to auto-grade or score by hand"
          actions={
            review && review.length > 0 ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn
                  small
                  variant="primary"
                  disabled={batchGrading}
                  onClick={aiGradeAll}
                  title="Run AI on every pending submission and auto-apply scores"
                >
                  <Sparkles size={11} /> {batchGrading ? 'AI grading…' : 'Auto-grade all with AI'}
                </Btn>
              </div>
            ) : undefined
          }
        >
          {!review ? (
            <Loading label="Loading queue" />
          ) : (
            <Table head={['Team', 'Round', 'Answer', 'AI Verdict', 'Rev', 'Actions']}>
              {review.map((row) => {
                const isAiRunning = aiGrading[row.id];
                const verdict = aiVerdicts[row.id];
                const isMarking = quickMarking[row.id];

                return (
                  <tr key={row.id}>
                    <td className="n-mono">{row.team_id.slice(0, 8)}…</td>
                    <td>{row.round_id}</td>
                    <td style={{ maxWidth: 340 }}>
                      <div
                        style={{
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          maxHeight: 60,
                          overflow: 'hidden',
                          fontSize: 12.5,
                        }}
                      >
                        {row.answer_text || row.code || <span className="n-panel-sub">empty</span>}
                      </div>
                    </td>
                    <td style={{ minWidth: 140 }}>
                      {isAiRunning ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#f2c14e' }}>
                          <Loader2 size={12} className="n-portal-spinner" style={{ animation: 'n-spin 0.8s linear infinite' }} /> Thinking…
                        </span>
                      ) : verdict ? (
                        <div style={{ fontSize: 11.5 }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 7px',
                              borderRadius: 2,
                              fontWeight: 600,
                              fontSize: 11,
                              background: verdict.score >= 0.5 ? 'rgba(74,222,128,0.15)' : 'rgba(255,100,100,0.15)',
                              color: verdict.score >= 0.5 ? '#4ade80' : '#ff9db0',
                              border: `1px solid ${verdict.score >= 0.5 ? 'rgba(74,222,128,0.4)' : 'rgba(255,100,100,0.4)'}`,
                            }}
                          >
                            {verdict.score >= 0.5 ? '✓' : '✗'} {verdict.score.toFixed(2)}
                          </span>
                          <div className="n-panel-sub" style={{ marginTop: 3, fontSize: 10.5 }}>
                            {verdict.reasoning}
                          </div>
                        </div>
                      ) : (
                        <span className="n-panel-sub" style={{ fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td>{row.revision}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {/* AI grade button */}
                        <Btn
                          small
                          disabled={isAiRunning || isMarking}
                          onClick={() => void aiGradeOne(row.id)}
                          title="Ask AI for a verdict"
                        >
                          <Sparkles size={10} /> AI
                        </Btn>

                        {/* Quick mark correct */}
                        <Btn
                          small
                          disabled={isMarking || isAiRunning}
                          onClick={() => void quickMark(row.id, 1)}
                          title="Mark correct (score = 1)"
                          style={{ color: '#4ade80', borderColor: 'rgba(74,222,128,0.4)' }}
                        >
                          <Check size={10} /> ✓
                        </Btn>

                        {/* Quick mark incorrect */}
                        <Btn
                          small
                          disabled={isMarking || isAiRunning}
                          onClick={() => void quickMark(row.id, 0)}
                          title="Mark incorrect (score = 0)"
                          style={{ color: '#ff9db0', borderColor: 'rgba(255,100,100,0.4)' }}
                        >
                          <X size={10} /> ✗
                        </Btn>

                        {/* AI grade + auto-apply */}
                        {verdict && (
                          <Btn
                            small
                            variant="primary"
                            disabled={isAiRunning || isMarking}
                            onClick={() => void aiGradeAndApply(row.id)}
                            title={`Apply AI score: ${verdict.score >= 0.5 ? 1 : 0}`}
                          >
                            Apply AI
                          </Btn>
                        )}

                        {/* Full override dialog */}
                        <Btn
                          small
                          onClick={() => { setOverrideFor(row); setOverrideScore('1'); setOverrideReason(''); }}
                          title="Open full scoring dialog with reason"
                        >
                          <Gavel size={10} /> Score
                        </Btn>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {review.length === 0 && <Empty colSpan={6}>Nothing waiting for review</Empty>}
            </Table>
          )}
        </Panel>
      </div>

      {overrideFor && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgb(0 0 0 / 72%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setOverrideFor(null)}
        >
          <div className="n-panel" style={{ maxWidth: 500, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="n-panel-head">
              <div>
                <div className="n-panel-title">Score submission</div>
                <div className="n-panel-sub n-mono">{overrideFor.id.slice(0, 8)}… · rev {overrideFor.revision}</div>
              </div>
              {aiVerdicts[overrideFor.id] && (
                <Pill
                  tone={aiVerdicts[overrideFor.id].score >= 0.5 ? 'ok' : 'danger'}
                >
                  AI: {aiVerdicts[overrideFor.id].score.toFixed(2)}
                </Pill>
              )}
            </div>
            <div className="n-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  padding: 10,
                  background: 'var(--bg-void)',
                  border: '1px solid rgb(from var(--accent-muted) r g b / 25%)',
                  fontSize: 12.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 160,
                  overflowY: 'auto',
                }}
              >
                {overrideFor.answer_text || overrideFor.code || 'empty'}
              </div>

              {/* Show AI verdict inline if available */}
              {aiVerdicts[overrideFor.id] && (
                <div
                  style={{
                    padding: '8px 10px',
                    background: aiVerdicts[overrideFor.id].score >= 0.5
                      ? 'rgba(74,222,128,0.08)' : 'rgba(255,100,100,0.08)',
                    border: `1px solid ${aiVerdicts[overrideFor.id].score >= 0.5
                      ? 'rgba(74,222,128,0.3)' : 'rgba(255,100,100,0.3)'}`,
                    borderRadius: 2,
                    fontSize: 11.5,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 3 }}>
                    <Sparkles size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                    AI verdict: {aiVerdicts[overrideFor.id].score.toFixed(2)}
                    {' '}({aiVerdicts[overrideFor.id].score >= 0.5 ? 'correct' : 'incorrect'})
                  </div>
                  <div className="n-panel-sub">{aiVerdicts[overrideFor.id].reasoning}</div>
                </div>
              )}

              {/* AI grade button inside dialog */}
              {!aiVerdicts[overrideFor.id] && (
                <Btn
                  disabled={aiGrading[overrideFor.id]}
                  onClick={() => void aiGradeOne(overrideFor.id)}
                >
                  <Sparkles size={11} /> {aiGrading[overrideFor.id] ? 'AI thinking…' : 'Ask AI for verdict'}
                </Btn>
              )}

              <Field label="Score" hint="1 = correct, 0 = incorrect. Only the difference from the previous score is paid.">
                <select className="n-select" value={overrideScore} onChange={(e) => setOverrideScore(e.target.value)}>
                  <option value="1">1 — correct</option>
                  <option value="0">0 — incorrect</option>
                </select>
              </Field>

              <Field label="Reason (required)">
                <textarea
                  className="n-textarea"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Why this score was applied"
                />
              </Field>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Btn variant="ghost" onClick={() => setOverrideFor(null)}>Cancel</Btn>

                {/* Apply AI verdict shortcut */}
                {aiVerdicts[overrideFor.id] && (
                  <Btn
                    variant="primary"
                    disabled={busy}
                    onClick={() => void aiGradeAndApply(overrideFor.id).then(() => { setOverrideFor(null); })}
                  >
                    <Sparkles size={11} /> Apply AI ({aiVerdicts[overrideFor.id].score >= 0.5 ? '1' : '0'})
                  </Btn>
                )}

                <Btn variant="primary" disabled={busy || !overrideReason.trim()} onClick={submitOverride}>
                  Apply override
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
