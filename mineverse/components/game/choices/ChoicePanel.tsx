'use client';

import { useEffect, useState, useCallback } from 'react';
import { Scroll, Check, AlertTriangle } from 'lucide-react';
import type { ChoiceKey } from '@/lib/gameplay/choices/service';
import { Panel, Btn, Pill, Loading } from '@/components/admin/nether-ui';

interface ChoicePanelProps {
  choiceKey: ChoiceKey;
  onDecided?: () => void;
  refreshToken?: number;
}

type Delta = Record<string, number>;

interface ChoiceOption { option: string; label: string; delta: Delta }
interface ChoiceData {
  choice_key: string;
  title: string;
  prompt: string;
  decided: boolean;
  selected_option: string | null;
  options: ChoiceOption[];
}

function describe(delta: Delta) {
  const parts = Object.entries(delta).filter(([, v]) => v !== 0);
  if (parts.length === 0) return 'no change';
  return parts.map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${k}`).join(', ');
}

export function ChoicePanel({ choiceKey, onDecided, refreshToken }: ChoicePanelProps) {
  const [choice, setChoice] = useState<ChoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ChoiceOption | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/team/choices?choice_key=${choiceKey}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setChoice(json.data.choices?.[0] ?? null);
    } catch {
      // Leaves the last known state on screen.
    } finally {
      setLoading(false);
    }
  }, [choiceKey]);

  useEffect(() => { void load(); }, [load, refreshToken]);

  const decide = async (option: ChoiceOption) => {
    setError(null);
    setBusy(option.option);
    try {
      const res = await fetch('/api/team/choices/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          choice_key: choiceKey,
          option: option.option,
          round_id: roundIdFor(choiceKey),
          idempotency_key: crypto.randomUUID(),
        }),
      });
      const json = await res.json();

      if (json.success) {
        setConfirm(null);
        await load();
        onDecided?.();
      } else {
        setError(
          json.error?.code === 'ALREADY_DECIDED'
            ? 'You have already decided this event.'
            : json.error?.code === 'INSUFFICIENT_FUNDS'
              ? 'You do not have enough resources for that option.'
              : json.error?.message ?? 'Could not record your choice.',
        );
        // A conflict means the server already has a decision; resync.
        if (json.error?.code === 'ALREADY_DECIDED') await load();
      }
    } catch {
      setError('Could not reach the server. Your choice was not recorded.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Scroll size={13} /> {choice?.title ?? 'Choice event'}</span>}
      actions={choice?.decided ? <Pill tone="ok"><Check size={10} /> decided</Pill> : <Pill tone="warn">pending</Pill>}
    >
      {loading ? (
        <Loading label="Loading event" />
      ) : !choice ? (
        <div className="n-empty">This event is not available.</div>
      ) : (
        <>
          <p style={{ fontSize: 11, marginBottom: 12 }}>{choice.prompt}</p>

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
            {choice.options.map((option) => {
              const chosen = choice.selected_option === option.option;
              return (
                <div
                  key={option.option}
                  style={{
                    padding: 10,
                    background: 'var(--bg-void)',
                    border: `1px solid ${chosen ? 'var(--accent-primary)' : 'rgb(from var(--accent-muted) r g b / 25%)'}`,
                    opacity: choice.decided && !chosen ? 0.45 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 11 }}>{option.label}</div>
                      <div className="n-panel-sub n-mono" style={{ marginTop: 3 }}>{describe(option.delta)}</div>
                    </div>
                    {chosen ? (
                      <Pill tone="ok"><Check size={10} /> chosen</Pill>
                    ) : !choice.decided ? (
                      <Btn small disabled={busy !== null} onClick={() => setConfirm(option)}>Choose</Btn>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {!choice.decided && (
            <p className="n-panel-sub" style={{ marginTop: 10 }}>
              You can only decide once, and it cannot be undone.
            </p>
          )}
        </>
      )}

      {confirm && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 100, background: 'rgb(0 0 0 / 72%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={() => setConfirm(null)}
        >
          <div className="n-panel" style={{ maxWidth: 360, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="n-panel-head"><div className="n-panel-title">Confirm choice</div></div>
            <div className="n-panel-body">
              <p style={{ fontSize: 11, marginBottom: 6 }}>{confirm.label}</p>
              <p className="n-panel-sub n-mono" style={{ marginBottom: 12 }}>{describe(confirm.delta)}</p>
              <p className="n-panel-sub" style={{ marginBottom: 14 }}>
                This is final — the event cannot be replayed.
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Btn variant="ghost" onClick={() => setConfirm(null)}>Cancel</Btn>
                <Btn variant="primary" disabled={busy !== null} onClick={() => decide(confirm)}>
                  {busy ? 'Recording…' : 'Confirm'}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

/** Ancient Shrine resolves in the Cave Biome, the Piglin Merchant in the Mountain. */
function roundIdFor(key: ChoiceKey) {
  return key === 'ancient_shrine' ? 2 : 3;
}
