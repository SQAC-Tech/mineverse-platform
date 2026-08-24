'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Coins, Search, Users } from 'lucide-react';
import { Panel, Btn, Field, Grid, Table, Empty, Pill, apiCall, uuid } from '@/components/admin/nether-ui';

/**
 * One grant, many teams — for the offline rounds.
 *
 * Those rounds are played in the hall rather than on the platform, so an
 * organiser watches a physical game and then credits what every team earned.
 * Doing that on the single-team screen is ninety-odd repetitions of pick, type,
 * type, submit: slow enough that it gets done wrong, and impossible to audit
 * afterwards, because a team with no ledger row might have been missed or might
 * genuinely have earned nothing.
 *
 * The same audited RPC and the same reason string as a single grant. What is
 * different is that the result is reported per team, so a grant that fails for
 * one does not quietly take the rest of the hall with it.
 */

const RESOURCES = ['wood', 'stone', 'iron', 'gold', 'diamond', 'emerald', 'obsidian'] as const;
type ResourceKey = (typeof RESOURCES)[number];
type Delta = Partial<Record<ResourceKey, number>>;

export interface BulkTeam {
  id: string;
  team_code: string;
  team_name: string;
}

interface Outcome {
  team_id: string;
  ok: boolean;
  code?: string;
  message?: string;
}

interface BulkResult {
  requested: number;
  granted: number;
  failed: number;
  outcomes: Outcome[];
}

export function BulkResourceGrant({ teams }: { teams: BulkTeam[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [delta, setDelta] = useState<Delta>({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return teams;
    return teams.filter(
      (team) => team.team_code.toLowerCase().includes(term) || (team.team_name ?? '').toLowerCase().includes(term),
    );
  }, [teams, query]);

  const entries = Object.entries(delta).filter(([, value]) => Number(value) !== 0);
  const nameById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** Acts on the filtered list, so a search plus "select all" is a bulk filter. */
  const selectVisible = () => setSelected((current) => new Set([...current, ...visible.map((team) => team.id)]));

  const apply = async () => {
    if (selected.size === 0) { toast.error('Select at least one team'); return; }
    if (entries.length === 0) { toast.error('Enter at least one non-zero change'); return; }
    if (!reason.trim()) { toast.error('A reason is required — every grant is audited'); return; }

    setBusy(true);
    setResult(null);
    const res = await apiCall<BulkResult>('/api/admin/resources/bulk', {
      method: 'POST',
      body: JSON.stringify({
        team_ids: [...selected],
        delta: Object.fromEntries(entries.map(([key, value]) => [key, Number(value)])),
        reason: reason.trim(),
        // A fresh key per submission: the same key would make a second,
        // deliberate grant of the same amount silently do nothing.
        idempotency_key: uuid(),
      }),
    });
    setBusy(false);

    if (!res.ok) { toast.error(res.message); return; }

    const data = res.data as BulkResult;
    setResult(data);
    if (data.failed === 0) {
      toast.success(`Granted to ${data.granted} team${data.granted === 1 ? '' : 's'}`);
      setDelta({});
      setReason('');
      setSelected(new Set());
    } else {
      toast.error(`${data.granted} granted, ${data.failed} failed — see below`);
    }
  };

  const failures = (result?.outcomes ?? []).filter((row) => !row.ok);

  return (
    <>
      <Panel
        title="Teams"
        subtitle={`${selected.size} selected of ${teams.length}`}
        actions={
          <>
            <Btn small onClick={selectVisible}><Users size={12} /> Select {query ? 'filtered' : 'all'}</Btn>
            <Btn small onClick={() => setSelected(new Set())}>Clear</Btn>
          </>
        }
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Search size={13} aria-hidden="true" />
          <input
            className="n-input"
            placeholder="Filter by team code or name"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{ flex: 1 }}
          />
        </label>

        <div style={{ maxHeight: 260, overflowY: 'auto', display: 'grid', gap: 4 }}>
          {visible.length === 0 ? (
            <Empty>No teams match that filter.</Empty>
          ) : visible.map((team) => (
            <label
              key={team.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                background: selected.has(team.id) ? 'rgb(from var(--accent-primary) r g b / 12%)' : 'var(--bg-void)',
                border: '1px solid rgb(from var(--accent-muted) r g b / 22%)', cursor: 'pointer',
              }}
            >
              <input type="checkbox" checked={selected.has(team.id)} onChange={() => toggle(team.id)} />
              <span className="n-mono">{team.team_code}</span>
              <span className="n-panel-sub">{team.team_name}</span>
            </label>
          ))}
        </div>
      </Panel>

      <div style={{ marginTop: 12 }}>
        <Panel title="Grant" subtitle="Applied to every selected team, written to the same audited ledger">
          <Grid min={112} gap={8}>
            {RESOURCES.map((resource) => (
              <Field key={resource} label={resource}>
                <input
                  className="n-input"
                  type="number"
                  value={delta[resource] ?? ''}
                  placeholder="0"
                  onChange={(event) =>
                    setDelta((current) => ({ ...current, [resource]: event.target.value === '' ? undefined : Number(event.target.value) }))
                  }
                />
              </Field>
            ))}
          </Grid>

          <div style={{ marginTop: 12 }}>
            <Field label="Reason" hint="Shown in the ledger and on the team's notification. Say which offline round this was.">
              <input
                className="n-input"
                value={reason}
                placeholder="e.g. Offline round 1 — Tower Build, 2nd place"
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
          </div>

          <div style={{ marginTop: 12 }}>
            <Btn variant="primary" disabled={busy} onClick={apply}>
              <Coins size={12} /> {busy ? 'Granting…' : `Grant to ${selected.size} team${selected.size === 1 ? '' : 's'}`}
            </Btn>
          </div>
        </Panel>
      </div>

      {result && (
        <div style={{ marginTop: 12 }}>
          <Panel title="Result" subtitle={`${result.granted} granted, ${result.failed} failed of ${result.requested}`}>
            {failures.length === 0 ? (
              <Empty>Every selected team was credited.</Empty>
            ) : (
              <Table head={['Team', 'Problem']}>
                {failures.map((row) => (
                  <tr key={row.team_id}>
                    <td className="n-mono">{nameById.get(row.team_id)?.team_code ?? row.team_id}</td>
                    <td>
                      <Pill tone="danger">{row.code ?? 'FAILED'}</Pill>
                      <span className="n-panel-sub" style={{ marginLeft: 8 }}>{row.message}</span>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
