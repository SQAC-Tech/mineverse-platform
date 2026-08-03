'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Play, RefreshCw, ChevronRight, Gavel } from 'lucide-react';
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

export default function AdminGradingPage() {
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [run, setRun] = useState<RunRow | null>(null);
  const [review, setReview] = useState<ReviewRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedRound, setSelectedRound] = useState<number | ''>('');

  const [overrideFor, setOverrideFor] = useState<ReviewRow | null>(null);
  const [overrideScore, setOverrideScore] = useState('1');
  const [overrideReason, setOverrideReason] = useState('');

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
              <p style={{ marginTop: 10, color: '#ff9db0', fontSize: 10.5 }}>{run.error}</p>
            )}
          </Panel>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <Panel
          title={`Manual review (${review?.length ?? 0})`}
          subtitle="Answers with no deterministic key — score them by hand with an audited reason"
        >
          {!review ? (
            <Loading label="Loading queue" />
          ) : (
            <Table head={['Team', 'Round', 'Answer', 'Rev', 'Submitted', '']}>
              {review.map((row) => (
                <tr key={row.id}>
                  <td className="n-mono">{row.team_id.slice(0, 8)}…</td>
                  <td>{row.round_id}</td>
                  <td style={{ maxWidth: 380 }}>
                    <div
                      style={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: 60,
                        overflow: 'hidden',
                        fontSize: 10.5,
                      }}
                    >
                      {row.answer_text || row.code || <span className="n-panel-sub">empty</span>}
                    </div>
                  </td>
                  <td>{row.revision}</td>
                  <td className="n-panel-sub">{new Date(row.submitted_at).toLocaleTimeString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Btn small onClick={() => { setOverrideFor(row); setOverrideScore('1'); setOverrideReason(''); }}>
                      <Gavel size={11} /> Score
                    </Btn>
                  </td>
                </tr>
              ))}
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
          <div className="n-panel" style={{ maxWidth: 460, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="n-panel-head">
              <div>
                <div className="n-panel-title">Score submission</div>
                <div className="n-panel-sub n-mono">{overrideFor.id.slice(0, 8)}… · rev {overrideFor.revision}</div>
              </div>
            </div>
            <div className="n-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  padding: 10,
                  background: 'var(--bg-void)',
                  border: '1px solid rgb(150 35 14 / 25%)',
                  fontSize: 10.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 160,
                  overflowY: 'auto',
                }}
              >
                {overrideFor.answer_text || overrideFor.code || 'empty'}
              </div>

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
