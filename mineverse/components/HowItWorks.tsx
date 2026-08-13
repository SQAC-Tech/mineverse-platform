'use client';

import React from 'react';
import { EVENT_ROUNDS, ROUND_PROGRESSION, type EventRound } from '@/lib/event-rounds';

/**
 * Explains the game before the timeline shows the clock. The page used to jump
 * straight from the hero to a schedule, which tells a visitor when things
 * happen but never what they are.
 *
 * Styled as Minecraft GUI panels: hard 4px bevels (light top-left, dark
 * bottom-right), square corners, solid offset shadows, and boss/unlock lines in
 * pressed-in inventory slots. Stone rather than wood, so the cards read as a
 * different surface from the wooden sign boards the timeline and contact
 * sections already use.
 *
 * The rounds sit in one vertically scrolling column rather than a grid — the
 * order is the whole point, and a snapping column reads as a sequence in a way
 * a wrapped grid does not.
 */

/** Classic Minecraft GUI edge: lit from the top-left, shadowed bottom-right. */
function bevel(light: string, dark: string, width = 4): React.CSSProperties {
  return {
    borderTop: `${width}px solid ${light}`,
    borderLeft: `${width}px solid ${light}`,
    borderBottom: `${width}px solid ${dark}`,
    borderRight: `${width}px solid ${dark}`,
  };
}

/** Inverted bevel — reads as carved into the panel, like an inventory slot. */
function inset(light: string, dark: string, width = 3): React.CSSProperties {
  return {
    borderTop: `${width}px solid ${dark}`,
    borderLeft: `${width}px solid ${dark}`,
    borderBottom: `${width}px solid ${light}`,
    borderRight: `${width}px solid ${light}`,
  };
}

const STONE = {
  face: '#3b3b3b',
  light: '#6e6e6e',
  dark: '#161616',
  slot: '#232323',
  slotLight: '#4c4c4c',
  slotDark: '#0d0d0d',
};

/** `light` is the lit top-left edge — without it a bevel disappears into the face. */
const BIOME: Record<EventRound['biome'], { bg: string; light: string; dark: string; accent: string }> = {
  Forest:   { bg: '#1f4d12', light: '#357d20', dark: '#0e2b06', accent: '#7ee05a' },
  Cave:     { bg: '#3a3a3a', light: '#5e5e5e', dark: '#1c1c1c', accent: '#c9c9c9' },
  Mountain: { bg: '#22384f', light: '#3a5c7d', dark: '#101d2a', accent: '#8ec5f0' },
  Nether:   { bg: '#4a1414', light: '#7d2323', dark: '#280808', accent: '#ff7b6b' },
  End:      { bg: '#241238', light: '#432464', dark: '#130820', accent: '#cf9bff' },
};

const FACTS = [
  { icon: '👥', label: 'TEAM SIZE', value: '2 OR 3' },
  { icon: '🎓', label: 'ELIGIBILITY', value: '1ST & 2ND YR' },
  { icon: '🗓️', label: 'FORMAT', value: '2 DAYS · 5 ROUNDS' },
];

/**
 * Press Start 2P is wide and has no lowercase rhythm to lean on, so every size
 * here is paired with a line-height near 2 — the usual 1.5 makes pixel type
 * clot together.
 */
const mc = { fontFamily: 'var(--font-minecraft)' } as const;

function Slot({ glyph, label, value, tint }: { glyph: string; label: string; value: string; tint: string }) {
  return (
    <div className="mv-slot flex items-center gap-3">
      <div
        className="mv-slot-box flex h-11 w-11 shrink-0 items-center justify-center text-lg"
        style={{ background: STONE.slot, ...inset(STONE.slotLight, STONE.slotDark), color: tint }}
      >
        {glyph}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] leading-[1.8] tracking-[0.16em] text-[#8a8a8a]" style={mc}>
          {label}
        </div>
        <div className="text-[11px] leading-[1.7] text-[#eaeaea]" style={mc}>
          {value}
        </div>
      </div>
    </div>
  );
}

