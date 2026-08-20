'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, Terminal } from 'lucide-react';
import { IronGolemGraphic } from './IronGolemGraphic';

interface GatekeeperTerminalProps {
  step: number;
  eyeState?: 'neutral' | 'glowing' | 'angry';
  promptLoreText: string;
}

export function GatekeeperTerminal({ step, eyeState = 'neutral', promptLoreText }: GatekeeperTerminalProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [typingIndex, setTypingIndex] = useState(0);

  // Typewriter effect for Golem Lore Console
  useEffect(() => {
    setDisplayedText('');
    setTypingIndex(0);
  }, [promptLoreText]);

  useEffect(() => {
    if (typingIndex < promptLoreText.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + promptLoreText[typingIndex]);
        setTypingIndex((prev) => prev + 1);
      }, 18);
      return () => clearTimeout(timeout);
    }
  }, [typingIndex, promptLoreText]);

  return (
    <div className="bg-stone-900/90 border-2 border-stone-800 rounded-2xl p-5 shadow-2xl flex flex-col justify-between h-full backdrop-blur relative overflow-hidden select-none">
      {/* Top Banner Accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-600 via-amber-500 to-emerald-600" />

      <div>
        {/* HEADER BADGE */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="font-mono text-xs uppercase tracking-widest text-emerald-400 font-extrabold">
              THE GATEKEEPER
            </span>
          </div>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-stone-950 border border-stone-800 text-amber-400 font-bold">
            TRIAL {step}/3
          </span>
        </div>

        {/* IRON GOLEM HOLOGRAM DISPLAY */}
        <div className="relative bg-stone-950/80 rounded-xl border border-stone-800 p-4 mb-4 flex flex-col items-center justify-center overflow-hidden shadow-inner group">
          {/* Subtle Grid Lines */}
          <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:12px_12px] opacity-20 pointer-events-none" />

          {/* Eye State Indicator Badge */}
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-stone-900/90 border border-stone-800 px-2 py-0.5 rounded text-[10px] font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                eyeState === 'angry'
                  ? 'bg-red-500 animate-ping'
                  : eyeState === 'glowing'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-emerald-400'
              }`}
            />
            <span className="text-zinc-300 font-bold uppercase">{eyeState}</span>
          </div>

          <IronGolemGraphic size={150} eyeState={eyeState} />

          <div className="mt-2 text-center">
            <h3 className="font-mono text-xs uppercase tracking-wider text-amber-300 font-bold">
              ANCIENT IRON GOLEM
            </h3>
            <p className="font-mono text-[10px] text-zinc-500">Guardian of Forest Gate #0</p>
          </div>
        </div>
      </div>

      {/* TYPEWRITER LORE CONSOLE */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 font-mono text-xs text-zinc-300 leading-relaxed shadow-inner relative flex-1 flex flex-col">
        <div className="flex items-center gap-1.5 text-emerald-500 font-bold text-[10px] uppercase tracking-widest mb-2 pb-1.5 border-b border-stone-900">
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span>Golem Lore Console</span>
        </div>

        <div className="flex-1 text-zinc-300 text-xs leading-relaxed font-mono whitespace-pre-wrap">
          {displayedText}
          {typingIndex < promptLoreText.length && (
            <span className="inline-block w-2 h-3 bg-amber-400 ml-1 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}
