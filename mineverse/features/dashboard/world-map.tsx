'use client';

import { useEffect } from 'react';
import { Lock, RotateCcw } from 'lucide-react';
import type { DashboardRound } from '@/features/dashboard/types';

/**
 * The Mineverse map: the only way into a round.
 *
 * This was five near-identical 90-line inline-styled buttons inside the
 * dashboard component, so the reveal rule and the disabled styling were written
 * out five times and Round 3's copy had already drifted from Round 1's. The
 * hotspot coordinates and colours below are the ones those buttons carried; the
 * behaviour is now written once.
 *
 * `can_enter` is display state, never permission. Each round page calls
 * `requireRoundAccess` and every mutation re-checks on the server, so a button
 * that is wrong here is a cosmetic bug, not a way in.
 */

interface Biome {
  roundId: number;
  label: string;
  glyph: string;
  accent: string;
  /** Percentage position of the hotspot over the map art. */
  top: string;
  left: string;
}

const BIOMES: Biome[] = [
  { roundId: 1, label: 'FOREST BIOME', glyph: '🌲', accent: '#55ff55', top: '25%', left: '65%' },
  { roundId: 2, label: 'CAVE BIOME', glyph: '⛏️', accent: '#a0a0b0', top: '65%', left: '35%' },
  { roundId: 3, label: 'MOUNTAIN BIOME', glyph: '⛰️', accent: '#aaddff', top: '30%', left: '35%' },
  { roundId: 4, label: 'NETHER BIOME', glyph: '🔥', accent: '#ff6666', top: '65%', left: '65%' },
  { roundId: 5, label: 'THE END', glyph: '✨', accent: '#dd88ff', top: '78%', left: '75%' },
];

/** The map art redraws itself as the furthest-unlocked biome comes into reach. */
function mapArtFor(rounds: DashboardRound[]) {
  const open = (id: number) => rounds.find((round) => round.round_id === id)?.can_enter;
  if (open(5)) return '/final-biome-map.jpg';
  if (open(4)) return '/nether-biome-map.jpg';
  if (open(3)) return '/mountain-biome-map.jpg';
  if (open(2)) return '/cave-biome-map.jpg';
  return '/map.webp';
}

interface WorldMapProps {
  rounds: DashboardRound[];
  onClose: () => void;
  onEnter: (path: string) => void;
}

export function WorldMap({ rounds, onClose, onEnter }: WorldMapProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const byId = (id: number) => rounds.find((round) => round.round_id === id);

  return (
    <div className="wm__backdrop" onClick={onClose} role="presentation">
      <div
        className="wm"
        role="dialog"
        aria-modal="true"
        aria-label="Mineverse world map"
        onClick={(event) => event.stopPropagation()}
      >
        <img src={mapArtFor(rounds)} alt="World map" className="wm__art" />

        {BIOMES.map((biome) => {
          const round = byId(biome.roundId);
          const previous = byId(biome.roundId - 1);

          /* A biome stays off the map until the one before it is finished, or
             until this one — or anything past it — is open. Round 1 is always
             on the map; there is nothing before it to wait for. */
          const laterIsOpen = rounds.some((entry) => entry.round_id >= biome.roundId && entry.can_enter);
          if (biome.roundId > 1 && !previous?.completed_at && !laterIsOpen) return null;

          const enterable = round?.can_enter ?? false;
          const completed = Boolean(round?.completed_at);

          return (
            <button
              key={biome.roundId}
              type="button"
              disabled={!enterable}
              className={enterable ? 'wm__pin wm__pin--open' : 'wm__pin'}
              style={{ top: biome.top, left: biome.left, ['--pin' as string]: biome.accent }}
              onClick={() => {
                if (!enterable) return;
                onClose();
                onEnter(`/round${biome.roundId}`);
              }}
            >
              <span className="wm__pin-row">
                <span className="wm__pin-glyph" aria-hidden="true">
                  {enterable ? completed ? <RotateCcw size={15} /> : biome.glyph : <Lock size={13} />}
                </span>
                <span>
                  {completed ? 'REPLAY ' : enterable ? 'ACCESS ' : ''}
                  {biome.label}
                  {!enterable && ' LOCKED'}
                </span>
              </span>
              {/* Names the tool rather than only refusing: a locked biome with no
                  reason reads as a platform fault, and the fix is one craft away. */}
              {round?.needs_craft && <span className="wm__pin-dev">CRAFT {String(round.needs_craft).toUpperCase()}</span>}
              {round?.unlocked_by_dev_mode && <span className="wm__pin-dev">DEV UNLOCKED</span>}
            </button>
          );
        })}

        <button type="button" className="wm__close" onClick={onClose}>
          CLOSE MAP
        </button>
      </div>
    </div>
  );
}
