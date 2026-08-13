'use client';

import React from 'react';
import { EVENT_ROUNDS, ROUND_PROGRESSION, type EventRound } from '@/lib/event-rounds';

/**
 * Explains the game before the timeline shows the clock. The page used to jump
 * straight from the hero to a schedule, which tells a visitor when things
 * happen but never what they are.
 *
 * Styled as Minecraft GUI panels rather than generic cards: hard 4px bevels
 * (light top-left, dark bottom-right), no rounded corners, no soft shadows, and
 * the boss/unlock lines sit in pressed-in inventory slots. Stone rather than
 * wood, so the cards read as a different surface from the wooden sign boards
 * the timeline and contact sections already use.
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
  { icon: '👥', label: 'TEAM SIZE', value: '2 or 3 members' },
  { icon: '🎓', label: 'ELIGIBILITY', value: '1st & 2nd years' },
  { icon: '🗓️', label: 'FORMAT', value: '2 days · 5 rounds' },
];

const mc = { fontFamily: 'var(--font-minecraft)' } as const;

function Slot({ glyph, label, value, tint }: { glyph: string; label: string; value: string; tint: string }) {
  return (
    <div className="flex items-center gap-2.5">
      {/* Inventory slot holding the icon */}
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center text-sm"
        style={{ background: STONE.slot, ...inset(STONE.slotLight, STONE.slotDark), color: tint }}
      >
        {glyph}
      </div>
      <div className="min-w-0">
        <div className="text-[7px] tracking-[0.2em] text-[#7d7d7d]" style={mc}>{label}</div>
        <div className="truncate text-[13px] text-[#e0e0e0]">{value}</div>
      </div>
    </div>
  );
}

function RoundCard({ round }: { round: EventRound }) {
  const biome = BIOME[round.biome];

  return (
    <article
      className="mv-round flex flex-col"
      style={{
        background: STONE.face,
        ...bevel(STONE.light, STONE.dark),
        boxShadow: '6px 6px 0 rgba(0,0,0,0.55)',
        imageRendering: 'pixelated',
      }}
    >
      {/* Biome band — the colour is what makes the progression legible at a glance */}
      <div
        className="flex items-center gap-3 px-3.5 py-3"
        style={{
          background: biome.bg,
          borderBottom: `4px solid ${biome.dark}`,
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.045) 0 4px, transparent 4px 8px)',
        }}
      >
        <span className="shrink-0 text-2xl leading-none drop-shadow-[2px_2px_0_rgba(0,0,0,0.6)]">
          {round.icon}
        </span>
        <div className="min-w-0">
          <div className="text-[8px] tracking-[0.18em]" style={{ ...mc, color: biome.accent }}>
            {round.label} · {round.day}
          </div>
          <div className="truncate text-[15px] font-bold text-white drop-shadow-[2px_2px_0_rgba(0,0,0,0.85)]">
            {round.name}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3.5 p-3.5">
        <p className="text-[13px] leading-relaxed text-[#c2c2c2]">{round.desc}</p>

        <div className="mt-auto flex flex-col gap-2">
          <Slot glyph="⚔" label="BOSS" value={round.boss} tint="#ff7b6b" />
          <Slot glyph="✦" label="UNLOCKS" value={round.unlock} tint="#7ee05a" />
        </div>
      </div>
    </article>
  );
}

export const HowItWorks = () => {
  return (
    <section className="relative z-20 px-4 py-16 md:px-8 text-white">
      {/* Hover lift, keyboard-safe and disabled for reduced-motion users. */}
      <style>{`
        .mv-round { transition: transform 0.12s steps(2), box-shadow 0.12s steps(2), filter 0.12s; }
        @media (hover: hover) {
          .mv-round:hover {
            transform: translate(-2px, -2px);
            box-shadow: 8px 8px 0 rgba(0,0,0,0.6);
            filter: brightness(1.08);
          }
        }
        @media (prefers-reduced-motion: reduce) { .mv-round { transition: none; } }
      `}</style>

      <div className="mx-auto w-full max-w-5xl">
        <h2
          className="mb-8 text-center text-3xl tracking-widest text-[#fca311] drop-shadow-[4px_4px_0_rgba(0,0,0,1)] md:text-4xl"
          style={mc}
        >
          HOW IT WORKS
        </h2>

        <p className="mx-auto max-w-3xl text-center text-base leading-relaxed text-[#d5d5d5] drop-shadow-[1px_1px_0_#000] md:text-lg">
          MINEVERSE is a two-day coding competition played like a Minecraft run. You enter as a team
          of two or three and start with nothing. Every problem you solve{' '}
          <strong className="text-[#7ee05a]">mines resources</strong>; resources let you{' '}
          <strong className="text-[#fca311]">craft better gear</strong>, trade at the marketplace and{' '}
          <strong className="text-[#8ec5f0]">build structures</strong> that protect your score. Each
          round has a guardian to beat and a biome to survive, and whatever you carry out of one
          round is what you take into the next.
        </p>

        <p className="mx-auto mt-4 max-w-3xl text-center text-sm leading-relaxed text-[#9a9a9a] drop-shadow-[1px_1px_0_#000]">
          Day 1 is three rounds and a qualifier. Survive the leaderboard and you come back for
          Day 2 — the Nether, and finally the End.
        </p>

        {/* Quick facts, as small GUI panels */}
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {FACTS.map((fact) => (
            <div
              key={fact.label}
              className="flex items-center gap-3 px-4 py-2.5"
              style={{
                background: STONE.face,
                ...bevel(STONE.light, STONE.dark, 3),
                boxShadow: '4px 4px 0 rgba(0,0,0,0.5)',
              }}
            >
              <span className="text-lg leading-none">{fact.icon}</span>
              <div>
                <div className="text-[7px] tracking-[0.2em] text-[#fca311]" style={mc}>
                  {fact.label}
                </div>
                <div className="text-[13px] text-[#e5e5e5]">{fact.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Biome progression */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
          {ROUND_PROGRESSION.map((name, i) => (
            <React.Fragment key={name}>
              <span
                className="px-3 py-2 text-[9px] tracking-[0.15em] whitespace-nowrap"
                style={{
                  ...mc,
                  background: BIOME[name].bg,
                  color: BIOME[name].accent,
                  ...bevel(BIOME[name].light, BIOME[name].dark, 3),
                  boxShadow: '3px 3px 0 rgba(0,0,0,0.5)',
                }}
              >
                {name.toUpperCase()}
              </span>
              {i < ROUND_PROGRESSION.length - 1 && (
                <span className="text-sm text-[#6b5a44]">▸</span>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Round cards */}
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {EVENT_ROUNDS.map((round) => (
            <RoundCard key={round.label} round={round} />
          ))}
        </div>
      </div>
    </section>
  );
};
