'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Eye, EyeOff, CheckCircle2, Sparkles, Wand2 } from 'lucide-react';

interface PictureSliderPuzzleProps {
  onSolve: (answer: string) => void;
  imageUrl?: string;
  gridSize?: number; // default 3 for 3x3
}

export function PictureSliderPuzzle({
  onSolve,
  imageUrl = '/background1.webp',
  gridSize = 3,
}: PictureSliderPuzzleProps) {
  const totalTiles = gridSize * gridSize; // 9 for 3x3
  const blankTileIndex = totalTiles - 1; // 8 is the blank tile

  const [tiles, setTiles] = useState<number[]>(() =>
    Array.from({ length: totalTiles }, (_, i) => i)
  );
  const [moves, setMoves] = useState<number>(0);
  const [isSolved, setIsSolved] = useState<boolean>(false);
  const [showNumbers, setShowNumbers] = useState<boolean>(true);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // Helper: Get adjacent valid positions for a given position
  const getAdjacentPositions = useCallback(
    (pos: number) => {
      const row = Math.floor(pos / gridSize);
      const col = pos % gridSize;
      const neighbors: number[] = [];

      if (row > 0) neighbors.push(pos - gridSize); // Top
      if (row < gridSize - 1) neighbors.push(pos + gridSize); // Bottom
      if (col > 0) neighbors.push(pos - 1); // Left
      if (col < gridSize - 1) neighbors.push(pos + 1); // Right

      return neighbors;
    },
    [gridSize]
  );

  // Function to generate a guaranteed-solvable shuffle via random valid moves
  const shuffleTiles = useCallback(() => {
    setIsInitializing(true);
    setIsSolved(false);
    setMoves(0);

    let currentBoard = Array.from({ length: totalTiles }, (_, i) => i);
    let blankPos = totalTiles - 1;
    let lastPos = -1;

    // Perform 100 random valid moves from blank position
    const shuffleSteps = 100;
    for (let i = 0; i < shuffleSteps; i++) {
      const neighbors = getAdjacentPositions(blankPos).filter((p) => p !== lastPos);
      const nextPos = neighbors[Math.floor(Math.random() * neighbors.length)];
      
      // Swap blank with chosen neighbor
      currentBoard[blankPos] = currentBoard[nextPos];
      currentBoard[nextPos] = blankTileIndex;
      
      lastPos = blankPos;
      blankPos = nextPos;
    }

    setTiles(currentBoard);
    setIsInitializing(false);
  }, [totalTiles, blankTileIndex, getAdjacentPositions]);

  useEffect(() => {
    shuffleTiles();
  }, [shuffleTiles]);

  // Check if current tiles are in solved state
  const checkSolved = useCallback(
    (currentTiles: number[]) => {
      return currentTiles.every((tile, idx) => tile === idx);
    },
    []
  );

  // Handle tile click
  const handleTileClick = (index: number) => {
    if (isSolved || isInitializing) return;

    const blankPos = tiles.indexOf(blankTileIndex);
    const adjacentPos = getAdjacentPositions(blankPos);

    if (adjacentPos.includes(index)) {
      const newTiles = [...tiles];
      newTiles[blankPos] = newTiles[index];
      newTiles[index] = blankTileIndex;

      setTiles(newTiles);
      const nextMoves = moves + 1;
      setMoves(nextMoves);

      if (checkSolved(newTiles)) {
        setIsSolved(true);
        setTimeout(() => {
          onSolve('SLIDER_SOLVED');
        }, 600);
      }
    }
  };

  // Dev Instant Auto-Solve helper
  const handleAutoSolve = () => {
    const solvedBoard = Array.from({ length: totalTiles }, (_, i) => i);
    setTiles(solvedBoard);
    setIsSolved(true);
    setTimeout(() => {
      onSolve('SLIDER_SOLVED');
    }, 400);
  };

  return (
    <div className="w-full flex flex-col items-center my-1 select-none">
      {/* HEADER & CONTROLS TOOLBAR */}
      <div className="w-full flex items-center justify-between bg-[#1f1108]/90 border border-[#522f18] rounded-lg p-2 mb-2 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold uppercase tracking-wider text-[11px]">
            MOVES: <span className="text-amber-200 font-black">{moves}</span>
          </span>
          {isSolved && (
            <span className="flex items-center gap-1 text-emerald-400 font-bold text-[11px] animate-pulse">
              <CheckCircle2 className="w-3.5 h-3.5" /> MATRIX RESTORED!
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="bg-[#2d190c] hover:bg-[#3f2412] border border-[#6b3c1b] text-amber-200 px-2 py-1 rounded flex items-center gap-1 text-[11px] transition-colors cursor-pointer"
            title="Toggle Target Preview"
          >
            {showPreview ? <EyeOff className="w-3 h-3 text-amber-400" /> : <Eye className="w-3 h-3 text-amber-400" />}
            <span>{showPreview ? 'Hide Target' : 'Target Pic'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNumbers(!showNumbers)}
            className={`border px-2 py-1 rounded flex items-center gap-1 text-[11px] transition-colors cursor-pointer ${
              showNumbers
                ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                : 'bg-[#2d190c] border-[#6b3c1b] text-amber-400/70'
            }`}
            title="Toggle Tile Numbers"
          >
            <span># Numbers</span>
          </button>

          <button
            type="button"
            onClick={shuffleTiles}
            disabled={isInitializing}
            className="bg-[#2d190c] hover:bg-[#3f2412] border border-[#6b3c1b] text-amber-200 px-2 py-1 rounded flex items-center gap-1 text-[11px] transition-colors cursor-pointer"
            title="Reshuffle Puzzle"
          >
            <RefreshCw className={`w-3 h-3 text-amber-400 ${isInitializing ? 'animate-spin' : ''}`} />
            <span>Reset</span>
          </button>

          {process.env.NODE_ENV === 'development' && (
            <button
              type="button"
              onClick={handleAutoSolve}
              className="bg-purple-950/80 hover:bg-purple-900 border border-purple-600 text-purple-200 px-1.5 py-1 rounded text-[10px] flex items-center gap-1 cursor-pointer"
              title="Dev Auto-Solve"
            >
              <Wand2 className="w-3 h-3 text-purple-400" />
            </button>
          )}
        </div>
      </div>

      {/* TARGET PICTURE OVERLAY / MODAL PREVIEW */}
      {showPreview && (
        <div className="w-full bg-[#120904] border-2 border-amber-600/60 rounded-lg p-2 mb-2 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
          <div className="text-[10px] font-mono text-amber-400 font-bold uppercase mb-1">
            🎯 Target Solved Picture Reference:
          </div>
          <div
            className="w-48 h-48 rounded border border-amber-500/40 bg-cover bg-center shadow-lg"
            style={{ backgroundImage: `url('${imageUrl}')` }}
          />
        </div>
      )}

      {/* 3x3 SLIDING PUZZLE GRID CANVAS */}
      <div
        className={`relative w-full max-w-[340px] sm:max-w-[380px] aspect-square bg-[#0e0703] border-4 rounded-xl p-1.5 shadow-[0_0_25px_rgba(0,0,0,0.9)] grid ${gridSize === 3 ? 'grid-cols-3 grid-rows-3' : 'grid-cols-4 grid-rows-4'} gap-1 transition-all duration-500 ${
          isSolved
            ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.5)]'
            : 'border-[#6b3c1b]'
        }`}
      >
        {tiles.map((tileIndex, slotPos) => {
          const isBlank = tileIndex === blankTileIndex && !isSolved;
          const origRow = Math.floor(tileIndex / gridSize);
          const origCol = tileIndex % gridSize;

          // Calculate background position percentages for grid
          const bgX = (origCol * 100) / (gridSize - 1);
          const bgY = (origRow * 100) / (gridSize - 1);

          return (
            <div
              key={slotPos}
              onClick={() => handleTileClick(slotPos)}
              className={`relative rounded-md overflow-hidden transition-all duration-150 select-none ${
                isBlank
                  ? 'bg-[#150b05] border border-[#2d180b] opacity-40 shadow-inner'
                  : 'cursor-pointer hover:brightness-110 active:scale-95 border border-amber-900/60 shadow-md'
              } ${isSolved ? 'border-emerald-400/80 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : ''}`}
              style={{
                backgroundImage: isBlank ? 'none' : `url('${imageUrl}')`,
                backgroundSize: `${gridSize * 100}% ${gridSize * 100}%`,
                backgroundPosition: `${bgX}% ${bgY}%`,
              }}
            >
              {/* Tile Number Badge */}
              {showNumbers && !isBlank && (
                <div className="absolute top-1 left-1 bg-stone-950/80 border border-amber-500/50 text-amber-300 text-[10px] font-mono font-bold w-4 h-4 rounded flex items-center justify-center pointer-events-none shadow">
                  {tileIndex + 1}
                </div>
              )}

              {/* Grid cell accent lines */}
              {!isBlank && (
                <div className="absolute inset-0 border border-amber-400/10 pointer-events-none hover:border-amber-400/40 transition-colors" />
              )}
            </div>
          );
        })}

        {/* SOLVED GLOW OVERLAY & SUCCESS BANNER */}
        {isSolved && (
          <div className="absolute inset-0 bg-emerald-950/60 backdrop-blur-[2px] rounded-lg flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300 z-20">
            <div className="bg-stone-950/90 border-2 border-emerald-500 p-4 rounded-xl shadow-2xl flex flex-col items-center text-center max-w-xs">
              <Sparkles className="w-10 h-10 text-emerald-400 animate-bounce mb-2" />
              <h3 className="font-mono text-sm font-black text-emerald-300 uppercase tracking-widest">
                MATRIX RESTORED!
              </h3>
              <p className="font-mono text-[11px] text-zinc-300 mt-1">
                Puzzle complete in <span className="text-amber-400 font-bold">{moves} moves</span>.
              </p>
              <div className="mt-3 text-[10px] font-mono text-emerald-400 font-bold tracking-wider animate-pulse uppercase">
                ⚡ Auto-Submitting Verification...
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
