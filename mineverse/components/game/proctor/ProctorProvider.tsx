'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useProctor, type UseProctorResult } from '@/hooks/useProctor';
import { ProctorGate } from './ProctorGate';
import { ProctorOverlay } from './ProctorOverlay';
import './proctor-ui.css';

/**
 * Wraps a round screen so monitoring starts before the questions are visible.
 *
 * The gate exists for a mechanical reason as much as a procedural one:
 * `requestFullscreen` only works inside a user gesture, and the round shells
 * render straight into the questions with no button to hang that gesture on.
 *
 * Shells read `finish()` off the context so that submitting a round closes the
 * proctor session and leaves fullscreen in the same action.
 */

const ProctorContext = createContext<UseProctorResult | null>(null);

/**
 * Never throws. A component outside a provider (Round 5's shell is reachable
 * both ways) gets a no-op rather than a crash mid-round.
 */
export function useProctorSession(): UseProctorResult | null {
  return useContext(ProctorContext);
}

interface ProctorProviderProps {
  roundId: number;
  /** Palette class from `roundChrome`, e.g. `round-ui--forest`. */
  themeClass?: string;
  /** Round name shown on the gate. */
  roundName?: string;
  eyebrow?: string;
  children: ReactNode;
}

export function ProctorProvider({
  roundId,
  themeClass,
  roundName,
  eyebrow,
  children,
}: ProctorProviderProps) {
  const proctor = useProctor(roundId);

  // Kill switch: render the round untouched, with no gate and no listeners.
  if (!proctor.enabled) {
    return <ProctorContext.Provider value={proctor}>{children}</ProctorContext.Provider>;
  }

  return (
    <ProctorContext.Provider value={proctor}>
      {proctor.started ? (
        <>
          {children}
          <ProctorOverlay proctor={proctor} themeClass={themeClass} />
        </>
      ) : (
        <ProctorGate
          proctor={proctor}
          roundId={roundId}
          roundName={roundName}
          eyebrow={eyebrow}
          themeClass={themeClass}
        />
      )}
    </ProctorContext.Provider>
  );
}
