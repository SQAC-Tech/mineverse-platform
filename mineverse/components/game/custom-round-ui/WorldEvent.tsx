'use client';

import { useEffect, useRef } from 'react';
import { CloudRain, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export interface ActiveModifier {
  event_key?: string;
  label?: string;
  modifier?: Record<string, number>;
  expires_at?: string | null;
}

interface WorldEventProps {
  event: ActiveModifier | undefined;
  /** Seconds remaining, or null when the server gave no expiry. */
  remaining: number | null;
  /** Optional: rounds without their own artwork render the panel without it. */
  art?: string;
  /** Copy shown when nothing is running, e.g. "The forest is calm." */
  idleText: string;
  /** Full duration of this round's event window, used for the meter. */
  windowSeconds?: number;
}

/** "wood ×2, iron ×2" — reads the same way the server states the modifier. */
function effectText(modifier: Record<string, number> | undefined) {
  if (!modifier) return null;
  const parts = Object.entries(modifier)
    .filter(([, value]) => typeof value === 'number' && value !== 1)
    .map(([resource, value]) => `${resource} ×${value}`);
  return parts.length ? parts.join(', ') : null;
}

export function WorldEvent({ event, remaining, art, idleText, windowSeconds = 300 }: WorldEventProps) {
  const isActive = Boolean(event) && (remaining === null || remaining > 0);
  const justEnded = Boolean(event) && remaining !== null && remaining <= 0;
  const effect = effectText(event?.modifier);

  // The card carries the countdown, so the arrival of an event only needs to be
  // announced once. A toast is used rather than an in-page banner because the
  // round is a fixed single screen with no room to give away.
  const announced = useRef<string | null>(null);

  useEffect(() => {
    const key = event?.event_key ?? event?.label ?? null;
    if (!isActive || !key) {
      if (!isActive) announced.current = null;
      return;
    }
    if (announced.current === key) return;
    announced.current = key;

    toast.custom(() => (
      <div className="we-toast">
        <Sparkles size={18} aria-hidden="true" />
        <div>
          <strong>{event?.label ?? 'World event'} has begun</strong>
          {effect && <span>Rewards boosted — {effect}.</span>}
        </div>
      </div>
    ), { duration: 9000 });
  }, [event, isActive, effect]);

  const percent = remaining === null ? 100 : Math.max(0, Math.min(100, (remaining / windowSeconds) * 100));

  return (
    <section className="round-ui__panel round-ui__card">
      <p className="round-ui__panel-title">World event</p>

      <div className="round-ui__event">
        <div className={isActive ? 'round-ui__art we-art we-art--live' : 'round-ui__art we-art'}>
          {art && <img src={art} alt="" />}
        </div>
        <div>
          <strong className="round-ui__event-name">
            {isActive ? event?.label : justEnded ? `${event?.label} ended` : 'No active event'}
          </strong>
          <span className="round-ui__event-note">
            {isActive
              ? effect
                ? `Rewards boosted — ${effect}.`
                : 'A modifier is in force for this round.'
              : justEnded
                ? 'The window has closed. Rewards are back to normal.'
                : idleText}
          </span>
        </div>
      </div>

      {isActive && (
        <>
          <div className="round-ui__event-clock">
            <span>
              {remaining === null
                ? 'ACTIVE'
                : `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`}
            </span>
            <small>REMAINING</small>
          </div>
          <div className="round-ui__meter"><i style={{ width: `${percent}%` }} /></div>
        </>
      )}

      {!isActive && (
        <p className="we-hint">
          <CloudRain size={13} aria-hidden="true" /> Events are triggered by organizers and applied by the server.
        </p>
      )}
    </section>
  );
}
