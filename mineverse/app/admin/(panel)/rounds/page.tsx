'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Play, Square, Plus, RefreshCw, Lock } from 'lucide-react';
import { Panel, Btn, Pill, statusTone, Loading, PageTitle, apiCall } from '@/components/admin/nether-ui';

type RoundRow = {
  id: number;
  name: string;
  day: number;
  sequence: number;
  description: string | null;
  time_allotted: number;
  status: 'locked' | 'active' | 'completed';
  starts_at: string | null;
  ends_at: string | null;
};

function remaining(endsAt: string | null, now: number) {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return 'time up';
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function AdminRoundsPage() {
  const [rounds, setRounds] = useState<RoundRow[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    const res = await apiCall<RoundRow[]>('/api/admin/rounds');
    if (res.ok) setRounds(res.data ?? []);
    else toast.error(res.message);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const act = async (id: number, action: 'toggle' | 'extend', minutes?: number) => {
    setBusy(id);
    const res = await apiCall<{ newStatus?: string }>('/api/admin/rounds/action', {
      method: 'POST',
      body: JSON.stringify({ round_id: id, action, minutes }),
    });
    setBusy(null);

    if (res.ok) {
      toast.success(action === 'extend' ? `Extended by ${minutes} minutes` : `Round is now ${res.data?.newStatus ?? 'updated'}`);
      void load();
    } else {
      toast.error(res.message);
    }
  };

  if (!rounds) {
    return (<><PageTitle title="Round control" /><Panel><Loading label="Loading rounds" /></Panel></>);
  }

  return (
    <>
      <PageTitle
        title="Round control"
        subtitle="Starting a round unlocks it for every payment-verified team and broadcasts to their dashboards"
        actions={<Btn onClick={load}><RefreshCw size={12} /> Refresh</Btn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 12 }}>
        {rounds.map((round) => {
          const left = remaining(round.ends_at, now);
          const isActive = round.status === 'active';

          return (
            <Panel
              key={round.id}
              title={round.name}
              subtitle={`Day ${round.day} · Round ${round.sequence} · ${round.time_allotted} min`}
              actions={<Pill tone={statusTone(round.status)}>{round.status}</Pill>}
            >
              {round.description && (
                <p className="n-panel-sub" style={{ marginBottom: 12 }}>{round.description}</p>
              )}

              {isActive && (
                <div
                  style={{
                    padding: 12,
                    background: 'var(--bg-void)',
                    border: '1px solid rgb(235 71 4 / 40%)',
                    textAlign: 'center',
                    marginBottom: 12,
                  }}
                >
                  <div className="n-stat-label">Time remaining</div>
                  <div
                    className="n-mono"
                    style={{
                      fontSize: 26,
                      color: left === 'time up' ? '#ff9db0' : 'var(--accent-primary)',
                      textShadow: '0 0 10px rgb(235 71 4 / 45%)',
                      marginTop: 4,
                    }}
                  >
                    {left ?? '--:--'}
                  </div>
                  {round.starts_at && (
                    <div className="n-panel-sub" style={{ marginTop: 4 }}>
                      Started {new Date(round.starts_at).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {round.status === 'locked' && (
                  <Btn variant="primary" disabled={busy === round.id} onClick={() => act(round.id, 'toggle')} style={{ flex: 1 }}>
                    <Play size={12} /> Start round
                  </Btn>
                )}

                {isActive && (
                  <>
                    <Btn disabled={busy === round.id} onClick={() => act(round.id, 'extend', 5)}>
                      <Plus size={12} /> 5m
                    </Btn>
                    <Btn disabled={busy === round.id} onClick={() => act(round.id, 'extend', 10)}>
                      <Plus size={12} /> 10m
                    </Btn>
                    <Btn variant="danger" disabled={busy === round.id} onClick={() => act(round.id, 'toggle')} style={{ flex: 1 }}>
                      <Square size={12} /> End round
                    </Btn>
                  </>
                )}

                {round.status === 'completed' && (
                  <>
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        padding: '9px 12px',
                        background: 'var(--bg-void)',
                        border: '1px solid rgb(150 35 14 / 30%)',
                        fontSize: 10,
                        letterSpacing: 1,
                        textTransform: 'uppercase',
                        color: 'var(--text-portal)',
                      }}
                    >
                      <Lock size={12} /> Locked — ready to grade
                    </div>
                    <Btn disabled={busy === round.id} onClick={() => act(round.id, 'toggle')}>
                      Reopen
                    </Btn>
                  </>
                )}
              </div>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
