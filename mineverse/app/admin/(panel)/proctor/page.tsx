'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle, Check, Eye, EyeOff, Monitor, RefreshCw, ShieldAlert, WifiOff,
} from 'lucide-react';
import {
  Panel, Btn, Table, Empty, Loading, PageTitle, Grid, StatTile, Pill, apiCall,
} from '@/components/admin/nether-ui';
import { STALE_AFTER_MS, proctorRules } from '@/lib/proctor/config';

interface FeedEvent {
  kind: string;
  severity: string;
  detail: Record<string, unknown>;
  occurred_at: string;
}

interface FeedRow {
  id: string;
  team_id: string;
  team_code: string | null;
  team_name: string | null;
  round_id: number;
  device_id: string;
  status: 'active' | 'flagged' | 'ended';
  warning_count: number;
  key_violation_count: number;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
  user_agent: string | null;
  capabilities: Record<string, boolean>;
  recent: FeedEvent[];
}

const ROUNDS = [1, 2, 3, 4, 5];

/** "42s ago" is what an organizer actually needs; a timestamp is not. */
function ago(iso: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

const EVENT_LABEL: Record<string, string> = {
  session_start: 'started',
  tab_hidden: 'left tab',
  tab_visible: 'returned',
  window_blur: 'lost focus',
  fullscreen_exit: 'left fullscreen',
  fullscreen_restored: 'back to fullscreen',
  copy: 'copy',
  paste: 'paste',
  context_menu: 'right-click',
  blocked_key: 'blocked key',
  reload_attempt: 'reload',
  session_end: 'finished',
};

function describe(event: FeedEvent) {
  const label = EVENT_LABEL[event.kind] ?? event.kind;
  if (event.kind === 'blocked_key' && event.detail?.key) return `${label} (${event.detail.key})`;
  if (event.kind === 'fullscreen_restored' && typeof event.detail?.away_ms === 'number') {
    return `${label} after ${Math.round(event.detail.away_ms / 1000)}s`;
  }
  return label;
}

/**
 * A browser that cannot enforce fullscreen produces a clean record for reasons
 * that have nothing to do with the team. Saying so prevents the worst possible
 * misread of this table.
 */
function unwatched(capabilities: Record<string, boolean>) {
  return capabilities.fullscreen === false;
}

export default function ProctorPage() {
  const [rows, setRows] = useState<FeedRow[] | null>(null);
  const [round, setRound] = useState<number | 'all'>('all');
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const query = round === 'all' ? '' : `?round_id=${round}`;
    const res = await apiCall<{ sessions: FeedRow[] }>(`/api/admin/proctor/feed${query}`);
    if (res.ok) setRows(res.data.sessions ?? []);
    else toast.error(res.message);
  }, [round]);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(poll);
  }, [load]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(tick);
  }, []);

  const visible = useMemo(() => {
    if (!rows) return [];
    return onlyFlagged ? rows.filter((row) => row.status === 'flagged') : rows;
  }, [rows, onlyFlagged]);

  // Flagged first, then whoever is currently out of contact, then most recent.
  const sorted = useMemo(() => {
    const rank = (row: FeedRow) => {
      if (row.status === 'flagged') return 0;
      if (row.ended_at) return 3;
      if (now - new Date(row.last_seen_at).getTime() > STALE_AFTER_MS) return 1;
      return 2;
    };
    return [...visible].sort(
      (a, b) => rank(a) - rank(b) || new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime(),
    );
  }, [visible, now]);

  const stats = useMemo(() => {
    const all = rows ?? [];
    return {
      live: all.filter((r) => !r.ended_at && now - new Date(r.last_seen_at).getTime() <= STALE_AFTER_MS).length,
      flagged: all.filter((r) => r.status === 'flagged').length,
      dark: all.filter((r) => !r.ended_at && now - new Date(r.last_seen_at).getTime() > STALE_AFTER_MS).length,
      teams: new Set(all.map((r) => r.team_id)).size,
    };
  }, [rows, now]);

  const clearFlag = async (sessionId: string) => {
    setBusy(true);
    const res = await apiCall('/api/admin/proctor/feed', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    });
    setBusy(false);
    if (res.ok) {
      toast.success('Flag cleared.');
      void load();
    } else {
      toast.error(res.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PageTitle
        title="Proctor"
        subtitle="One row per device. Nothing here submits or locks anything on its own — a flag is a prompt to go and look."
        actions={<Btn onClick={() => void load()}><RefreshCw size={12} /> Refresh</Btn>}
      />

      <Grid min={180}>
        <StatTile label="Devices live" value={stats.live} icon={<Monitor size={14} />} />
        <StatTile label="Flagged" value={stats.flagged} hint="Over a budget" icon={<ShieldAlert size={14} />} />
        <StatTile label="Out of contact" value={stats.dark} hint="No heartbeat > 75s" icon={<WifiOff size={14} />} />
        <StatTile label="Teams seen" value={stats.teams} icon={<Eye size={14} />} />
      </Grid>

      <Panel
        title="Live sessions"
        subtitle={`Budgets come from each round's rules. Round ${round === 'all' ? '1' : round}: ${
          proctorRules(round === 'all' ? 1 : round).warningBudget
        } tab/fullscreen, ${proctorRules(round === 'all' ? 1 : round).keyViolationBudget} blocked actions.`}
        actions={
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Btn small variant={round === 'all' ? 'primary' : 'secondary'} onClick={() => setRound('all')}>
              All
            </Btn>
            {ROUNDS.map((id) => (
              <Btn
                key={id}
                small
                variant={round === id ? 'primary' : 'secondary'}
                onClick={() => setRound(id)}
              >
                R{id}
              </Btn>
            ))}
            <Btn small variant={onlyFlagged ? 'primary' : 'secondary'} onClick={() => setOnlyFlagged((v) => !v)}>
              {onlyFlagged ? <Eye size={11} /> : <EyeOff size={11} />} Flagged only
            </Btn>
          </div>
        }
      >
        {rows === null ? (
          <Loading label="Loading sessions" />
        ) : (
          <Table head={['Team', 'Round', 'Warnings', 'Blocked', 'Last seen', 'Recent activity', '']}>
            {sorted.length === 0 ? (
              <Empty colSpan={7}>
                {onlyFlagged ? 'Nothing flagged.' : 'No proctor sessions yet. They appear as teams enter a round.'}
              </Empty>
            ) : (
              sorted.map((row) => {
                const rules = proctorRules(row.round_id);
                const dark = !row.ended_at && now - new Date(row.last_seen_at).getTime() > STALE_AFTER_MS;
                const blind = unwatched(row.capabilities);

                return (
                  <tr key={row.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{row.team_code ?? '—'}</div>
                      <div className="n-panel-sub">{row.team_name ?? ''}</div>
                      <div className="n-panel-sub" style={{ fontFamily: 'monospace', fontSize: 10 }}>
                        {row.device_id.slice(0, 8)}
                      </div>
                    </td>
                    <td>R{row.round_id}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      <Pill tone={row.warning_count >= rules.warningBudget ? 'danger' : row.warning_count > 0 ? 'warn' : 'idle'}>
                        {row.warning_count}/{rules.warningBudget}
                      </Pill>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      <Pill
                        tone={
                          row.key_violation_count >= rules.keyViolationBudget
                            ? 'danger'
                            : row.key_violation_count > 0
                              ? 'warn'
                              : 'idle'
                        }
                      >
                        {row.key_violation_count}/{rules.keyViolationBudget}
                      </Pill>
                    </td>
                    <td>
                      {row.ended_at ? (
                        <Pill tone="ok">finished</Pill>
                      ) : dark ? (
                        <Pill tone="danger">dark · {ago(row.last_seen_at, now)}</Pill>
                      ) : (
                        <span className="n-panel-sub">{ago(row.last_seen_at, now)}</span>
                      )}
                      {blind && (
                        <div className="n-panel-sub" style={{ marginTop: 4, display: 'flex', gap: 4, alignItems: 'center' }}>
                          <AlertTriangle size={10} /> no fullscreen support
                        </div>
                      )}
                    </td>
                    <td>
                      {row.recent.length === 0 ? (
                        <span className="n-panel-sub">—</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {row.recent.slice(0, 3).map((event, index) => (
                            <div
                              key={index}
                              className="n-panel-sub"
                              style={{ fontSize: 11, color: event.severity === 'info' ? undefined : 'var(--accent-danger-text, inherit)' }}
                            >
                              {describe(event)} · {ago(event.occurred_at, now)}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      {row.status === 'flagged' && (
                        <Btn small variant="secondary" disabled={busy} onClick={() => void clearFlag(row.id)}>
                          <Check size={11} /> Clear flag
                        </Btn>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </Table>
        )}
      </Panel>

      <Panel title="What this cannot see">
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5, paddingLeft: 16 }}>
          <li>A phone, a second laptop, or someone on a call. Physical invigilation still does the real work.</li>
          <li>
            Whether devtools were opened — only that the shortcut was pressed. Every published detection
            technique has real false positives, so none is used here.
          </li>
          <li>
            A team is free to use several devices at once. Each is a separate row; judge the team, not the row.
          </li>
        </ul>
      </Panel>
    </div>
  );
}
