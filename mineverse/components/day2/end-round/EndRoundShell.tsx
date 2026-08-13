'use client';

import Link from 'next/link';
import { Sword } from 'lucide-react';
import { RoundShell } from '@/components/game/round-shell/RoundShell';
import { Panel } from '@/components/admin/nether-ui';

interface EndRoundShellProps {
  roundId: number;
}

/**
 * Thin wrapper over the existing RoundShell for Round 5 (The End).
 *
 * Adds:
 * - A link to Dev 3's Final Boss route (does NOT reimplement it)
 * - A banner indicating the Diamond Pickaxe is required for the Final Boss
 *
 * Everything else (questions, crafting, resources, countdown, polling,
 * submissions) is handled by the shared RoundShell.
 */
export function EndRoundShell({ roundId }: EndRoundShellProps) {
  return (
    <>
      <RoundShell roundId={roundId} />

      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 16px 40px' }}>
        <Panel title="Final Boss Challenge">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 11.5 }}>
            <Sword size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ marginBottom: 8 }}>
                Once you've crafted the <strong>Diamond Pickaxe</strong>, the Final Boss Challenge becomes available.
                Defeat the Ender Dragon to become the champions of MINEVERSE!
              </p>
              <Link
                href="/final-boss"
                className="n-btn n-btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Sword size={12} />
                Go to Final Boss
              </Link>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
