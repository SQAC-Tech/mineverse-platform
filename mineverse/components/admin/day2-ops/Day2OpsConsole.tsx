'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardCheck, Dices, Gavel, Plus, RefreshCw, Zap } from 'lucide-react';
import { toast } from 'sonner';
import {
  Btn,
  Empty,
  Field,
  Grid,
  Loading,
  PageTitle,
  Panel,
  Pill,
  Table,
  apiCall,
  statusTone,
  uuid,
} from '@/components/admin/nether-ui';
import {
  ROUND4_AWARDS,
  addDelta,
  day2ResourceKeys,
  type Day2ResourceDelta,
} from '@/lib/day2/events/offline';
import { DAY2_EVENTS, type Day2EventKey } from '@/lib/day2/events/catalog';

type TeamRow = {
  team_id: string;
  qualified_for_day2: boolean;
  teams?: { id: string; team_code: string; team_name: string } | null;
  resources?: Record<string, number> | null;
};

type OfflineResult = {
  id: string;
  team_id: string;
  activity_key: string;
  outcome: string;
  award: Day2ResourceDelta;
  portal_fragment_delta: number;
  volunteer_identity: string;
  recorded_at: string;
  teams?: { team_code: string; team_name: string } | null;
};

type EventRow = {
  id: string;
  event_key: Day2EventKey;
  label: string;
  status: string;
  scope: string;
  starts_at: string;
  ends_at: string | null;
  is_expired: boolean;
};

type RunRow = {
  id: string;
  state: string;
  processed_count: number;
  total_count: number;
  manual_review_count: number;
  processed_in_batch?: number;
  items_by_state?: Record<string, number>;
  error?: string | null;
};

type ReviewRow = {
  id: string;
  team_id: string;
  answer_text: string | null;
  code: string | null;
  revision: number;
  submitted_at: string;
};

type ReconciliationRow = {
  id: string;
  team_id: string;
  state: string;
  portal_repaired: boolean;
  diamond_pickaxe_crafted: boolean;
  reconciled_at: string;
};

function teamLabel(row: TeamRow | undefined) {
  if (!row) return 'Unknown team';
  return `${row.teams?.team_code ?? row.team_id.slice(0, 8)} - ${row.teams?.team_name ?? 'Team'}`;
}

function deltaText(delta?: Day2ResourceDelta | null) {
  const entries = Object.entries(delta ?? {}).filter(([, value]) => Number(value) !== 0);
  return entries.length ? entries.map(([key, value]) => `${Number(value) > 0 ? '+' : ''}${value} ${key}`).join(', ') : '0 effect';
}

function emptyDelta(): Day2ResourceDelta {
  return {};
}

