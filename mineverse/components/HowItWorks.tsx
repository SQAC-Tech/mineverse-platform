'use client';

import React from 'react';
import { EVENT_ROUNDS, ROUND_PROGRESSION, type EventRound } from '@/lib/event-rounds';

/**
 * Explains the game before the timeline shows the clock. The page used to jump
 * straight from the hero to a schedule, which tells a visitor when things
 * happen but never what they are.
 */

const BIOME_STYLES: Record<EventRound['biome'], { bar: string; chip: string; text: string }> = {
  Forest:   { bar: 'bg-[#1a3d0e] border-[#317822]', chip: 'bg-[#1a3d0e] border-[#317822]', text: 'text-[#5cbf3a]' },
  Cave:     { bar: 'bg-[#2a2a2a] border-[#555555]', chip: 'bg-[#2a2a2a] border-[#555555]', text: 'text-[#a0a0a0]' },
  Mountain: { bar: 'bg-[#1a2a3a] border-[#3a5a7a]', chip: 'bg-[#1a2a3a] border-[#3a5a7a]', text: 'text-[#7ab0e0]' },
  Nether:   { bar: 'bg-[#3a1111] border-[#8a2222]', chip: 'bg-[#3a1111] border-[#8a2222]', text: 'text-[#ff6b6b]' },
  End:      { bar: 'bg-[#1a0a2a] border-[#5a2a8a]', chip: 'bg-[#1a0a2a] border-[#5a2a8a]', text: 'text-[#c07dff]' },
};

const FACTS = [
  { icon: '👥', label: 'TEAM SIZE', value: '2 or 3 members' },
  { icon: '🎓', label: 'ELIGIBILITY', value: '1st & 2nd years' },
  { icon: '🗓️', label: 'FORMAT', value: '2 days · 5 rounds' },
];

function RoundCard({ round }: { round: EventRound }) {
  const style = BIOME_STYLES[round.biome];

  return (
    <div className="flex flex-col bg-[#1a150e]/95 border-4 border-[#0a0502] shadow-[inset_0_2px_0_#4a3a28,inset_0_-2px_0_#0a0502,0_8px_24px_rgba(0,0,0,0.7)]">
      {/* Biome-coloured header so the progression reads at a glance */}
      <div className={`flex items-center gap-3 border-b-4 px-4 py-3 ${style.bar}`}>
        <span className="text-2xl leading-none shrink-0">{round.icon}</span>
        <div className="min-w-0">
          <div
            className={`text-[9px] tracking-[0.18em] ${style.text}`}
            style={{ fontFamily: 'var(--font-minecraft)' }}
          >
            {round.label} · {round.day}
          </div>
          <div className="text-base font-bold text-white drop-shadow-[1px_1px_0_#000]">
            {round.name}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <p className="text-sm leading-relaxed text-[#c8c8c8]">{round.desc}</p>

        <div className="mt-auto flex flex-col gap-1.5 text-xs text-[#8f8f8f]">
          <div><span className="text-[#ff6b6b]">⚔ Boss</span>&nbsp;&nbsp;{round.boss}</div>
          <div><span className="text-[#4ade80]">✦ Unlocks</span>&nbsp;&nbsp;{round.unlock}</div>
        </div>
      </div>
    </div>
  );
}

export const HowItWorks = () => {
  return (
    <section className="relative z-20 px-4 py-16 md:px-8 text-white">
      <div className="mx-auto w-full max-w-5xl">
        <h2
          className="mb-8 text-center text-3xl tracking-widest text-[#fca311] drop-shadow-[4px_4px_0_rgba(0,0,0,1)] md:text-4xl"
          style={{ fontFamily: 'var(--font-minecraft)' }}
        >
          HOW IT WORKS
        </h2>

        <p className="mx-auto max-w-3xl text-center text-base leading-relaxed text-[#d5d5d5] drop-shadow-[1px_1px_0_#000] md:text-lg">
          MINEVERSE is a two-day coding competition played like a Minecraft run. You enter as a team
          of two or three and start with nothing. Every problem you solve{' '}
          <strong className="text-[#4ade80]">mines resources</strong>; resources let you{' '}
          <strong className="text-[#fca311]">craft better gear</strong>, trade at the marketplace and{' '}
          <strong className="text-[#7ab0e0]">build structures</strong> that protect your score. Each
          round has a guardian to beat and a biome to survive, and whatever you carry out of one
          round is what you take into the next.
        </p>

        <p className="mx-auto mt-4 max-w-3xl text-center text-sm leading-relaxed text-[#9a9a9a] drop-shadow-[1px_1px_0_#000]">
          Day 1 is three rounds and a qualifier. Survive the leaderboard and you come back for
          Day 2 — the Nether, and finally the End.
        </p>

        {/* Quick facts */}
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {FACTS.map((fact) => (
            <div
              key={fact.label}
              className="flex items-center gap-3 border-2 border-[#3c2512] bg-[#2a1f15]/90 px-4 py-3"
            >
              <span className="text-xl leading-none">{fact.icon}</span>
              <div>
                <div
                  className="text-[8px] tracking-[0.2em] text-[#fca311]"
                  style={{ fontFamily: 'var(--font-minecraft)' }}
                >
                  {fact.label}
                </div>
                <div className="text-sm text-[#e5e5e5]">{fact.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Biome progression */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
          {ROUND_PROGRESSION.map((biome, i) => (
            <React.Fragment key={biome}>
              <span
                className={`border-2 px-3 py-2 text-[9px] tracking-[0.15em] whitespace-nowrap ${BIOME_STYLES[biome].chip} ${BIOME_STYLES[biome].text}`}
                style={{ fontFamily: 'var(--font-minecraft)' }}
              >
                {biome.toUpperCase()}
              </span>
              {i < ROUND_PROGRESSION.length - 1 && (
                <span className="text-sm text-[#5a4a38]">▸</span>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Round cards */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EVENT_ROUNDS.map((round) => (
            <RoundCard key={round.label} round={round} />
          ))}
        </div>
      </div>
    </section>
  );
};
