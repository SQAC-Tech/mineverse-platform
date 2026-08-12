'use client';

import { useState } from 'react';
import { Check, X, Download, Snowflake, RefreshCw } from 'lucide-react';
import { Panel, Btn, Pill, Table, Empty, PageTitle, Field, Grid, StatTile } from '@/components/admin/nether-ui';

interface TeamEligibility {
  hasIronArmor: boolean;
  hasBlazeGuardian: boolean;
  hasPvPWin: boolean;
  isEligible: boolean;
}

interface TeamGameState {
  nether_core_count: number;
  qualified_for_day2: boolean;
  qualification_frozen_at: string | null;
  elimination_reason: string | null;
}

interface TeamData {
  id: string;
  team_code: string;
  team_name: string;
  status: string;
  eligibility: TeamEligibility;
  state: TeamGameState | null;
}

interface OverviewData { teams: TeamData[] }

interface ConfirmResult {
  freeze_id: string;
  qualified_count: number;
  total_eligible: number;
  total_participants: number;
  cutoff_percent: number;
  is_override: boolean;
  confirmed_by: string;
  frozen_at: string;
}

function Tick({ on }: { on: boolean }) {
  return on
    ? <Check size={14} style={{ color: 'var(--ok)' }} aria-label="yes" />
    : <X size={14} style={{ color: 'rgb(217 179 255 / 40%)' }} aria-label="no" />;
}

export default function AdminQualificationClient({ initialData }: { initialData: OverviewData }) {
  const [teams, setTeams] = useState<TeamData[]>(initialData.teams);
  const [cutoff, setCutoff] = useState(50);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch('/api/admin/qualification/overview', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setTeams(json.data.teams || []);
    } catch {
      setError('Failed to refresh data.');
    }
  };

  const handleConfirm = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/qualification/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cutoff_percent: cutoff, reason: reason.trim() || undefined }),
      });
      const json = await res.json();

      if (json.success) {
        const data = json.data as ConfirmResult;
        setMessage(
          `Frozen: ${data.qualified_count} qualified of ${data.total_eligible} eligible across ${data.total_participants} participants (${data.cutoff_percent}%${data.is_override ? ', override' : ''}).`,
        );
        setReason('');
        await refresh();
      } else {
        setError(json.error?.message || `Failed (${json.error?.code}).`);
      }
    } catch {
      setError('An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/qualification/export', { cache: 'no-store' });
      const json = await res.json();

      if (!json.success) {
        setError(json.error?.message || 'Export failed.');
        return;
      }

      const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qualified-teams-${json.data.exported_at}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('An error occurred during export.');
    }
  };

  const frozenCount = teams.filter((t) => t.state?.qualification_frozen_at).length;
  const eligibleCount = teams.filter((t) => t.eligibility?.isEligible).length;
  const qualifiedCount = teams.filter((t) => t.state?.qualified_for_day2).length;

  return (
    <>
      <PageTitle
        title="Qualification"
        subtitle="A team qualifies only with Iron Armor, a Blaze Guardian win, and a winning PvP result. Freezing is immutable."
        actions={<Btn onClick={refresh}><RefreshCw size={12} /> Refresh</Btn>}
      />

      {error && (
        <div style={{ marginBottom: 12, padding: 10, background: 'rgb(85 12 27 / 55%)', border: '1px solid #a3324a', color: '#ff9db0', fontSize: 12.5 }}>
          {error}
        </div>
      )}
      {message && (
        <div style={{ marginBottom: 12, padding: 10, background: 'rgb(from var(--accent-primary) r g b / 12%)', border: '1px solid rgb(from var(--accent-primary) r g b / 45%)', fontSize: 12.5 }}>
          {message}
        </div>
      )}

      <Grid min={180}>
        <StatTile label="Teams" value={teams.length} />
        <StatTile label="Fully eligible" value={eligibleCount} hint="Armor + Guardian + PvP win" />
        <StatTile label="Frozen" value={frozenCount} hint={frozenCount ? 'Decision recorded' : 'Not frozen yet'} />
        <StatTile label="Qualified" value={qualifiedCount} hint="Advancing to Day 2" />
      </Grid>

      <div style={{ marginTop: 12 }}>
        <Panel title="Freeze the Day 2 list" subtitle="Writes an immutable decision to every participant's handoff row">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ width: 130 }}>
              <Field label="Cutoff %">
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="n-input"
                  value={cutoff}
                  onChange={(e) => setCutoff(parseInt(e.target.value, 10) || 50)}
                />
              </Field>
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <Field label="Override reason" hint="Required only if eligible teams exceed the cutoff">
                <input
                  className="n-input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Tie-break by earliest verified win"
                />
              </Field>
            </div>
            <Btn variant="primary" disabled={loading} onClick={handleConfirm}>
              <Snowflake size={12} /> {loading ? 'Freezing…' : 'Confirm & freeze'}
            </Btn>
            <Btn disabled={loading} onClick={handleExport}>
              <Download size={12} /> Export
            </Btn>
          </div>
          <p className="n-panel-sub" style={{ marginTop: 10 }}>
            {frozenCount} of {teams.length} teams frozen.
          </p>
        </Panel>
      </div>

      <div style={{ marginTop: 12 }}>
        <Panel title={`Eligibility (${teams.length})`}>
          <Table head={['Team', 'Iron Armor', 'Blaze Guardian', 'PvP win', 'Nether cores', 'Decision']}>
            {teams.map((team) => (
              <tr key={team.id}>
                <td>
                  <div>{team.team_name}</div>
                  <div className="n-panel-sub n-mono">{team.team_code}</div>
                </td>
                <td style={{ textAlign: 'center' }}><Tick on={team.eligibility.hasIronArmor} /></td>
                <td style={{ textAlign: 'center' }}><Tick on={team.eligibility.hasBlazeGuardian} /></td>
                <td style={{ textAlign: 'center' }}><Tick on={team.eligibility.hasPvPWin} /></td>
                <td className="n-mono" style={{ textAlign: 'center' }}>{team.state?.nether_core_count ?? 0}</td>
                <td>
                  {team.state?.qualification_frozen_at ? (
                    <Pill tone={team.state.qualified_for_day2 ? 'ok' : 'danger'}>
                      {team.state.qualified_for_day2 ? 'qualified' : 'eliminated'}
                    </Pill>
                  ) : (
                    <Pill tone="idle">pending</Pill>
                  )}
                </td>
              </tr>
            ))}
            {teams.length === 0 && <Empty colSpan={6}>No teams yet</Empty>}
          </Table>
        </Panel>
      </div>
    </>
  );
}
