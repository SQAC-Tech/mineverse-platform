'use client';

import React from 'react';
import { Timer } from 'lucide-react';

interface GauntletTopBarProps {
  remainingSeconds: number;
}

function formatTime(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const m = String(Math.floor(safe / 60)).padStart(2, '0');
  const s = String(safe % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function GauntletTopBar({ remainingSeconds }: GauntletTopBarProps) {
  return (
    <header className="sticky top-0 z-50 bg-stone-950/80 border-b border-stone-800/80 backdrop-blur px-4 py-2 shadow-xl select-none flex items-center justify-between">
      {/* LEFT TOP: MINEVERSE NAME */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded bg-red-950 border border-red-700 flex items-center justify-center font-mono font-black text-red-400 text-sm shadow-inner">
          M2
        </div>
        <h1 className="font-mono text-base uppercase tracking-widest font-black text-amber-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
          MINEVERSE 2.0
        </h1>
      </div>

      {/* RIGHT TOP: SERVER TIME (COUNTDOWN) */}
      <div className="flex items-center gap-2 bg-stone-900/90 border border-amber-900/60 px-3.5 py-1 rounded-lg shadow-inner">
        <Timer className={`w-4 h-4 ${remainingSeconds <= 300 ? 'text-red-500 animate-bounce' : 'text-amber-400'}`} />
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-400 font-mono font-bold uppercase">SERVER TIME</span>
          <span
            className={`font-mono text-base font-extrabold tracking-widest ${
              remainingSeconds <= 300 ? 'text-red-500' : 'text-amber-400'
            }`}
          >
            {formatTime(remainingSeconds)}
          </span>
        </div>
      </div>
    </header>
  );
}
