'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Swords, Play, Ban, Flag, Plus } from 'lucide-react';
import { Panel, Btn, Pill, statusTone, Table, Empty, Loading, PageTitle, apiCall, Field, Grid, StatTile } from '@/components/admin/nether-ui';

type MatchRow = {
  id: string;
  status: string;
  pack_id: string;
  started_at: string | null;
  deadline_at: string | null;
  resolved_at: string | null;
  winner_team_id: string | null;
  created_at: string;
};

type MatchDetail = MatchRow & {
  question_count: number;
  void_reason: string | null;
  teams: Array<{
    team_id: string;
    status: string;
    completion_at: string | null;
    elapsed_ms: number | null;
    outcome: string | null;
    eligibility_snapshot: Record<string, unknown>;
    teams?: { team_code: string; team_name: string } | null;
  }>;
};

type TeamOption = { id: string; team_code: string; team_name: string; year?: string; eligibility: { hasIronArmor: boolean; hasBlazeGuardian: boolean; hasPvPWin: boolean; isEligible: boolean } };

export default function AdminPvpPage() {
  const [matches, setMatches] = useState<MatchRow[] | null>(null);
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [options, setOptions] = useState<TeamOption[]>([]);
  const [busy, setBusy] = useState(false);

  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  const [packId, setPackId] = useState('round3-pvp-v1');
  const [duration, setDuration] = useState('600');

  const [voidTarget, setVoidTarget] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const load = useCallback(async () => {
    const [m, q] = await Promise.all([
      apiCall<{ matches: MatchRow[] }>('/api/admin/pvp/matches'),
      apiCall<{ teams: TeamOption[] }>('/api/admin/qualification/overview'),
    ]);
    if (m.ok) setMatches(m.data.matches ?? []);
    else toast.error(m.message);
    if (q.ok) {
      const teams = q.data.teams ?? [];
      // Fetch year labels for eligible teams
      const eligibleIds = teams
        .filter((t) => t.eligibility?.hasIronArmor && t.eligibility?.hasBlazeGuardian)
        .map((t) => t.id);
      let yearMap: Record<string, string> = {};
      if (eligibleIds.length > 0) {
        const yr = await apiCall<{ years: Record<string, string> }>(
          `/api/admin/pvp/team-years?ids=${eligibleIds.join(',')}`,
        );
        if (yr.ok) yearMap = yr.data.years;
      }
      setOptions(teams.map((t) => ({ ...t, year: yearMap[t.id] })));
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const res = await apiCall<MatchDetail>(`/api/admin/pvp/matches/${id}`);
    if (res.ok) setDetail(res.data);
    else toast.error(res.message);
  }, []);

  useEffect(() => {
    void load();
    const poll = window.setInterval(load, 30000);
    return () => window.clearInterval(poll);
  }, [load]);

  // A live match needs a tighter refresh than the list.
  useEffect(() => {
    if (!detail || detail.status !== 'live') return;
    const poll = window.setInterval(() => void loadDetail(detail.id), 5000);
    return () => window.clearInterval(poll);
  }, [detail, loadDetail]);

  const create = async () => {
    if (!teamA || !teamB) { toast.error('Select two teams'); return; }
    if (teamA === teamB) { toast.error('Select two different teams'); return; }

    setBusy(true);
    const res = await apiCall<{ match_id: string }>('/api/admin/pvp/matches', {
      method: 'POST',
      body: JSON.stringify({
        team_ids: [teamA, teamB],
        pack_id: packId.trim(),
        duration_seconds: Number(duration),
      }),
    });
    setBusy(false);

    if (res.ok) {
      toast.success('Draft match created with a sealed question pack');
      setTeamA(''); setTeamB('');
      void load();
      void loadDetail(res.data.match_id);
    } else {
      toast.error(res.message);
    }
  };

  const act = async (id: string, action: 'start' | 'resolve', label: string) => {
    setBusy(true);
    const res = await apiCall(`/api/admin/pvp/matches/${id}/${action}`, { method: 'POST' });
    setBusy(false);

    if (res.ok) { toast.success(label); void load(); void loadDetail(id); }
    else toast.error(res.message);
  };

  const doVoid = async () => {
    if (!voidTarget || !voidReason.trim()) { toast.error('A reason is required'); return; }

    setBusy(true);
    const res = await apiCall(`/api/admin/pvp/matches/${voidTarget}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason: voidReason.trim() }),
    });
    setBusy(false);

    if (res.ok) {
      toast.success('Match voided — no award issued, both teams freed for a replay');
      setVoidTarget(null); setVoidReason('');
      void load();
      if (detail) void loadDetail(detail.id);
    } else {
      toast.error(res.message);
    }
  };

  const eligible = options.filter((t) => t.eligibility?.hasIronArmor && t.eligibility?.hasBlazeGuardian);
  const resolved = (matches ?? []).filter((m) => m.status === 'resolved').length;
  const live = (matches ?? []).filter((m) => m.status === 'live').length;
  const drafts = (matches ?? []).filter((m) => m.status === 'draft').length;

  return (
    <>
      <PageTitle
        title="PvP matches"
        subtitle="A private Round 3 duel between two organizer-selected teams. There is no queue, no auto-pairing and no bracket."
        actions={<Btn onClick={load}><RefreshCw size={12} /> Refresh</Btn>}
      />

      <Grid min={180}>
        <StatTile label="Eligible teams" value={eligible.length} hint="Iron Armor + Blaze Guardian" />
        <StatTile label="Drafts" value={drafts} />
        <StatTile label="Live" value={live} />
        <StatTile label="Resolved" value={resolved} />
      </Grid>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 12, marginTop: 12 }}>
        <Panel title="Create a match" subtitle="Both teams must hold Iron Armor and have beaten the Blaze Guardian">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Team A">
              <select className="n-select" value={teamA} onChange={(e) => setTeamA(e.target.value)}>
                <option value="">Select…</option>
                {eligible.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.id === teamB}>
                    {t.team_code} — {t.team_name}{t.year ? ` · ${t.year}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Team B">
              <select className="n-select" value={teamB} onChange={(e) => setTeamB(e.target.value)}>
                <option value="">Select…</option>
                {eligible.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.id === teamA}>
                    {t.team_code} — {t.team_name}{t.year ? ` · ${t.year}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Pack id" hint="Labels the sealed snapshot for audit">
              <input className="n-input" value={packId} onChange={(e) => setPackId(e.target.value)} />
            </Field>

            <Field label="Duration (seconds)">
              <input className="n-input" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </Field>

            <Btn variant="primary" disabled={busy || !teamA || !teamB} onClick={create}>
              <Plus size={12} /> Create draft
            </Btn>

            {eligible.length < 2 && (
              <p className="n-panel-sub" style={{ color: 'var(--warn)' }}>
                Fewer than two teams are PvP-eligible so far.
              </p>
            )}
          </div>
        </Panel>

        <Panel
          title={detail ? 'Match detail' : 'Match detail'}
          subtitle={detail ? detail.id : 'Select a match below'}
          actions={
            detail && (
              <>
                <Pill tone={statusTone(detail.status)}>{detail.status}</Pill>
                {detail.status === 'draft' && (
                  <Btn small variant="primary" disabled={busy} onClick={() => act(detail.id, 'start', 'Match is live — timer started')}>
                    <Play size={11} /> Start PvP
                  </Btn>
                )}
                {detail.status === 'live' && (
                  <Btn small variant="primary" disabled={busy} onClick={() => act(detail.id, 'resolve', 'Match resolved')}>
                    <Flag size={11} /> Resolve
                  </Btn>
                )}
                {detail.status !== 'resolved' && detail.status !== 'voided' && (
                  <Btn small variant="danger" disabled={busy} onClick={() => setVoidTarget(detail.id)}>
                    <Ban size={11} /> Void
                  </Btn>
                )}
              </>
            )
          }
        >
          {!detail ? (
            <Empty>
              <Swords size={20} style={{ opacity: 0.5, marginBottom: 6 }} />
              <div>No match selected</div>
            </Empty>
          ) : (
            <>
              <div className="n-panel-sub" style={{ marginBottom: 10 }}>
                {detail.question_count} sealed questions
                {detail.deadline_at && ` · deadline ${new Date(detail.deadline_at).toLocaleTimeString()}`}
              </div>

              <Table head={['Team', 'State', 'Completed', 'Elapsed', 'Outcome']}>
                {detail.teams.map((t) => (
                  <tr key={t.team_id}>
                    <td>
                      <div className="n-mono">{t.teams?.team_code ?? t.team_id.slice(0, 8)}</div>
                      <div className="n-panel-sub">{t.teams?.team_name ?? ''}</div>
                    </td>
                    <td><Pill tone={statusTone(t.status)}>{t.status}</Pill></td>
                    <td className="n-panel-sub">{t.completion_at ? new Date(t.completion_at).toLocaleTimeString() : '—'}</td>
                    <td className="n-mono">{t.elapsed_ms != null ? `${(t.elapsed_ms / 1000).toFixed(1)}s` : '—'}</td>
                    <td>{t.outcome ? <Pill tone={t.outcome === 'won' ? 'ok' : 'danger'}>{t.outcome}</Pill> : '—'}</td>
                  </tr>
                ))}
              </Table>

              {detail.void_reason && (
                <p style={{ marginTop: 10, fontSize: 12.5, color: '#ff9db0' }}>Voided: {detail.void_reason}</p>
              )}
              {detail.status === 'live' && (
                <p className="n-panel-sub" style={{ marginTop: 10 }}>
                  Resolving validates both teams&apos; answers against the sealed pack and picks the winner by server-recorded
                  elapsed time. The result is never taken from a browser.
                </p>
              )}
            </>
          )}
        </Panel>
      </div>

      <div style={{ marginTop: 12 }}>
        <Panel title={`All matches (${matches?.length ?? 0})`}>
          {!matches ? (
            <Loading label="Loading matches" />
          ) : (
            <Table head={['Match', 'Pack', 'Status', 'Started', 'Resolved', '']}>
              {matches.map((m) => (
                <tr key={m.id}>
                  <td className="n-mono">{m.id.slice(0, 8)}…</td>
                  <td>{m.pack_id}</td>
                  <td><Pill tone={statusTone(m.status)}>{m.status}</Pill></td>
                  <td className="n-panel-sub">{m.started_at ? new Date(m.started_at).toLocaleTimeString() : '—'}</td>
                  <td className="n-panel-sub">{m.resolved_at ? new Date(m.resolved_at).toLocaleTimeString() : '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Btn small onClick={() => loadDetail(m.id)}>Open</Btn>
                  </td>
                </tr>
              ))}
              {matches.length === 0 && <Empty colSpan={6}>No matches created yet</Empty>}
            </Table>
          )}
        </Panel>
      </div>

      {voidTarget && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 100, background: 'rgb(0 0 0 / 72%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={() => setVoidTarget(null)}
        >
          <div className="n-panel" style={{ maxWidth: 420, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="n-panel-head"><div className="n-panel-title">Void match</div></div>
            <div className="n-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p className="n-panel-sub">
                Voiding issues no award and frees both teams for a replay. A resolved match can never be voided.
              </p>
              <Field label="Reason (required)">
                <textarea className="n-textarea" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
              </Field>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Btn variant="ghost" onClick={() => setVoidTarget(null)}>Cancel</Btn>
                <Btn variant="danger" disabled={busy || !voidReason.trim()} onClick={doVoid}>Void match</Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
