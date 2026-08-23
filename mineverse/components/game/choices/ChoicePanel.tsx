'use client';

import { useEffect, useState, useCallback } from 'react';
import { ArrowDown } from 'lucide-react';
import type { ChoiceKey } from '@/lib/gameplay/choices/service';
import { RESOURCE_META } from '@/components/game/custom-round-ui/round-presentation';
import '@/features/dashboard/shop-ui.css';

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
          // No round_id: the server derives the trader's round from the choice
          // key itself (`CHOICE_ROUND`), so a client cannot disagree with it.
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

  const options = choice?.options ?? [];

  return (
    <div className="shop">
      {choice?.prompt && <p className="shop__note">{choice.prompt}</p>}

      {!choice?.decided && (
        <p className="shop__warn">&#9670; ONE CHOICE &mdash; CANNOT BE UNDONE &#9670;</p>
      )}

      {error && <p className="shop__error">{error}</p>}

      {loading ? (
        <p className="shop__note">Loading&hellip;</p>
      ) : !choice ? (
        <p className="shop__note">This trader is not available.</p>
      ) : choice.decided ? (
        <p className="shop__decided">
          You offered <b>{labelFor(options, choice.selected_option)}</b>. This decision is final.
        </p>
      ) : (
        <div className="shop__cards">
          {options.map((option) => {
            // "Ignore" is the option that only ever costs, so it is drawn drab
            // rather than dressed up as a trade.
            const isRefusal = option.option === 'ignore';
            const costs = legs(option.delta, 'cost');
            const gains = legs(option.delta, 'gain');

            return (
              <div className={isRefusal ? 'shop__card shop__card--dull' : 'shop__card'} key={option.option}>
                <p className="shop__card-title">{option.label}</p>

                {costs.map((leg) => (
                  <span className="shop__leg shop__leg--cost" key={`c-${leg.key}`}>
                    {leg.icon ? <img src={leg.icon} alt="" /> : null}
                    <b>{leg.amount}</b>
                  </span>
                ))}

                {gains.length > 0 && (
                  <span className="shop__arrow" aria-hidden="true">
                    <ArrowDown size={18} />
                  </span>
                )}

                {gains.map((leg) => (
                  <span className="shop__leg shop__leg--gain" key={`g-${leg.key}`}>
                    {leg.icon ? <img src={leg.icon} alt="" /> : null}
                    <b>+{leg.amount}</b>
                  </span>
                ))}

                <button
                  type="button"
                  className={isRefusal ? 'shop__btn' : 'shop__btn shop__btn--gold'}
                  disabled={busy !== null}
                  onClick={() => setConfirm(option)}
                >
                  {busy === option.option ? '…' : 'CHOOSE'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {confirm && (
        <div className="shop__decided" role="alertdialog">
          <p style={{ margin: '0 0 10px' }}>
            Offer <b>{confirm.label}</b> ({describe(confirm.delta)})? This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button type="button" className="shop__btn shop__btn--gold" disabled={busy !== null} onClick={() => void decide(confirm)}>
              {busy ? '…' : 'CONFIRM'}
            </button>
            <button type="button" className="shop__btn" disabled={busy !== null} onClick={() => setConfirm(null)}>
              CANCEL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The delta split into what it takes and what it gives, with block icons. */
function legs(delta: Delta, side: 'cost' | 'gain') {
  return Object.entries(delta ?? {})
    .filter(([, value]) => (side === 'cost' ? value < 0 : value > 0))
    .map(([key, value]) => ({
      key,
      amount: side === 'cost' ? value : value,
      icon: RESOURCE_META.find((meta) => meta.key === key)?.icon ?? null,
    }));
}

function labelFor(options: ChoiceOption[], selected: string | null) {
  return options.find((option) => option.option === selected)?.label ?? selected ?? 'an offering';
}
