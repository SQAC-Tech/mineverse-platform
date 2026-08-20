'use client';

import React, { useEffect, useRef, useState } from 'react';

interface ScreeningVideoBackgroundProps {
  onVideoComplete: () => void;
  playbackRate?: number;
}

export function ScreeningVideoBackground({
  onVideoComplete,
  playbackRate = 1.5,
}: ScreeningVideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  };

  const handleEnded = () => {
    setCompleted(true);
    onVideoComplete();
  };

  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none select-none z-0 overflow-hidden bg-stone-950">
      {/* FULL-COLOR BACKGROUND VIDEO (NO GREYSCALE / NO DARK FILTER) */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onPlay={handlePlay}
        onEnded={handleEnded}
        onLoadedMetadata={() => {
          if (videoRef.current) videoRef.current.playbackRate = playbackRate;
        }}
        className="w-full h-full object-cover"
      >
        <source src="/screening_initial.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
