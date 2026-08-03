'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Home, Hammer, Wrench, AlertTriangle } from 'lucide-react';
import { StructureType } from '@/lib/gameplay/structures/service';
import { Panel, Btn, Pill, Loading } from '@/components/admin/nether-ui';

interface StructureManagerProps {
  roundId: number;
  availableStructures: StructureType[];
  onChanged?: () => void;
  refreshToken?: number;
}

type Cost = Record<string, number>;

interface CatalogEntry {
  type: StructureType;
  name: string;
  ability: string;
  upgradeName: string;
  upgradeAbility: string;
  upgrade_cost: Cost;
  repair_cost: Cost;
}

interface StructureState {
  chosen: { id: string; type: StructureType; state: string } | null;
  catalog: CatalogEntry[];
}

function cost(c: Cost) {
  const parts = Object.entries(c ?? {}).filter(([, v]) => v !== 0);
  return parts.length ? parts.map(([k, v]) => `${v} ${k}`).join(' + ') : 'free';
}

export function StructureManager({ roundId, availableStructures, onChanged, refreshToken }: StructureManagerProps) {
  const [data, setData] = useState<StructureState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/team/structures?round_id=${roundId}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      // Keeps whatever is already on screen.
    } finally {
      setLoading(false);
    }
  }, [roundId]);

  useEffect(() => { void load(); }, [load, refreshToken]);

  const act = async (endpoint: 'build' | 'upgrade' | 'repair', type: StructureType, label: string) => {
    setError(null);
    setBusy(`${endpoint}:${type}`);
    try {
      const res = await fetch(`/api/team/structures/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ type, round_id: roundId, idempotency_key: crypto.randomUUID() }),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(label);
        await load();
        onChanged?.();
      } else {
        setError(errorCopy(json.error?.code, json.error?.message));
      }
    } catch {
      setError('Could not reach the server. Nothing was changed.');
    } finally {
      setBusy(null);
    }
  };

  const entries = (data?.catalog ?? []).filter((c) => availableStructures.includes(c.type));
  const chosen = data?.chosen ?? null;

  return (
    <Panel
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Home size={13} /> Structure</span>}
      subtitle={chosen ? 'One free structure per round — already chosen' : 'Free to build, choose one'}
      actions={chosen ? <Pill tone={chosen.state === 'damaged' ? 'danger' : 'ok'}>{chosen.state}</Pill> : <Pill tone="idle">none built</Pill>}
    >
      {loading ? (
        <Loading label="Loading structures" />
      ) : (
        <>
          {error && (
            <div
              style={{
                display: 'flex', gap: 8, padding: 9, marginBottom: 10, fontSize: 10.5,
                background: 'rgb(from var(--accent-danger) r g b / 45%)',
                border: '1px solid #a3324a', color: '#ff9db0',
              }}
            >
              <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.map((entry) => {
              const isChosen = chosen?.type === entry.type;
              const state = isChosen ? chosen!.state : null;
              const upgraded = state === 'upgraded';
              const damaged = state === 'damaged';

              return (
                <div
                  key={entry.type}
                  style={{
                    padding: 11,
                    background: 'var(--bg-void)',
                    border: `1px solid ${isChosen ? 'var(--accent-primary)' : 'rgb(from var(--accent-muted) r g b / 25%)'}`,
                    opacity: chosen && !isChosen ? 0.45 : 1,
                  }}
                >
                  <div style={{ fontSize: 11, marginBottom: 3 }}>
                    {upgraded ? entry.upgradeName : entry.name}
                  </div>
                  <p className="n-panel-sub" style={{ marginBottom: 9 }}>
                    {upgraded ? entry.upgradeAbility : entry.ability}
                  </p>

                  {/* Nothing built yet → this is the one free choice. */}
                  {!chosen && (
                    <Btn
                      variant="primary"
                      small
                      style={{ width: '100%' }}
                      disabled={busy !== null}
                      onClick={() => act('build', entry.type, `${entry.name} built`)}
                    >
                      <Hammer size={11} /> {busy === `build:${entry.type}` ? 'Building…' : 'Build (free)'}
                    </Btn>
                  )}

                  {isChosen && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {damaged && (
                        <Btn
                          variant="danger"
                          small
                          style={{ flex: 1 }}
                          disabled={busy !== null}
                          onClick={() => act('repair', entry.type, `${entry.name} repaired`)}
                        >
                          <Wrench size={11} /> Repair · {cost(entry.repair_cost)}
                        </Btn>
                      )}
                      {!upgraded && !damaged && (
                        <Btn
                          small
                          style={{ flex: 1 }}
                          disabled={busy !== null}
                          onClick={() => act('upgrade', entry.type, `Upgraded to ${entry.upgradeName}`)}
                        >
                          <Hammer size={11} /> Upgrade · {cost(entry.upgrade_cost)}
                        </Btn>
                      )}
                      {upgraded && <Pill tone="ok">fully upgraded</Pill>}
                    </div>
                  )}

                  {chosen && !isChosen && (
                    <p className="n-panel-sub">You already built the {chosen.type.replace('_', ' ')} this round.</p>
                  )}
                </div>
              );
            })}

            {entries.length === 0 && <div className="n-empty">No structures available in this round.</div>}
          </div>
        </>
      )}
    </Panel>
  );
}

function errorCopy(code?: string, message?: string) {
  switch (code) {
    case 'ALREADY_BUILT': return 'You have already built a structure this round.';
    case 'NOT_FOUND': return 'Build the structure before upgrading or repairing it.';
    case 'ALREADY_UPGRADED': return 'This structure is already fully upgraded.';
    case 'NOT_DAMAGED': return 'This structure is not damaged.';
    case 'INSUFFICIENT_FUNDS': return 'Not enough resources for that.';
    case 'TEAM_NOT_AUTHORIZED_FOR_ROUND': return 'This round is not unlocked for your team.';
    default: return message ?? 'That action could not be completed.';
  }
}
