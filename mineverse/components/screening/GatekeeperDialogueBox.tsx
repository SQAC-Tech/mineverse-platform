'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, Terminal } from 'lucide-react';

interface GatekeeperDialogueBoxProps {
  step: number;
  eyeState?: 'neutral' | 'glowing' | 'angry';
  customMessage?: string | null;
  isVisible?: boolean;
  onSpeechComplete?: () => void;
}

const DEFAULT_GREETING = "Welcome to the world of Mineverse. To enter through the gate, your team must solve three trials.";

export function GatekeeperDialogueBox({
  step,
  eyeState = 'neutral',
  customMessage = null,
  isVisible = true,
  onSpeechComplete,
}: GatekeeperDialogueBoxProps) {
  const activeMessage = customMessage || DEFAULT_GREETING;
  const [displayedText, setDisplayedText] = useState('');
  const [typingIndex, setTypingIndex] = useState(0);

  useEffect(() => {
    setDisplayedText('');
    setTypingIndex(0);
  }, [activeMessage]);

  useEffect(() => {
    if (typingIndex < activeMessage.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + activeMessage[typingIndex]);
        setTypingIndex((prev) => prev + 1);
      }, 18);
      return () => clearTimeout(timeout);
    } else if (typingIndex === activeMessage.length && onSpeechComplete) {
      onSpeechComplete();
    }
  }, [typingIndex, activeMessage, onSpeechComplete]);

  return (
    <div
      className={`bg-stone-900/95 border-2 border-stone-800 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur relative overflow-hidden select-none transition-all duration-500 ${
        isVisible ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
      }`}
    >
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-600 via-amber-500 to-emerald-600" />

      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-stone-800 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
          <span className="font-mono text-xs uppercase tracking-widest text-emerald-400 font-extrabold">
            THE GATEKEEPER SPEAKS
          </span>
        </div>
        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-stone-950 border border-stone-800 text-amber-400 font-bold">
          TRIAL {step}/3
        </span>
      </div>

      {/* DIALOGUE BOX */}
      <div className="bg-stone-950/90 border border-stone-800 rounded-xl p-4 font-mono text-xs text-zinc-200 leading-relaxed shadow-inner flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[10px] uppercase tracking-widest pb-1 border-b border-stone-900">
          <Terminal className="w-3.5 h-3.5 text-amber-400" />
          <span>Golem Verdict & Message Log</span>
        </div>

        <p className="text-amber-300 font-semibold text-xs sm:text-sm italic leading-relaxed">
          "{displayedText}"
          {typingIndex < activeMessage.length && (
            <span className="inline-block w-2 h-3.5 bg-amber-400 ml-1 animate-pulse" />
          )}
        </p>
      </div>
    </div>
  );
}
