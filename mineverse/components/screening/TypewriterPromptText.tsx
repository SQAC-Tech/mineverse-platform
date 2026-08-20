'use client';

import React, { useEffect, useState } from 'react';

interface TypewriterPromptTextProps {
  text: string;
  speed?: number;
  className?: string;
  onComplete?: () => void;
}

export function TypewriterPromptText({
  text,
  speed = 18,
  className = '',
  onComplete,
}: TypewriterPromptTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setDisplayedText('');
    setIndex(0);
  }, [text]);

  useEffect(() => {
    if (index < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + text[index]);
        setIndex((prev) => prev + 1);
      }, speed);
      return () => clearTimeout(timeout);
    } else if (index === text.length && onComplete) {
      onComplete();
    }
  }, [index, text, speed, onComplete]);

  return (
    <span className={className}>
      {displayedText}
      {index < text.length && (
        <span className="inline-block w-2 h-3.5 bg-amber-400 ml-0.5 animate-pulse" />
      )}
    </span>
  );
}
