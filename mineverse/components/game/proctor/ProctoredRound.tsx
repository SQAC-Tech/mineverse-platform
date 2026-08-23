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
export function ProctoredRound({
  roundId,
  exempt,
  children,
}: {
  roundId: number;
  /**
   * Skip monitoring for this team entirely — no gate, no fullscreen, no
   * listeners. Set for demo teams so an organizer can walk a round without
   * being locked into fullscreen and racking up violations for alt-tabbing.
   *
   * Decided on the server and passed down, because the demo list is
   * server-only config (`DEMO_TEAM_CODES`, deliberately no NEXT_PUBLIC_ prefix)
   * and must not reach the browser. The alternative — the global
   * `NEXT_PUBLIC_PROCTOR_ENABLED=false` — would unproctor all fifty-two real
   * teams along with them.
   */
  exempt?: boolean;
  children: ReactNode;
}) {
  const chrome = roundChrome(roundId);
  return (
    <ProctorProvider
      roundId={roundId}
      enabled={!exempt}
      themeClass={chrome.themeClass}
      roundName={chrome.name}
      eyebrow={chrome.eyebrow}
    >
      {children}
    </ProctorProvider>
  );
}
