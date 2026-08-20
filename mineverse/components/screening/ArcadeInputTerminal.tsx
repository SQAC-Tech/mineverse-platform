'use client';

import React from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Terminal } from 'lucide-react';

interface ArcadeInputTerminalProps {
  inputVal: string;
  setInputVal: (val: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  loading: boolean;
  errorMsg: string | null;
  successMsg: string | null;
  placeholderText: string;
}

export function ArcadeInputTerminal({
  inputVal,
  setInputVal,
  onSubmit,
  loading,
  errorMsg,
  successMsg,
  placeholderText,
}: ArcadeInputTerminalProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-3 font-mono select-none">
      <div className="bg-stone-950 border-2 border-stone-800 rounded-xl p-3.5 shadow-inner">
        <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
          <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] font-bold text-amber-400">
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            ARCADE INPUT TERMINAL
          </span>
          <span className="text-[10px] text-zinc-500 font-sans">Press [Enter] to submit</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1 flex items-center">
            <span className="absolute left-3 text-amber-500 font-bold text-lg select-none">&gt;</span>
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={placeholderText}
              disabled={loading}
              autoFocus
              className="w-full bg-stone-900 border border-stone-700 focus:border-amber-500 text-amber-300 font-mono text-base font-bold pl-8 pr-4 py-2.5 rounded-lg outline-none transition-all placeholder:text-stone-600 uppercase tracking-wide"
            />
          </div>

          <button
            type="submit"
            disabled={!inputVal.trim() || loading}
            className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 text-stone-950 font-mono font-extrabold px-5 py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(245,158,11,0.2)] cursor-pointer text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>VALIDATING...</span>
              </>
            ) : (
              <>
                <span>SUBMIT</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* ERROR MESSAGE ALERT */}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-950/90 border border-red-700 text-red-200 font-mono text-xs flex items-center gap-2.5 shadow-lg animate-shake">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* SUCCESS MESSAGE ALERT */}
      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/90 border border-emerald-600 text-emerald-200 font-mono text-xs flex items-center gap-2.5 shadow-lg animate-pulse">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
    </form>
  );
}
