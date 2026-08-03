'use client';

import { useRouter } from 'next/navigation';
import { Lock, CheckCircle2, Play, Wrench } from 'lucide-react';

export interface DashboardRound {
  round_id: number;
  name: string;
  day: number | null;
  sequence: number | null;
  description: string;
  time_allotted: number | null;
  round_status: string;
  is_locked: boolean;
  completed_at: string | null;
  can_enter: boolean;
  unlocked_by_dev_mode: boolean;
}

/**
 * Horizontal centre of each portal, as a percentage of viewport width, matched to
 * the four panels on the four-season screen. Tweak these to re-align the cards if
 * the video is re-cut.
 */
const PANEL_CENTERS_PCT = [16.5, 38.5, 61.5, 83.5];

const ACCENTS = [
  { border: 'rgba(120,220,140,0.85)', glow: 'rgba(120,220,140,0.55)' }, // Forest
  { border: 'rgba(150,160,180,0.85)', glow: 'rgba(150,160,180,0.55)' }, // Cave
  { border: 'rgba(255,170,80,0.85)', glow: 'rgba(255,170,80,0.55)' },   // Mountain
  { border: 'rgba(190,120,255,0.85)', glow: 'rgba(190,120,255,0.55)' }, // Nether
];

interface RoundPortalsProps {
  rounds: DashboardRound[];
  devUnlock: boolean;
  visible: boolean;
}

export function RoundPortals({ rounds, devUnlock, visible }: RoundPortalsProps) {
  const router = useRouter();

  // Always render four slots so the layout matches the video even while the
  // dashboard payload is still loading.
  const slots = Array.from({ length: 4 }, (_, index) =>
    rounds.find((round) => round.round_id === index + 1) ?? null,
  );

  const enter = (roundId: number) => router.push(`/round${roundId}`);

  return (
    <>
      <style>{`
        @keyframes portal-rise {
          from { opacity: 0; transform: translate(-50%, 28px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }

        .portal-layer {
          position: absolute;
          inset: 0;
          z-index: 40;
        }

        .portal-card {
          position: absolute;
          bottom: 11%;
          transform: translateX(-50%);
          width: clamp(150px, 19vw, 260px);
          transition: transform 0.18s ease, filter 0.18s ease;
        }
        .portal-card.enterable:hover  { transform: translate(-50%, -6px); filter: brightness(1.12); }
        .portal-card.enterable:active { transform: translate(-50%, -2px) scale(0.985); }

        /* Narrow screens: the video panels are too small to overlay, so the
           portals become a normal scrollable stack. */
        @media (max-width: 900px) {
          .portal-layer {
            display: flex;
            flex-direction: column;
            gap: 14px;
            padding: 72px 20px 32px;
            overflow-y: auto;
            background: rgba(0,0,0,0.55);
          }
          .portal-card {
            position: relative;
            left: auto !important;
            bottom: auto;
            transform: none;
            width: 100%;
            max-width: 420px;
            margin: 0 auto;
            animation: none !important;
          }
          .portal-card.enterable:hover  { transform: translateY(-4px); }
          .portal-card.enterable:active { transform: scale(0.99); }
        }
      `}</style>

      <div
        className="portal-layer"
        style={{
          pointerEvents: visible ? 'auto' : 'none',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.6s ease-out',
        }}
      >
        {slots.map((round, index) => {
          const roundId = index + 1;
          const accent = ACCENTS[index];
          const enterable = round?.can_enter ?? false;
          const completed = Boolean(round?.completed_at);

          return (
            <div
              key={roundId}
              className={`portal-card ${enterable ? 'enterable' : ''}`}
              onClick={() => enterable && enter(roundId)}
              style={{
                left: `${PANEL_CENTERS_PCT[index]}%`,
                background: 'rgba(10,12,18,0.82)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: `2px solid ${enterable ? accent.border : 'rgba(120,130,150,0.35)'}`,
                borderRadius: '10px',
                boxShadow: enterable
                  ? `0 10px 34px rgba(0,0,0,0.65), 0 0 22px ${accent.glow}`
                  : '0 8px 26px rgba(0,0,0,0.6)',
                padding: '14px 14px 16px',
                animation: visible
                  ? `portal-rise 0.55s cubic-bezier(0.2,0.8,0.2,1) ${index * 0.09}s backwards`
                  : 'none',
                fontFamily: 'var(--font-minecraft), system-ui, sans-serif',
                cursor: enterable ? 'var(--mv-cursor-pickaxe)' : 'var(--mv-cursor-sword)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                  Round {roundId}
                </span>
                {completed ? (
                  <CheckCircle2 size={16} style={{ color: '#55dd77' }} />
                ) : enterable ? (
                  <Play size={15} style={{ color: accent.border }} />
                ) : (
                  <Lock size={15} style={{ color: 'rgba(255,255,255,0.35)' }} />
                )}
              </div>

              <div style={{
                color: '#fff',
                fontSize: 'clamp(12px, 1.05vw, 15px)',
                lineHeight: 1.25,
                textShadow: '1px 1px 0 rgba(0,0,0,0.9)',
                marginBottom: '6px',
                minHeight: '2.4em',
              }}>
                {round?.name ?? `Round ${roundId}`}
              </div>

              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '9px', letterSpacing: '0.5px', marginBottom: '10px' }}>
                {round?.time_allotted ? `${round.time_allotted} min` : '—'}
                {round?.day ? ` • Day ${round.day}` : ''}
              </div>

              <button
                type="button"
                disabled={!enterable}
                onClick={(event) => {
                  event.stopPropagation();
                  if (enterable) enter(roundId);
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: '11px',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  fontFamily: 'inherit',
                  color: enterable ? '#fff' : 'rgba(255,255,255,0.4)',
                  background: enterable
                    ? 'linear-gradient(135deg, rgba(26,26,46,0.95), rgba(22,33,62,0.95))'
                    : 'rgba(40,44,54,0.7)',
                  border: `2px solid ${enterable ? accent.border : 'rgba(120,130,150,0.3)'}`,
                  borderRadius: '6px',
                  cursor: enterable ? 'var(--mv-cursor-hand-closed)' : 'not-allowed',
                  boxShadow: enterable ? `0 0 12px ${accent.glow}` : 'none',
                }}
              >
                {completed ? 'Replay' : enterable ? 'Enter' : 'Locked'}
              </button>

              {round?.unlocked_by_dev_mode && (
                <div style={{
                  marginTop: '7px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  color: 'rgba(255,190,60,0.95)',
                  fontSize: '8px',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                }}>
                  <Wrench size={9} /> dev unlock
                </div>
              )}
            </div>
          );
        })}
      </div>

      {devUnlock && visible && (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 60,
          background: 'rgba(255,170,0,0.14)',
          border: '1px solid rgba(255,190,60,0.6)',
          color: 'rgba(255,205,110,0.98)',
          padding: '5px 14px',
          borderRadius: '999px',
          fontSize: '10px',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          fontFamily: 'var(--font-minecraft), system-ui, sans-serif',
          pointerEvents: 'none',
        }}>
          Dev mode — all rounds unlocked
        </div>
      )}
    </>
  );
}
