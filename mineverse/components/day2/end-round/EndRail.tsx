'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Coins, Lock, Sword } from 'lucide-react';
import type { CraftedItem, DashboardProgress } from '@/features/dashboard/types';

/**
 * The two things Round 5 has that no other round does.
 *
 * They live in the rail beside the questions rather than on a page of their own,
 * because The End is one hour and a team should not have to leave the round to
 * see whether it can fight yet.
 */

interface EndRailProps {
  progress: DashboardProgress | null;
  crafted: CraftedItem[];
  onTraded: () => void;
}

/* Mirrors app/api/team/choices/end-merchant. The deltas are stated here so a
   team can read the trade before taking it; the server owns the arithmetic and
   applies its own copy, so a stale label can never move resources. */
const TRADES = [
  { option: 'option_a', label: 'Give 5 Emeralds', gain: 'Get 18 Diamonds' },
  { option: 'option_b', label: 'Give 12 Diamonds', gain: 'Get 4 Emeralds' },
  { option: 'option_c', label: 'Walk away', gain: 'Nothing changes' },
] as const;

export function EndMerchantPanel({ progress, onTraded }: { progress: DashboardProgress | null; onTraded: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const traded = progress?.end_merchant.traded ?? false;

  const trade = async (option: string) => {
    setBusy(option);
    setError('');
    try {
      const res = await fetch('/api/team/choices/end-merchant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          choice: option,
          // Keyed on the team's one trade, so a double-click or a retry after a
          // dropped response cannot take the deal twice.
          idempotency_key: `end-merchant:${option}`,
        }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? 'The merchant refused the trade.');
      else onTraded();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="round-ui__panel round-ui__card">
      <p className="round-ui__panel-title">
        End Merchant
        {traded && <span className="round-ui__type-badge">Done</span>}
      </p>

      {traded ? (
        <p className="round-ui__card-text">
          {progress?.end_merchant.reason ?? 'You have already traded with the merchant.'} The merchant deals once.
        </p>
      ) : (
        <>
          <p className="round-ui__card-text">One trade, once. Choose carefully.</p>
          <div className="round-ui__choices round-ui__choices--stack">
            {TRADES.map((option) => (
              <button
                key={option.option}
                type="button"
                className="round-ui__choice"
                disabled={busy !== null}
                onClick={() => void trade(option.option)}
              >
                <Coins size={14} aria-hidden="true" />
                <span>
                  <b>{option.label}</b>
                  <small>{busy === option.option ? 'Trading…' : option.gain}</small>
                </span>
              </button>
            ))}
          </div>
          {error && <p className="round-ui__card-text round-ui__card-text--bad">{error}</p>}
        </>
      )}
    </section>
  );
}

export function FinalBossPanel({ progress, crafted }: { progress: DashboardProgress | null; crafted: CraftedItem[] }) {
  const portalRepaired = progress?.portal.is_repaired ?? false;
  const pickaxe = crafted.find((item) => item.item === 'diamond_pickaxe')?.crafted ?? false;
  const ready = portalRepaired && pickaxe;

  return (
    <section className="round-ui__panel round-ui__card">
      <p className="round-ui__panel-title">
        Final Boss
        {!ready && <span className="round-ui__type-badge">Locked</span>}
      </p>

      {/* The same two gates the server checks in /api/team/final-boss/attempts,
          named individually — "locked" on its own never told a team what to go
          and do. */}
      <ul className="round-ui__reqs">
        <li data-met={String(portalRepaired)}>
          {portalRepaired ? <Check size={13} /> : <Lock size={13} />} Nether Portal repaired
        </li>
        <li data-met={String(pickaxe)}>
          {pickaxe ? <Check size={13} /> : <Lock size={13} />} Diamond Pickaxe crafted
        </li>
      </ul>

      {ready ? (
        <Link href="/final-boss" className="round-ui__cta">
          <Sword size={16} /> Face the Ender Dragon
        </Link>
      ) : (
        <p className="round-ui__card-text">
          {portalRepaired ? 'Craft the Diamond Pickaxe to open the fight.' : 'Repair the portal in Round 4 first.'}
        </p>
      )}
    </section>
  );
}

export function EndRail({ progress, crafted, onTraded }: EndRailProps) {
  return (
    <>
      <FinalBossPanel progress={progress} crafted={crafted} />
      <EndMerchantPanel progress={progress} onTraded={onTraded} />
    </>
  );
}
