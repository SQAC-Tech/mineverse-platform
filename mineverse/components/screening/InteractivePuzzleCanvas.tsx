'use client';

import React, { useState, useEffect } from 'react';
import { PictureSliderPuzzle } from './PictureSliderPuzzle';

const PUZZLE_PHOTOS = [
  '/Screening/Cave Biome.jpg',
  '/Screening/Cherry Grove.webp',
  '/Screening/Forest Biome.jpg',
  '/Screening/Mountain Biome.jpg',
  '/Screening/Nether Biome.jpg'
];

interface InteractivePuzzleCanvasProps {
  step: number;
  onSelectAnswer?: (ans: string) => void;
  imageAssigned?: string;
}

export function InteractivePuzzleCanvas({ step, onSelectAnswer, imageAssigned }: InteractivePuzzleCanvasProps) {
  const [imageUrl, setImageUrl] = useState<string>('');

  useEffect(() => {
    if (imageAssigned) {
      setImageUrl(`/Screening/${imageAssigned}`);
    } else {
      setImageUrl(PUZZLE_PHOTOS[Math.floor(Math.random() * PUZZLE_PHOTOS.length)]);
    }
  }, [imageAssigned]);

  if (step === 1) {
    // Puzzle 1: Clean instruction prompt without simulator preview
    return null;
  }

  if (step === 2) {
    // PUZZLE 2: PICTURE SLIDER PUZZLE (SHATTERED RELIC MATRIX)
    if (!imageUrl) return null; // Avoid hydration mismatch

    return (
      <div className="my-1">
        <PictureSliderPuzzle
          imageUrl={imageUrl}
          gridSize={3}
          onSolve={(answer) => {
            if (onSelectAnswer) onSelectAnswer(answer);
          }}
        />
      </div>
    );
  }

  if (step === 3) {
    // Puzzle 3: Clean instruction prompt without cipher matrix preview
    return null;
  }

  return null;
}
