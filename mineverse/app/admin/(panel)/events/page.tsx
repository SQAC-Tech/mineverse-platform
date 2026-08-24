'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Zap, RefreshCw, CloudRain, Coins, Sprout } from 'lucide-react';
import { Panel, Btn, Pill, statusTone, Table, Empty, Loading, PageTitle, apiCall, Field } from '@/components/admin/nether-ui';
import { startPoll } from '@/lib/client/poll';

type CatalogItem = {
  key: string;
  label: string;
  round_id: number;
  kind: 'modifier';
  duration_seconds: number;
};

type EventRow = {
  id: string;
  event_key: string;
  label: string;
  round_id: number;
  scope: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  triggered_by: string;
  is_expired: boolean;
};

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  heavy_rain: CloudRain,
  fertile_marsh: Sprout,
  gold_rush: Coins,
};

// Every event is a reward multiplier; nothing here can cost a team anything.
const KIND_COPY: Record<CatalogItem['kind'], string> = {
  modifier: 'Doubles a reward for its window',
};

export default function AdminEventsPage() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<CatalogItem | null>(null);

  const load = useCallback(async () => {
    const res = await apiCall<{ events: EventRow[]; catalog: CatalogItem[] }>('/api/admin/events');
    if (res.ok) {
      setEvents(res.data.events ?? []);
      setCatalog(res.data.catalog ?? []);
    } else {
      toast.error(res.message);
    }
  }, []);

  useEffect(() => {
    void load();
    return startPoll(() => void load(), 30_000);
  }, [load]);

  const trigger = async (item: CatalogItem) => {
    setBusy(item.key);
    const res = await apiCall<{ announcement: string; affected_teams: number }>(
      '/api/admin/events/trigger',
      { method: 'POST', body: JSON.stringify({ event_key: item.key, round_id: item.round_id, scope: 'all' }) },
    );
    setBusy(null);
    setConfirming(null);

    if (res.ok) {
      toast.success(`${item.label} triggered for ${res.data.affected_teams} teams`, {
        description: res.data.announcement,
      });
      void load();
    } else {
      toast.error(res.message);
    }
  };

  const triggerWithRound = async (item: CatalogItem, selectedRoundId: number) => {
    setBusy(item.key);
    const res = await apiCall<{ announcement: string; affected_teams: number }>(
      '/api/admin/events/trigger',
      { method: 'POST', body: JSON.stringify({ event_key: item.key, round_id: selectedRoundId, scope: 'all' }) },
    );
    setBusy(null);
    setConfirming(null);

    if (res.ok) {
      toast.success(`${item.label} triggered for ${res.data.affected_teams} teams in Round ${selectedRoundId}`, {
        description: res.data.announcement,
      });
      void load();
    } else {
      toast.error(res.message);
    }
  };

  const expire = async (id: string) => {
    setBusy(id);
    const res = await apiCall('/api/admin/events/expire', { method: 'POST', body: JSON.stringify({ event_id: id }) });
    setBusy(null);

    if (res.ok) { toast.success('Event expired'); void load(); }
    else toast.error(res.message);
  };

  const active = (events ?? []).filter((e) => e.status === 'active' && !e.is_expired);

  return (
    <>
      <PageTitle
        title="World events"
        subtitle="Reward windows only — every event doubles a resource for five minutes and none of them can take anything away"
        actions={<Btn onClick={load}><RefreshCw size={12} /> Refresh</Btn>}
      />

      <Panel title="Trigger an event" subtitle="Each event belongs to one round and can only fire while that round is active">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
          {catalog.map((item) => {
            const Icon = ICONS[item.key] ?? Zap;
            const alreadyActive = active.some((e) => e.event_key === item.key);

            return (
              <div
                key={item.key}
                style={{
                  padding: 12,
                  background: 'var(--bg-void)',
                  border: `1px solid ${alreadyActive ? 'rgb(from var(--accent-primary) r g b / 55%)' : 'rgb(from var(--accent-muted) r g b / 25%)'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Icon size={15} />
                  <span style={{ fontSize: 13.5 }}>{item.label}</span>
                </div>
                <div className="n-panel-sub" style={{ marginBottom: 4 }}>
                  Round {item.round_id}
                  {item.duration_seconds ? ` · ${item.duration_seconds / 60} min` : ' · instant'}
                </div>
                <div className="n-panel-sub" style={{ marginBottom: 10, minHeight: 26 }}>{KIND_COPY[item.kind]}</div>
                <Btn
                  variant={alreadyActive ? 'ghost' : 'primary'}
                  small
                  style={{ width: '100%' }}
                  disabled={busy === item.key || alreadyActive}
                  onClick={() => setConfirming(item)}
                >
                  {alreadyActive ? 'Already active' : busy === item.key ? 'Triggering…' : 'Trigger'}
                </Btn>
              </div>
            );
          })}
          {catalog.length === 0 && <Empty>Catalog unavailable</Empty>}
        </div>
      </Panel>

      <div style={{ marginTop: 12 }}>
        <Panel title={`History (${events?.length ?? 0})`}>
          {!events ? (
            <Loading label="Loading events" />
          ) : (
            <Table head={['Event', 'Round', 'Scope', 'Started', 'Ends', 'Status', '']}>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>{e.label}</td>
                  <td>{e.round_id}</td>
                  <td>{e.scope}</td>
                  <td className="n-panel-sub">{new Date(e.starts_at).toLocaleTimeString()}</td>
                  <td className="n-panel-sub">{e.ends_at ? new Date(e.ends_at).toLocaleTimeString() : '—'}</td>
                  <td>
                    <Pill tone={e.is_expired && e.status === 'active' ? 'idle' : statusTone(e.status)}>
                      {e.is_expired && e.status === 'active' ? 'elapsed' : e.status}
                    </Pill>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {e.status === 'active' && (
                      <Btn small variant="danger" disabled={busy === e.id} onClick={() => expire(e.id)}>
                        End now
                      </Btn>
                    )}
                  </td>
                </tr>
              ))}
              {events.length === 0 && <Empty colSpan={7}>No events triggered yet</Empty>}
            </Table>
          )}
        </Panel>
      </div>

      {confirming && (
        <ConfirmDialog
          title={`Trigger ${confirming.label}?`}
          body={
            <>
              <p style={{ fontSize: 12.5, marginBottom: 8 }}>{KIND_COPY[confirming.kind]}</p>
              <p className="n-panel-sub">
                This opens the window for every active, payment-verified team in round {confirming.round_id}. It costs
                a team nothing — the multiplier is applied when their answers are graded. It cannot be undone, only
                expired early.
              </p>
            </>
          }
          confirmLabel="Trigger event"
          onCancel={() => setConfirming(null)}
          onConfirm={(roundId) => triggerWithRound(confirming, roundId)}
          busy={busy === confirming.key}
          defaultRound={confirming.round_id}
        />
      )}
    </>
  );
}

function ConfirmDialog({
  title, body, confirmLabel, onCancel, onConfirm, busy, defaultRound,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: (roundId: number) => void;
  busy?: boolean;
  defaultRound?: number;
}) {
  const [selectedRound, setSelectedRound] = useState(defaultRound ?? 5);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 100, background: 'rgb(0 0 0 / 72%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={onCancel}
    >
      <div className="n-panel" style={{ maxWidth: 420, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div className="n-panel-head"><div className="n-panel-title">{title}</div></div>
        <div className="n-panel-body">
          {body}
          <div style={{ marginTop: 12 }}>
            <label className="n-field-label">Target Round</label>
            <select
              className="n-field"
              value={selectedRound}
              onChange={(e) => setSelectedRound(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((r) => (
                <option key={r} value={r}>Round {r}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
            <Btn variant="primary" disabled={busy} onClick={() => onConfirm(selectedRound)}>{busy ? 'Working…' : confirmLabel}</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
