'use client';

import React from 'react';

interface IronGolemGraphicProps {
  size?: number;
  className?: string;
  eyeState?: 'neutral' | 'glowing' | 'angry';
}

export function IronGolemGraphic({ size = 180, className = '', eyeState = 'neutral' }: IronGolemGraphicProps) {
  const eyeColor =
    eyeState === 'angry'
      ? '#EF4444' // Red
      : eyeState === 'glowing'
      ? '#F59E0B' // Amber / Gold
      : '#10B981'; // Emerald / Cyan

  const backdropGlow =
    eyeState === 'angry'
      ? 'rgba(239, 68, 68, 0.25)'
      : eyeState === 'glowing'
      ? 'rgba(245, 158, 11, 0.25)'
      : 'rgba(16, 185, 129, 0.12)';

  return (
    <div
      className={`relative inline-block select-none ${
        eyeState === 'angry' ? 'animate-bounce' : ''
      } ${className}`}
      style={{ width: size, height: size * 1.1 }}
    >
      <svg
        viewBox="0 0 100 110"
        className={`w-full h-full filter transition-all duration-300 ${
          eyeState === 'angry'
            ? 'drop-shadow-[0_0_25px_rgba(239,68,68,0.8)] scale-105'
            : eyeState === 'glowing'
            ? 'drop-shadow-[0_0_20px_rgba(245,158,11,0.6)]'
            : 'drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]'
        }`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Glow backdrop */}
        <ellipse cx="50" cy="55" rx="42" ry="48" fill={backdropGlow} />

        {/* Head */}
        <rect x="36" y="10" width="28" height="22" fill="#D4D4D8" rx="1" />
        <rect x="38" y="12" width="24" height="18" fill="#E4E4E7" />
        {/* Brow line */}
        <rect x="36" y="10" width="28" height="4" fill="#A1A1AA" />

        {/* Eyes (Dynamic Glow & Color) */}
        <g className={eyeState === 'glowing' ? 'animate-pulse' : ''}>
          <rect x="42" y="18" width="5" height="3" fill={eyeColor} />
          <rect x="53" y="18" width="5" height="3" fill={eyeColor} />
          {/* Eye Pupils */}
          <rect x="44" y="19" width="2" height="2" fill="#FFFFFF" />
          <rect x="55" y="19" width="2" height="2" fill="#FFFFFF" />
        </g>

        {/* Nose */}
        <rect x="47" y="19" width="6" height="9" fill="#B45309" />

        {/* Vines / Moss on Body */}
        <rect x="44" y="27" width="3" height="4" fill="#15803D" />

        {/* Neck */}
        <rect x="44" y="32" width="12" height="4" fill="#A1A1AA" />

        {/* Shoulders / Torso */}
        <rect x="22" y="36" width="56" height="34" fill="#E4E4E7" rx="2" />
        <rect x="24" y="38" width="52" height="30" fill="#D4D4D8" />
        {/* Armor highlights & cracks */}
        <rect x="30" y="42" width="40" height="4" fill="#F4F4F5" />
        <rect x="26" y="48" width="48" height="2" fill="#71717A" />
        <path d="M40 52 L42 62 L48 64" stroke="#52525B" strokeWidth="1.5" fill="none" />
        {/* Vines on chest */}
        <rect x="28" y="44" width="6" height="12" fill="#16A34A" />
        <rect x="32" y="52" width="4" height="10" fill="#15803D" />
        <rect x="62" y="40" width="8" height="8" fill="#16A34A" />

        {/* Poppy flower in hand / chest emblem */}
        <rect x="66" y="58" width="6" height="6" fill="#DC2626" />
        <rect x="68" y="60" width="2" height="2" fill="#FDE047" />

        {/* Massive Arms */}
        {/* Left Arm */}
        <rect x="10" y="36" width="12" height="48" fill="#D4D4D8" rx="2" />
        <rect x="12" y="38" width="8" height="44" fill="#A1A1AA" />
        <rect x="10" y="80" width="12" height="8" fill="#71717A" />
        <rect x="14" y="42" width="4" height="16" fill="#16A34A" />

        {/* Right Arm */}
        <rect x="78" y="36" width="12" height="48" fill="#D4D4D8" rx="2" />
        <rect x="80" y="38" width="8" height="44" fill="#A1A1AA" />
        <rect x="78" y="80" width="12" height="8" fill="#71717A" />
        <rect x="80" y="56" width="6" height="14" fill="#15803D" />

        {/* Waist & Hips */}
        <rect x="32" y="70" width="36" height="8" fill="#71717A" />

        {/* Legs */}
        <rect x="34" y="78" width="14" height="26" fill="#A1A1AA" />
        <rect x="36" y="80" width="10" height="22" fill="#71717A" />
        <rect x="34" y="100" width="14" height="6" fill="#52525B" />

        <rect x="52" y="78" width="14" height="26" fill="#A1A1AA" />
        <rect x="54" y="80" width="10" height="22" fill="#71717A" />
        <rect x="52" y="100" width="14" height="6" fill="#52525B" />
      </svg>
    </div>
  );
}
