'use client';
import React, { useEffect, useState } from 'react';

const COLORS = ['#FF2A2A', '#FFB000', '#4CAF50', '#2196F3', '#9C27B0', '#FFFFFF', '#AAAAAA'];

export const Embers = () => {
  const [embers, setEmbers] = useState<Array<{ id: number, left: string, animationDuration: string, width: string, height: string, delay: string, color: string }>>([]);

  useEffect(() => {
    // Generate 40 random square particles
    const newEmbers = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      animationDuration: `${Math.random() * 5 + 4}s`, // 4 to 9 seconds (a bit slower)
      delay: `${Math.random() * 5}s`,
      width: `${Math.random() * 8 + 4}px`, // 4px to 12px squares
      height: `${Math.random() * 8 + 4}px`,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    }));
    setEmbers(newEmbers);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[5]">
      {embers.map((ember) => (
        <div
          key={ember.id}
          className="absolute bottom-[-20px] animate-rise"
          style={{
            left: ember.left,
            width: ember.width,
            height: ember.height,
            backgroundColor: ember.color,
            animationDuration: ember.animationDuration,
            animationDelay: ember.delay,
            opacity: 0, // handled by animation
            boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.3)' // tiny 3D effect like Minecraft particles
          }}
        />
      ))}
    </div>
  );
};
