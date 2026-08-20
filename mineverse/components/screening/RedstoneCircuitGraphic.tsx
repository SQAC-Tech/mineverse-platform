'use client';

import React, { useState } from 'react';
import { Zap } from 'lucide-react';

interface RedstoneCircuitGraphicProps {
  onSelectLever?: (color: string) => void;
}

export function RedstoneCircuitGraphic({ onSelectLever }: RedstoneCircuitGraphicProps) {
  // 3 Levers: Lever 20 starts ON (as target), Lever 25 (decoy) OFF, Lever 60 (decoy) OFF
  const [levers, setLevers] = useState<Record<number, boolean>>({
    20: true,
    25: false,
    60: false,
  });

  const toggleLever = (num: number) => {
    setLevers((prev) => {
      const nextState = { ...prev, [num]: !prev[num] };
      // Evaluate upgraded circuit logic
      const l20 = nextState[20];
      const l25 = nextState[25];
      const l60 = nextState[60];

      const gate1_OR = l20 || l60;
      const gate2_NOT = !l25;
      const bluePowered = gate1_OR && gate2_NOT;

      if (bluePowered && onSelectLever) {
        onSelectLever('BLUE');
      }
      return nextState;
    });
  };

  // Inputs
  const l20 = levers[20];
  const l25 = levers[25];
  const l60 = levers[60];

  // Upgraded Boolean Gates Evaluation
  const gate1_OR = l20 || l60;
  const gate2_NOT = !l25;
  const isBlueLampActive = gate1_OR && gate2_NOT;
  const isRedLampActive = l20 && l25;
  const isGreenLampActive = !gate1_OR;

  return (
    <div className="w-full mx-auto my-1.5 p-2 sm:p-3 rounded-lg border-2 border-[#5c371d] bg-[#140b05] shadow-2xl relative overflow-hidden select-none">
      {/* Background Redstone Dust Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#b91c1c_1px,transparent_1px)] [background-size:12px_12px] opacity-15 pointer-events-none" />

      {/* HEADER TITLE */}
      <div className="flex items-center justify-between border-b border-[#3d2313] pb-1 mb-2">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-red-500 animate-pulse" />
          <span className="font-mono text-[11px] tracking-widest text-amber-400 uppercase font-black">
            REDSTONE LOGIC MATRIX SCHEMATIC
          </span>
        </div>
        <div className="text-[10px] font-mono text-amber-200/80 bg-[#241308] px-2 py-0.5 rounded border border-[#4d2a15] flex items-center gap-1">
          <span>Target:</span>
          <span className="text-amber-400 font-bold">Lever #20 (ONLY)</span>
        </div>
      </div>

      {/* MAIN SVG SCHEMATIC (COMPACT & SCALED TO FIT 100VH) */}
      <div className="relative w-full max-h-[190px] sm:max-h-[220px] bg-[#1a0e06]/90 rounded border border-[#4a2b16] p-1 overflow-hidden shadow-inner">
        <svg viewBox="0 0 800 370" className="w-full h-full">
          <defs>
            {/* Redstone Wire Glow Filter */}
            <filter id="red-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Blue Lamp Glow Filter */}
            <filter id="blue-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* BACKGROUND BLOCK TERRAIN */}
          <rect x="10" y="10" width="780" height="350" fill="#1c1109" rx="6" stroke="#2e1a0e" strokeWidth="2" />

          {/* 3 CLICKABLE LEVER STATIONS (LEFT SIDE) */}
          {[
            { num: 20, y: 70, label: 'Lever #20 (Puzzle 1)', isTarget: true },
            { num: 25, y: 185, label: 'Lever #25 (Wood Decoy)', isTarget: false },
            { num: 60, y: 300, label: 'Lever #60 (Pickaxe Decoy)', isTarget: false },
          ].map((lever) => {
            const isOn = levers[lever.num];
            return (
              <g
                key={lever.num}
                onClick={() => toggleLever(lever.num)}
                className="cursor-pointer transition-all duration-200 group"
              >
                {/* Lever Base Block */}
                <rect
                  x="30"
                  y={lever.y - 22}
                  width="115"
                  height="44"
                  fill={isOn ? '#2e1a0e' : '#140c06'}
                  stroke={isOn ? (lever.isTarget ? '#ef4444' : '#f59e0b') : '#4d2c17'}
                  strokeWidth={isOn ? '2.5' : '1.5'}
                  rx="4"
                />
                {/* Switch Handle Toggle */}
                <line
                  x1="60"
                  y1={lever.y + 10}
                  x2={isOn ? '78' : '44'}
                  y2={lever.y - 14}
                  stroke={isOn ? '#ef4444' : '#854d27'}
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <circle cx={isOn ? '78' : '44'} cy={lever.y - 14} r="4.5" fill={isOn ? '#f87171' : '#b87333'} />
                {/* ON/OFF Indicator */}
                <circle cx="125" cy={lever.y} r="4" fill={isOn ? '#22c55e' : '#7f1d1d'} />
                {/* Text Label */}
                <text
                  x="88"
                  y={lever.y + 34}
                  textAnchor="middle"
                  fill={isOn ? '#fca5a5' : '#d4a373'}
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {lever.label} {isOn ? '[ON]' : '[OFF]'}
                </text>
              </g>
            );
          })}

          {/* WIRING PATHS & LOGIC GATES */}
          {/* 1. Lever 20 Line -> Gate 1 (OR Gate Input 1) & Gate 4 (AND Gate Input 1) */}
          <path
            d="M 145 70 L 260 70 L 260 100 L 290 100"
            stroke={l20 ? '#ef4444' : '#450a0a'}
            strokeWidth={l20 ? '4' : '2'}
            filter={l20 ? 'url(#red-glow)' : undefined}
            fill="none"
            className={l20 ? 'animate-pulse' : ''}
          />
          <path
            d="M 260 70 L 460 70 L 460 50 L 510 50"
            stroke={l20 ? '#ef4444' : '#450a0a'}
            strokeWidth={l20 ? '3' : '2'}
            filter={l20 ? 'url(#red-glow)' : undefined}
            fill="none"
          />

          {/* 2. Lever 60 Line -> Gate 1 (OR Gate Input 2) */}
          <path
            d="M 145 300 L 260 300 L 260 130 L 290 130"
            stroke={l60 ? '#ef4444' : '#450a0a'}
            strokeWidth={l60 ? '4' : '2'}
            filter={l60 ? 'url(#red-glow)' : undefined}
            fill="none"
          />

          {/* GATE 1: OR GATE BLOCK */}
          <g>
            <rect x="290" y="85" width="65" height="55" fill="#2a170b" stroke={gate1_OR ? '#ef4444' : '#5c371d'} strokeWidth="2" rx="4" />
            <text x="322.5" y="117" textAnchor="middle" fill="#f4f4f5" fontSize="12" fontWeight="bold" fontFamily="monospace">
              GATE 1: OR
            </text>
          </g>

          {/* Wire Gate 1 (OR) -> Gate 3 (AND Gate Input 1) & Gate 5 (NOT Gate Input) */}
          <path
            d="M 355 115 L 480 115 L 480 170 L 510 170"
            stroke={gate1_OR ? '#ef4444' : '#450a0a'}
            strokeWidth={gate1_OR ? '4' : '2'}
            filter={gate1_OR ? 'url(#red-glow)' : undefined}
            fill="none"
          />
          <path
            d="M 480 115 L 480 300 L 510 300"
            stroke={gate1_OR ? '#ef4444' : '#450a0a'}
            strokeWidth={gate1_OR ? '3' : '2'}
            filter={gate1_OR ? 'url(#red-glow)' : undefined}
            fill="none"
          />

          {/* 3. Lever 25 Line -> Gate 2 (NOT Gate Input) & Gate 4 (AND Gate Input 2) */}
          <path
            d="M 145 185 L 290 185"
            stroke={l25 ? '#ef4444' : '#450a0a'}
            strokeWidth={l25 ? '4' : '2'}
            filter={l25 ? 'url(#red-glow)' : undefined}
            fill="none"
          />
          <path
            d="M 220 185 L 220 30 L 510 30"
            stroke={l25 ? '#ef4444' : '#450a0a'}
            strokeWidth={l25 ? '3' : '2'}
            filter={l25 ? 'url(#red-glow)' : undefined}
            fill="none"
          />

          {/* GATE 2: NOT GATE BLOCK */}
          <g>
            <rect x="290" y="160" width="65" height="55" fill="#2a170b" stroke={gate2_NOT ? '#ef4444' : '#5c371d'} strokeWidth="2" rx="4" />
            <circle cx="322.5" cy="178" r="4.5" fill={gate2_NOT ? '#ef4444' : '#7f1d1d'} filter={gate2_NOT ? 'url(#red-glow)' : undefined} />
            <text x="322.5" y="200" textAnchor="middle" fill="#f4f4f5" fontSize="11" fontWeight="bold" fontFamily="monospace">
              GATE 2: NOT
            </text>
          </g>

          {/* Wire Gate 2 (NOT) -> Gate 3 (AND Gate Input 2) */}
          <path
            d="M 355 185 L 480 185 L 480 200 L 510 200"
            stroke={gate2_NOT ? '#ef4444' : '#450a0a'}
            strokeWidth={gate2_NOT ? '4' : '2'}
            filter={gate2_NOT ? 'url(#red-glow)' : undefined}
            fill="none"
          />

          {/* GATE 3: AND GATE BLOCK (POWERING BLUE LAMP) */}
          <g>
            <rect x="510" y="160" width="75" height="55" fill="#2a170b" stroke={isBlueLampActive ? '#3b82f6' : '#5c371d'} strokeWidth="2.5" rx="4" />
            <text x="547.5" y="190" textAnchor="middle" fill="#f4f4f5" fontSize="12" fontWeight="bold" fontFamily="monospace">
              GATE 3: AND
            </text>
            <text x="547.5" y="204" textAnchor="middle" fill="#60a5fa" fontSize="9" fontWeight="bold" fontFamily="monospace">
              [BLUE PATH]
            </text>
          </g>

          {/* Wire Gate 3 -> BLUE LAMP */}
          <path
            d="M 585 185 L 670 185"
            stroke={isBlueLampActive ? '#3b82f6' : '#1e3a8a'}
            strokeWidth={isBlueLampActive ? '6' : '2'}
            filter={isBlueLampActive ? 'url(#blue-glow)' : undefined}
            fill="none"
          />

          {/* GATE 4: AND GATE BLOCK (Lever 20 && Lever 25) */}
          <g>
            <rect x="510" y="20" width="75" height="55" fill="#2a170b" stroke={isRedLampActive ? '#ef4444' : '#5c371d'} strokeWidth="2" rx="4" />
            <text x="547.5" y="50" textAnchor="middle" fill="#f4f4f5" fontSize="12" fontWeight="bold" fontFamily="monospace">
              GATE 4: AND
            </text>
            <text x="547.5" y="64" textAnchor="middle" fill="#f87171" fontSize="9" fontWeight="bold" fontFamily="monospace">
              [RED PATH]
            </text>
          </g>

          {/* Wire Gate 4 -> RED LAMP */}
          <path
            d="M 585 47 L 670 47"
            stroke={isRedLampActive ? '#ef4444' : '#450a0a'}
            strokeWidth={isRedLampActive ? '4' : '2'}
            filter={isRedLampActive ? 'url(#red-glow)' : undefined}
            fill="none"
          />

          {/* GATE 5: NOT GATE BLOCK (!Gate 1 OR) */}
          <g>
            <rect x="510" y="275" width="75" height="55" fill="#2a170b" stroke={isGreenLampActive ? '#10b981' : '#5c371d'} strokeWidth="2" rx="4" />
            <circle cx="547.5" cy="293" r="4.5" fill={isGreenLampActive ? '#10b981' : '#064e3b'} />
            <text x="547.5" y="315" textAnchor="middle" fill="#f4f4f5" fontSize="11" fontWeight="bold" fontFamily="monospace">
              GATE 5: NOT
            </text>
          </g>

          {/* Wire Gate 5 -> GREEN LAMP */}
          <path
            d="M 585 300 L 670 300"
            stroke={isGreenLampActive ? '#10b981' : '#064e3b'}
            strokeWidth={isGreenLampActive ? '4' : '2'}
            fill="none"
          />

          {/* OUTPUT MINECRAFT REDSTONE LAMPS (RIGHT SIDE) */}
          {/* RED LAMP */}
          <g>
            <circle
              cx="705"
              cy="47"
              r="26"
              fill={isRedLampActive ? '#dc2626' : '#450a0a'}
              stroke={isRedLampActive ? '#fca5a5' : '#7f1d1d'}
              strokeWidth={isRedLampActive ? '3' : '2'}
              filter={isRedLampActive ? 'url(#red-glow)' : undefined}
            />
            <text x="705" y="52" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold" fontFamily="monospace">
              RED
            </text>
          </g>

          {/* BLUE LAMP */}
          <g>
            <circle
              cx="705"
              cy="185"
              r="32"
              fill={isBlueLampActive ? '#1d4ed8' : '#1e3a8a'}
              stroke={isBlueLampActive ? '#93c5fd' : '#1d4ed8'}
              strokeWidth={isBlueLampActive ? '4' : '2'}
              filter={isBlueLampActive ? 'url(#blue-glow)' : undefined}
              className={isBlueLampActive ? 'animate-pulse' : ''}
            />
            <circle cx="705" cy="185" r="22" fill={isBlueLampActive ? '#3b82f6' : '#1e40af'} />
            <text x="705" y="190" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="extrabold" fontFamily="monospace">
              BLUE
            </text>
          </g>

          {/* GREEN LAMP */}
          <g>
            <circle
              cx="705"
              cy="300"
              r="26"
              fill={isGreenLampActive ? '#059669' : '#064e3b'}
              stroke={isGreenLampActive ? '#6ee7b7' : '#047857'}
              strokeWidth={isGreenLampActive ? '3' : '2'}
            />
            <text x="705" y="305" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold" fontFamily="monospace">
              GREEN
            </text>
          </g>
        </svg>
      </div>

      {/* FOOTER LEGEND & CONTROLS */}
      <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-amber-200/80 bg-[#1a0d05] px-2.5 py-1 rounded border border-[#3d2313]">
        <div>
          Pull <span className="text-amber-400 font-bold">Lever #20 [ONLY]</span> to power Gate 1 & Gate 2 ➔ Gate 3 (AND).
        </div>
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${isRedLampActive ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-red-950'}`} /> RED
          </span>
          <span className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${isBlueLampActive ? 'bg-blue-500 shadow-[0_0_8px_#3b82f6]' : 'bg-blue-950'}`} /> BLUE (Active)
          </span>
          <span className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${isGreenLampActive ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-emerald-950'}`} /> GREEN
          </span>
        </div>
      </div>
    </div>
  );
}