function RoundCard({ round }: { round: EventRound }) {
  const biome = BIOME[round.biome];

  return (
    <article
      className="mv-round flex w-full snap-start flex-col"
      style={{
        background: STONE.face,
        ...bevel(STONE.light, STONE.dark, 5),
        boxShadow: '8px 8px 0 rgba(0,0,0,0.55)',
        imageRendering: 'pixelated',
      }}
    >
      {/* Biome band — the colour is what makes the progression legible at a glance */}
      <div
        className="mv-band flex items-center gap-4 px-5 py-5"
        style={{
          background: biome.bg,
          borderBottom: `5px solid ${biome.dark}`,
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 5px, transparent 5px 10px)',
        }}
      >
        <span className="mv-icon shrink-0 text-[2.4rem] leading-none drop-shadow-[3px_3px_0_rgba(0,0,0,0.65)]">
          {round.icon}
        </span>
        <div className="min-w-0">
          <div
            className="text-[10px] leading-[1.9] tracking-[0.16em]"
            style={{ ...mc, color: biome.accent }}
          >
            {round.label}
          </div>
          <div
            className="text-[9px] leading-[1.9] tracking-[0.16em] text-white/55"
            style={mc}
          >
            {round.day}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5 p-5">
        <h3
          className="text-[15px] leading-[1.7] text-white drop-shadow-[2px_2px_0_rgba(0,0,0,0.9)]"
          style={mc}
        >
          {round.name}
        </h3>

        <p className="text-[11px] leading-[2] text-[#bdbdbd]" style={mc}>
          {round.desc}
        </p>

        <div className="mt-auto flex flex-col gap-3 pt-1">
          <Slot glyph="⚔" label="BOSS" value={round.boss} tint="#ff7b6b" />
          <Slot glyph="✦" label="UNLOCKS" value={round.unlock} tint="#7ee05a" />
        </div>
      </div>
    </article>
  );
}

