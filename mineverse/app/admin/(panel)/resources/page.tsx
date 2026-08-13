'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Coins, Save } from 'lucide-react';
import { Panel, Btn, Table, Empty, Loading, PageTitle, apiCall, Field, Grid, uuid } from '@/components/admin/nether-ui';

const RESOURCES = ['wood', 'stone', 'iron', 'gold', 'diamond', 'emerald', 'obsidian'] as const;
type ResourceKey = (typeof RESOURCES)[number];
type Delta = Partial<Record<ResourceKey, number>>;

type TeamRow = { id: string; team_code: string; team_name: string; is_payment_verified: boolean };
type LedgerRow = {
  id: string;
  delta: Delta;
  balance_after: Record<string, number>;
  source_type: string;
  reason: string | null;
  actor_type: string;
  created_at: string;
};
type ResourceView = {
  team_id: string;
  balance: Record<ResourceKey, number>;
  version: number;
  active_modifiers: Array<{ event_key: string; label: string; modifier: Record<string, number>; expires_at: string | null }>;
  ledger: LedgerRow[];
};

export default function AdminResourcesPage() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [teamId, setTeamId] = useState('');
  const [view, setView] = useState<ResourceView | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [delta, setDelta] = useState<Delta>({});
  const [reason, setReason] = useState('');
  const [portalFragment, setPortalFragment] = useState(false);
  const [netherCore, setNetherCore] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await apiCall<TeamRow[]>('/api/admin/teams');
      if (res.ok) setTeams((res.data ?? []).filter((t) => t.is_payment_verified));
    })();
  }, []);

  const loadTeam = useCallback(async (id: string) => {
    if (!id) { setView(null); return; }
    setLoading(true);
    const res = await apiCall<ResourceView>(`/api/admin/resources/${id}`);
    setLoading(false);
    if (res.ok) setView(res.data);
    else toast.error(res.message);
  }, []);

  useEffect(() => { void loadTeam(teamId); }, [teamId, loadTeam]);

  const entries = Object.entries(delta).filter(([, v]) => Number(v) !== 0);

  const apply = async () => {
    if (!teamId) { toast.error('Select a team'); return; }
    if (entries.length === 0) { toast.error('Enter at least one non-zero change'); return; }
    if (!reason.trim()) { toast.error('A reason is required — every grant is audited'); return; }

    setBusy(true);
    const res = await apiCall('/api/admin/resources/adjustments', {
      method: 'POST',
      body: JSON.stringify({
        team_id: teamId,
        delta: Object.fromEntries(entries.map(([k, v]) => [k, Number(v)])),
        reason: reason.trim(),
        grant_portal_fragment: portalFragment,
        grant_nether_core: netherCore,
        idempotency_key: uuid(),
      }),
    });
    setBusy(false);

    if (res.ok) {
      toast.success('Granted and written to the ledger');
      setDelta({});
      setReason('');
      setPortalFragment(false);
      setNetherCore(false);
      void loadTeam(teamId);
    } else {
      toast.error(res.message);
    }
  };

  return (
    <>
      <PageTitle
        title="Grant resources"
        subtitle="The one place resources are handed out by hand — offline game wins, corrections, anything organizers decide off the platform. It moves resources only; it cannot change qualification."
        actions={teamId ? <Btn onClick={() => loadTeam(teamId)}><RefreshCw size={12} /> Refresh</Btn> : undefined}
      />

      <Panel title="Team">
        <div style={{ maxWidth: 360 }}>
          <Field label="Select a team">
            <select className="n-select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">Select…</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.team_code} — {t.team_name}</option>
              ))}
            </select>
          </Field>
        </div>
      </Panel>

      {loading && <div style={{ marginTop: 12 }}><Panel><Loading label="Loading balance" /></Panel></div>}

      {view && !loading && (
        <>
          <div style={{ marginTop: 12 }}>
            <Panel title="Balance" subtitle={`Ledger version ${view.version}`}>
              <Grid min={112} gap={8}>
                {RESOURCES.map((key) => (
                  <div key={key} style={{ padding: 12, background: 'var(--bg-void)', border: '1px solid rgb(from var(--accent-muted) r g b / 22%)', textAlign: 'center' }}>
                    <div className="n-stat-label">{key}</div>
                    <div className="n-stat-value" style={{ fontSize: 22, marginTop: 4 }}>{view.balance?.[key] ?? 0}</div>
                  </div>
                ))}
              </Grid>

              {view.active_modifiers?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="n-label" style={{ marginBottom: 6 }}>Active modifiers</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {view.active_modifiers.map((m) => (
                      <span key={m.event_key} className="n-pill n-pill-live">
                        {m.label} ×{Object.values(m.modifier)[0]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginTop: 12 }}>
            <Panel title="Grant" subtitle="Use negative numbers to take resources back">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <span className="n-label">Change</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))', gap: 6 }}>
                    {RESOURCES.map((key) => (
                      <label key={key}>
                        <span className="n-panel-sub" style={{ display: 'block', marginBottom: 3 }}>{key}</span>
                        <input
                          type="number"
                          className="n-input"
                          placeholder="0"
                          value={delta[key] ?? ''}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setDelta((prev) => {
                              const next = { ...prev };
                              if (raw === '') delete next[key];
                              else next[key] = Number(raw);
                              return next;
                            });
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="n-label">Portal artifacts</span>
                  <div className="n-panel-sub" style={{ marginBottom: 6 }}>
                    Neither is a resource — the portal repair checks for them separately. Granting one twice is inert.
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, marginBottom: 4 }}>
                    <input type="checkbox" checked={portalFragment} onChange={(e) => setPortalFragment(e.target.checked)} />
                    Portal Fragment ×1
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}>
                    <input type="checkbox" checked={netherCore} onChange={(e) => setNetherCore(e.target.checked)} />
                    Nether Core ×1 <span className="n-panel-sub">(tops up to one; never takes one away)</span>
                  </label>
                </div>

                <Field label="Reason (required)" hint="Stored with the admin, before/after balances and the ledger id">
                  <textarea className="n-textarea" value={reason} onChange={(e) => setReason(e.target.value)} />
                </Field>

                {entries.length > 0 && (
                  <div style={{ padding: 9, background: 'var(--bg-void)', border: '1px solid rgb(from var(--accent-primary) r g b / 35%)', fontSize: 12.5 }}>
                    Applying:{' '}
                    <span className="n-mono">
                      {entries.map(([k, v]) => `${Number(v) > 0 ? '+' : ''}${v} ${k}`).join(', ')}
                    </span>
                  </div>
                )}

                <Btn variant="primary" disabled={busy || entries.length === 0 || !reason.trim()} onClick={apply}>
                  <Save size={12} /> {busy ? 'Granting…' : 'Grant to team'}
                </Btn>
              </div>
            </Panel>

            <Panel title="Ledger" subtitle="Append-only history, most recent first">
              <Table head={['Source', 'Change', 'Reason', 'When']}>
                {(view.ledger ?? []).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div>{row.source_type}</div>
                      <div className="n-panel-sub">{row.actor_type}</div>
                    </td>
                    <td className="n-mono">
                      {Object.entries(row.delta ?? {}).map(([k, v]) => `${Number(v) > 0 ? '+' : ''}${v} ${k}`).join(', ')}
                    </td>
                    <td className="n-panel-sub" style={{ maxWidth: 200 }}>{row.reason || '—'}</td>
                    <td className="n-panel-sub">{new Date(row.created_at).toLocaleTimeString()}</td>
                  </tr>
                ))}
                {(view.ledger ?? []).length === 0 && (
                  <Empty colSpan={4}>
                    <Coins size={20} style={{ opacity: 0.5, marginBottom: 6 }} />
                    <div>No ledger entries yet</div>
                  </Empty>
                )}
              </Table>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
