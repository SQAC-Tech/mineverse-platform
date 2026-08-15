'use client';

import type { ReactNode } from 'react';
import { roundChrome } from '@/components/game/custom-round-ui/round-presentation';
import { ProctorProvider } from './ProctorProvider';

/**
 * Drops a round page behind the proctor gate.
 *
 * Exists so a round page stays two lines and the shells stay unaware of the
 * proctor except for the one call that ends the session on submit. Pulls the
 * biome palette from `roundChrome` so the gate looks like the round it guards
 * rather than a generic interstitial.
 */
export function ProctoredRound({ roundId, children }: { roundId: number; children: ReactNode }) {
  const chrome = roundChrome(roundId);
  return (
    <ProctorProvider
      roundId={roundId}
      themeClass={chrome.themeClass}
      roundName={chrome.name}
      eyebrow={chrome.eyebrow}
    >
      {children}
    </ProctorProvider>
  );
}