export const HowItWorks = () => {
  return (
    <section className="relative z-20 py-16 text-white">
      <style>{`
        /* Blocky, stepped motion rather than smooth easing. */
        .mv-round {
          transition: transform 0.12s steps(3), box-shadow 0.12s steps(3), filter 0.12s;
        }
        .mv-icon { transition: transform 0.15s steps(3); display: inline-block; }
        .mv-band { transition: filter 0.15s; }
        .mv-slot-box { transition: transform 0.15s steps(2), box-shadow 0.15s; }

        @media (hover: hover) {
          .mv-round:hover {
            transform: translate(-4px, -6px);
            box-shadow: 12px 14px 0 rgba(0,0,0,0.6);
            filter: brightness(1.1);
          }
          .mv-round:hover .mv-icon { transform: translateY(-4px) scale(1.15); }
          .mv-round:hover .mv-band { filter: brightness(1.18) saturate(1.15); }
          .mv-round:hover .mv-slot-box { transform: translateX(3px); }
        }

        /* Minecraft-style chunky scrollbar on the column. */
        .mv-scroll { scrollbar-color: #6e6e6e #1c1c1c; scrollbar-width: auto; }
        .mv-scroll::-webkit-scrollbar { width: 16px; }
        .mv-scroll::-webkit-scrollbar-track {
          background: #1c1c1c;
          border-left: 3px solid #0d0d0d;
          border-right: 3px solid #3a3a3a;
        }
        .mv-scroll::-webkit-scrollbar-thumb {
          background: #6e6e6e;
          border-top: 3px solid #9a9a9a;
          border-left: 3px solid #9a9a9a;
          border-bottom: 3px solid #2a2a2a;
          border-right: 3px solid #2a2a2a;
        }
        .mv-scroll::-webkit-scrollbar-thumb:hover { background: #838383; }

        @media (prefers-reduced-motion: reduce) {
          .mv-round, .mv-icon, .mv-band, .mv-slot-box { transition: none; }
          .mv-scroll { scroll-behavior: auto; }
        }
      `}</style>

      <div className="mx-auto w-full max-w-5xl px-4 md:px-8">
        <h2
          className="mb-10 text-center text-3xl tracking-widest text-[#fca311] drop-shadow-[4px_4px_0_rgba(0,0,0,1)] md:text-4xl"
          style={mc}
        >
          HOW IT WORKS
        </h2>

        <p
          className="mx-auto max-w-3xl text-center text-[12px] leading-[2.1] text-[#d5d5d5] drop-shadow-[2px_2px_0_#000] md:text-[13px]"
          style={mc}
        >
          MINEVERSE IS A TWO-DAY CODING COMPETITION PLAYED LIKE A MINECRAFT RUN. YOU ENTER AS A TEAM
          OF <span className="text-[#fca311]">TWO OR THREE</span> AND START WITH NOTHING. EVERY
          PROBLEM YOU SOLVE <span className="text-[#7ee05a]">MINES RESOURCES</span>; RESOURCES LET
          YOU <span className="text-[#fca311]">CRAFT BETTER GEAR</span>, TRADE AT THE MARKETPLACE AND{' '}
          <span className="text-[#8ec5f0]">BUILD STRUCTURES</span> THAT PROTECT YOUR SCORE.
        </p>

        <p
          className="mx-auto mt-6 max-w-3xl text-center text-[10px] leading-[2.1] text-[#9a9a9a] drop-shadow-[2px_2px_0_#000] md:text-[11px]"
          style={mc}
        >
          EACH ROUND HAS A GUARDIAN TO BEAT AND A BIOME TO SURVIVE. DAY 1 IS THREE ROUNDS AND A
          QUALIFIER — SURVIVE THE LEADERBOARD AND YOU RETURN FOR DAY 2, THE NETHER, AND FINALLY THE
          END.
        </p>

        {/* Quick facts, as small GUI panels */}
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          {FACTS.map((fact) => (
            <div
              key={fact.label}
              className="flex items-center gap-3 px-5 py-3.5"
              style={{
                background: STONE.face,
                ...bevel(STONE.light, STONE.dark, 4),
                boxShadow: '5px 5px 0 rgba(0,0,0,0.5)',
              }}
            >
              <span className="text-2xl leading-none">{fact.icon}</span>
              <div>
                <div className="text-[8px] leading-[1.9] tracking-[0.18em] text-[#fca311]" style={mc}>
                  {fact.label}
                </div>
                <div className="text-[11px] leading-[1.8] text-[#e5e5e5]" style={mc}>
                  {fact.value}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Biome progression */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2.5">
          {ROUND_PROGRESSION.map((name, i) => (
            <React.Fragment key={name}>
              <span
                className="px-4 py-2.5 text-[10px] leading-none tracking-[0.14em] whitespace-nowrap"
                style={{
                  ...mc,
                  background: BIOME[name].bg,
                  color: BIOME[name].accent,
                  ...bevel(BIOME[name].light, BIOME[name].dark, 3),
                  boxShadow: '4px 4px 0 rgba(0,0,0,0.5)',
                }}
              >
                {name.toUpperCase()}
              </span>
              {i < ROUND_PROGRESSION.length - 1 && (
                <span className="text-base text-[#6b5a44]">▸</span>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Scroll hint */}
        <p
          className="mt-12 text-center text-[9px] leading-none tracking-[0.2em] text-[#7d7d7d]"
          style={mc}
        >
          ▲ SCROLL THROUGH THE ROUNDS ▼
        </p>

        {/*
          A capped, snapping column. Holding the rounds in their own scroll area
          keeps the section a fixed height on the page instead of adding six
          full-width cards to the page scroll, and the cut-off card at the
          bottom edge is what signals there is more below.
        */}
        <div
          className="mv-scroll mt-5 flex snap-y snap-mandatory flex-col gap-6 overflow-y-auto scroll-smooth pr-3"
          style={{ maxHeight: 'min(720px, 80vh)', scrollPaddingTop: '0.25rem' }}
          role="region"
          aria-label="Round-by-round breakdown"
          tabIndex={0}
        >
          {EVENT_ROUNDS.map((round) => (
            <RoundCard key={round.label} round={round} />
          ))}
        </div>
      </div>
    </section>
  );
};