export function Day2OpsConsole() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [offlineResults, setOfflineResults] = useState<OfflineResult[] | null>(null);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [run, setRun] = useState<RunRow | null>(null);
  const [review, setReview] = useState<ReviewRow[] | null>(null);
  const [reconciliations, setReconciliations] = useState<ReconciliationRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [offlineTeamId, setOfflineTeamId] = useState('');
  const [awardIndex, setAwardIndex] = useState(0);
  const [configuredAward, setConfiguredAward] = useState<Day2ResourceDelta>(emptyDelta);
  const [volunteer, setVolunteer] = useState('');
  const [offlineNotes, setOfflineNotes] = useState('');

  const [eventKey, setEventKey] = useState<Day2EventKey>('chorus_fruit_blessing');
  const [eventTargets, setEventTargets] = useState<string[]>([]);
  const [eventReason, setEventReason] = useState('');

  const [adjustTeamId, setAdjustTeamId] = useState('');
  const [adjustDelta, setAdjustDelta] = useState<Day2ResourceDelta>(emptyDelta);
  const [adjustReason, setAdjustReason] = useState('');

  const [reconcileTeamId, setReconcileTeamId] = useState('');
  const [reconcileState, setReconcileState] = useState<'completed' | 'blocked'>('completed');
  const [reconcileNotes, setReconcileNotes] = useState('');

  const selectedAward = ROUND4_AWARDS[awardIndex] ?? ROUND4_AWARDS[0];
  const selectedAdjustTeam = teams.find((team) => team.team_id === adjustTeamId);
  const beforeBalance = useMemo(() => {
    const resources = selectedAdjustTeam?.resources ?? {};
    return Object.fromEntries(day2ResourceKeys.map((key) => [key, Number(resources[key] ?? 0)])) as Record<
      (typeof day2ResourceKeys)[number],
      number
    >;
  }, [selectedAdjustTeam]);
  const afterBalance = useMemo(() => addDelta(beforeBalance, adjustDelta), [beforeBalance, adjustDelta]);

  const load = useCallback(async () => {
    const [teamRes, offlineRes, eventRes, reviewRes, reconciliationRes] = await Promise.all([
      apiCall<{ teams: TeamRow[] }>('/api/admin/day2/resources/teams'),
      apiCall<{ results: OfflineResult[] }>('/api/admin/day2/offline/results'),
      apiCall<{ events: EventRow[] }>('/api/admin/day2/events'),
      apiCall<{ submissions: ReviewRow[] }>('/api/admin/day2/grade/manual-review'),
      apiCall<{ reconciliations: ReconciliationRow[] }>('/api/admin/day2/reconciliation'),
    ]);

    if (teamRes.ok) setTeams(teamRes.data.teams ?? []);
    if (offlineRes.ok) setOfflineResults(offlineRes.data.results ?? []);
    if (eventRes.ok) setEvents(eventRes.data.events ?? []);
    if (reviewRes.ok) setReview(reviewRes.data.submissions ?? []);
    if (reconciliationRes.ok) setReconciliations(reconciliationRes.data.reconciliations ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submitOffline = async () => {
    if (!offlineTeamId || !volunteer.trim()) return;
    const award = selectedAward.requiresConfiguredAward ? configuredAward : selectedAward.award;

    setBusy('offline');
    const res = await apiCall('/api/admin/day2/offline/results', {
      method: 'POST',
      body: JSON.stringify({
        team_id: offlineTeamId,
        activity_key: selectedAward.activityKey,
        outcome: selectedAward.outcome,
        configured_award: selectedAward.requiresConfiguredAward ? award : undefined,
        volunteer_identity: volunteer.trim(),
        notes: offlineNotes.trim() || undefined,
        idempotency_key: uuid(),
      }),
    });
    setBusy(null);

    if (res.ok) {
      toast.success('Round 4 result recorded');
      setOfflineNotes('');
      void load();
    } else {
      toast.error(res.message);
    }
  };

  const triggerEvent = async () => {
    if (!eventReason.trim()) return;

    setBusy('event');
    const res = await apiCall('/api/admin/day2/events/trigger', {
      method: 'POST',
      body: JSON.stringify({
        event_key: eventKey,
        target_team_ids: eventTargets,
        reason: eventReason.trim(),
        idempotency_key: uuid(),
      }),
    });
    setBusy(null);

    if (res.ok) {
      toast.success(`${DAY2_EVENTS[eventKey].label} recorded`);
      setEventReason('');
      setEventTargets([]);
      void load();
    } else {
      toast.error(res.message);
    }
  };

  const startRun = async () => {
    setBusy('grade');
    const res = await apiCall<RunRow>('/api/admin/day2/grade/runs', {
      method: 'POST',
      body: JSON.stringify({ round_id: 5, process: true }),
    });
    setBusy(null);

    if (res.ok) {
      setRun(res.data);
      toast.success(`Processed ${res.data.processed_in_batch ?? 0} submissions`);
      void load();
    } else {
      toast.error(res.message);
    }
  };

  const continueRun = async () => {
    if (!run) return;
    setBusy('grade');
    const res = await apiCall<RunRow>(`/api/admin/day2/grade/runs/${run.id}`, { method: 'POST' });
    setBusy(null);

    if (res.ok) {
      setRun(res.data);
      toast.success((res.data.processed_in_batch ?? 0) === 0 ? 'Run complete' : 'Batch processed');
      void load();
    } else {
      toast.error(res.message);
    }
  };

  const submitAdjustment = async () => {
    if (!adjustTeamId || !adjustReason.trim()) return;

    setBusy('adjust');
    const res = await apiCall('/api/admin/day2/resources/adjustments', {
      method: 'POST',
      body: JSON.stringify({
        team_id: adjustTeamId,
        delta: adjustDelta,
        reason: adjustReason.trim(),
        expected_balance_before: beforeBalance,
        expected_balance_after: afterBalance,
        idempotency_key: uuid(),
      }),
    });
    setBusy(null);

    if (res.ok) {
      toast.success('Manual adjustment applied');
      setAdjustDelta(emptyDelta());
      setAdjustReason('');
      void load();
    } else {
      toast.error(res.message);
    }
  };

  const createRecon = async () => {
    if (!reconcileTeamId || !reconcileNotes.trim()) return;

    setBusy('reconcile');
    const res = await apiCall('/api/admin/day2/reconciliation', {
      method: 'POST',
      body: JSON.stringify({
        team_id: reconcileTeamId,
        state: reconcileState,
        discrepancies: [],
        operator_notes: reconcileNotes.trim(),
        idempotency_key: uuid(),
      }),
    });
    setBusy(null);

    if (res.ok) {
      toast.success('Reconciliation evidence recorded');
      setReconcileNotes('');
      void load();
    } else {
      toast.error(res.message);
    }
  };

  return (
    <>
      <PageTitle
        title="Day 2 Ops"
        subtitle="Round 4 results, Round 5 grading, Day 2 events, adjustments, and reconciliation evidence"
        actions={<Btn onClick={load}><RefreshCw size={12} /> Refresh</Btn>}
      />

      <Grid min={360}>
        <Panel title="Round 4 Offline Entry" subtitle="Awards are derived from the event brief before recording">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Qualified team">
              <select className="n-select" value={offlineTeamId} onChange={(event) => setOfflineTeamId(event.target.value)}>
                <option value="">Select team...</option>
                {teams.map((team) => <option key={team.team_id} value={team.team_id}>{teamLabel(team)}</option>)}
              </select>
            </Field>
            <Field label="Activity / outcome" hint={`${selectedAward.portalFragmentDelta ? 'Includes Portal Fragment x1. ' : ''}${selectedAward.requiresConfiguredAward ? 'Organizer-configured award required.' : deltaText(selectedAward.award)}`}>
              <select className="n-select" value={awardIndex} onChange={(event) => setAwardIndex(Number(event.target.value))}>
                {ROUND4_AWARDS.map((award, index) => <option key={`${award.activityKey}-${award.outcome}`} value={index}>{award.label}</option>)}
              </select>
            </Field>
            {selectedAward.requiresConfiguredAward && (
              <ResourceInputs value={configuredAward} onChange={setConfiguredAward} />
            )}
            <Field label="Volunteer">
              <input className="n-input" value={volunteer} onChange={(event) => setVolunteer(event.target.value)} />
            </Field>
            <Field label="Notes">
              <input className="n-input" value={offlineNotes} onChange={(event) => setOfflineNotes(event.target.value)} />
            </Field>
            <Btn variant="primary" disabled={busy === 'offline' || !offlineTeamId || !volunteer.trim()} onClick={submitOffline}>
              <Dices size={13} /> Record result
            </Btn>
          </div>
        </Panel>

        <Panel title="Round 5 Events" subtitle="End Merchant remains team-choice owned; no operator trigger is exposed here">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Event">
              <select className="n-select" value={eventKey} onChange={(event) => setEventKey(event.target.value as Day2EventKey)}>
                {Object.values(DAY2_EVENTS).map((event) => <option key={event.key} value={event.key}>{event.label}</option>)}
              </select>
            </Field>
            <Field label="Targets" hint="Leave empty only for Chorus Fruit Blessing to open a qualified-team window.">
              <select
                className="n-select"
                multiple
                value={eventTargets}
                onChange={(event) => setEventTargets(Array.from(event.target.selectedOptions).map((option) => option.value))}
                style={{ minHeight: 118 }}
              >
                {teams.map((team) => <option key={team.team_id} value={team.team_id}>{teamLabel(team)}</option>)}
              </select>
            </Field>
            <Field label="Reason">
              <input className="n-input" value={eventReason} onChange={(event) => setEventReason(event.target.value)} />
            </Field>
            <Btn variant="primary" disabled={busy === 'event' || !eventReason.trim()} onClick={triggerEvent}>
              <Zap size={13} /> Trigger event
            </Btn>
          </div>
        </Panel>
      </Grid>

      <Grid min={360} gap={12}>
        <Panel title="Round 5 Grading" subtitle="Provider failures stay resumable in manual review">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn variant="primary" disabled={busy === 'grade'} onClick={startRun}><ClipboardCheck size={13} /> Start / resume</Btn>
            <Btn disabled={busy === 'grade' || !run || run.state === 'completed'} onClick={continueRun}>Next batch</Btn>
          </div>
          {run && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Pill tone={statusTone(run.state)}>{run.state}</Pill>
              <span className="n-panel-sub">{run.processed_count} / {run.total_count} processed</span>
              <span className="n-panel-sub">{run.manual_review_count} manual review</span>
            </div>
          )}
          {run?.error && <p style={{ marginTop: 10, color: '#ff9db0', fontSize: 12.5 }}>{run.error}</p>}
          <div style={{ marginTop: 12 }}>
            {!review ? <Loading label="Loading review" /> : (
              <Table head={['Submission', 'Team', 'Rev', 'Submitted']}>
                {review.slice(0, 8).map((row) => (
                  <tr key={row.id}>
                    <td className="n-mono">{row.id.slice(0, 8)}</td>
                    <td className="n-mono">{row.team_id.slice(0, 8)}</td>
                    <td>{row.revision}</td>
                    <td className="n-panel-sub">{new Date(row.submitted_at).toLocaleTimeString()}</td>
                  </tr>
                ))}
                {review.length === 0 && <Empty colSpan={4}>No Round 5 submissions in manual review</Empty>}
              </Table>
            )}
          </div>
        </Panel>

        <Panel title="Manual Adjustment" subtitle="Resource-only correction with before/after confirmation">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Team">
              <select className="n-select" value={adjustTeamId} onChange={(event) => setAdjustTeamId(event.target.value)}>
                <option value="">Select team...</option>
                {teams.map((team) => <option key={team.team_id} value={team.team_id}>{teamLabel(team)}</option>)}
              </select>
            </Field>
            <ResourceInputs value={adjustDelta} onChange={setAdjustDelta} allowNegative />
            <div className="n-panel-sub">Before: {deltaText(beforeBalance)} | After: {deltaText(afterBalance)}</div>
            <Field label="Reason">
              <input className="n-input" value={adjustReason} onChange={(event) => setAdjustReason(event.target.value)} />
            </Field>
            <Btn variant="danger" disabled={busy === 'adjust' || !adjustTeamId || !adjustReason.trim()} onClick={submitAdjustment}>
              <Gavel size={13} /> Apply adjustment
            </Btn>
          </div>
        </Panel>
      </Grid>

      <Grid min={420}>
        <Panel title="Reconciliation Evidence" subtitle="Evidence only; this cannot certify or override a winner">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Candidate team">
              <select className="n-select" value={reconcileTeamId} onChange={(event) => setReconcileTeamId(event.target.value)}>
                <option value="">Select team...</option>
                {teams.map((team) => <option key={team.team_id} value={team.team_id}>{teamLabel(team)}</option>)}
              </select>
            </Field>
            <Field label="State">
              <select className="n-select" value={reconcileState} onChange={(event) => setReconcileState(event.target.value as 'completed' | 'blocked')}>
                <option value="completed">Completed</option>
                <option value="blocked">Blocked</option>
              </select>
            </Field>
            <Field label="Operator notes">
              <textarea className="n-textarea" value={reconcileNotes} onChange={(event) => setReconcileNotes(event.target.value)} />
            </Field>
            <Btn variant="primary" disabled={busy === 'reconcile' || !reconcileTeamId || !reconcileNotes.trim()} onClick={createRecon}>
              <AlertTriangle size={13} /> Record evidence
            </Btn>
          </div>
        </Panel>

        <Panel title="Recent Day 2 Records">
          {!offlineResults || !events || !reconciliations ? <Loading /> : (
            <Table head={['Type', 'Team / event', 'Result', 'When']}>
              {offlineResults.slice(0, 5).map((row) => (
                <tr key={row.id}>
                  <td>Offline</td>
                  <td>{row.teams?.team_code ?? row.team_id.slice(0, 8)}</td>
                  <td>{row.activity_key} / {deltaText(row.award)}</td>
                  <td className="n-panel-sub">{new Date(row.recorded_at).toLocaleTimeString()}</td>
                </tr>
              ))}
              {events.slice(0, 5).map((row) => (
                <tr key={row.id}>
                  <td>Event</td>
                  <td>{row.label}</td>
                  <td><Pill tone={row.is_expired ? 'idle' : statusTone(row.status)}>{row.status}</Pill></td>
                  <td className="n-panel-sub">{new Date(row.starts_at).toLocaleTimeString()}</td>
                </tr>
              ))}
              {reconciliations.slice(0, 5).map((row) => (
                <tr key={row.id}>
                  <td>Recon</td>
                  <td className="n-mono">{row.team_id.slice(0, 8)}</td>
                  <td><Pill tone={statusTone(row.state)}>{row.state}</Pill></td>
                  <td className="n-panel-sub">{new Date(row.reconciled_at).toLocaleTimeString()}</td>
                </tr>
              ))}
              {offlineResults.length + events.length + reconciliations.length === 0 && <Empty colSpan={4}>No Day 2 ops records yet</Empty>}
            </Table>
          )}
        </Panel>
      </Grid>
    </>
  );
}

function ResourceInputs({
  value,
  onChange,
  allowNegative = false,
}: {
  value: Day2ResourceDelta;
  onChange: (value: Day2ResourceDelta) => void;
  allowNegative?: boolean;
}) {
  return (
    <div>
      <span className="n-label">Resources</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 6 }}>
        {day2ResourceKeys.map((key) => (
          <label key={key}>
            <span className="n-panel-sub" style={{ display: 'block', marginBottom: 3 }}>{key}</span>
            <input
              className="n-input"
              type="number"
              min={allowNegative ? undefined : 0}
              value={value[key] ?? ''}
              placeholder="0"
              onChange={(event) => {
                const raw = event.target.value;
                const next = { ...value };
                if (raw === '') delete next[key];
                else next[key] = Number(raw);
                onChange(next);
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

