'use client';

import React from 'react';

export function NetherPortalGraphic() {
  return (
    <div className="relative w-64 h-80 mx-auto my-6 rounded-lg border-8 border-stone-900 bg-stone-950 p-2 shadow-[0_0_50px_rgba(168,85,247,0.5)] overflow-hidden">
      {/* Obsidian Frame Blocks */}
      <div className="absolute inset-0 border-[16px] border-zinc-900 pointer-events-none z-10 opacity-90" />

      {/* Portal Interior Swirling Effect */}
      <div className="relative w-full h-full rounded overflow-hidden bg-gradient-to-b from-purple-950 via-fuchsia-900 to-indigo-950">
        {/* Animated Particles & Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(217,70,239,0.8)_0%,transparent_70%)] animate-pulse" />
        
        {/* Portal Swirl Lines */}
        <div className="absolute inset-0 opacity-40 mix-blend-screen bg-[radial-gradient(#c084fc_2px,transparent_2px)] [background-size:12px_12px] animate-[spin_12s_linear_infinite]" />

        {/* Center Portal Vortex */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-32 h-48 rounded-full bg-fuchsia-600/30 blur-xl animate-ping" />
          <div className="w-24 h-36 rounded-full bg-purple-500/40 blur-md" />
        </div>

        {/* Floating Nether Portal Particle Swirls */}
        <div className="absolute bottom-4 left-6 w-3 h-3 bg-fuchsia-300 rounded-full blur-[1px] animate-bounce" style={{ animationDuration: '2.4s' }} />
        <div className="absolute top-10 right-8 w-4 h-4 bg-purple-300 rounded-full blur-[1px] animate-bounce" style={{ animationDuration: '3.1s' }} />
        <div className="absolute bottom-16 right-10 w-2 h-2 bg-indigo-300 rounded-full blur-[1px] animate-bounce" style={{ animationDuration: '1.8s' }} />
      </div>

      {/* Frame Corners Details */}
      <div className="absolute top-0 left-0 w-8 h-8 bg-zinc-950 border-r border-b border-zinc-800 z-20" />
      <div className="absolute top-0 right-0 w-8 h-8 bg-zinc-950 border-l border-b border-zinc-800 z-20" />
      <div className="absolute bottom-0 left-0 w-8 h-8 bg-zinc-950 border-r border-t border-zinc-800 z-20" />
      <div className="absolute bottom-0 right-0 w-8 h-8 bg-zinc-950 border-l border-t border-zinc-800 z-20" />
    </div>
  );
}
