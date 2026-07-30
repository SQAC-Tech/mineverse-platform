'use client';

import React, { useEffect } from 'react';

export const ClickParticles: React.FC = () => {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Don't spawn particles if clicking on a button or link (to avoid visual clutter)
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('a')) return;

      const numParticles = 8;
      const colors = ['#8b5a2b', '#6b4226', '#a0522d', '#7cfc00', '#556b2f']; // Dirt/Grass colors

      for (let i = 0; i < numParticles; i++) {
        const particle = document.createElement('div');
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        particle.style.position = 'fixed';
        particle.style.left = `${e.clientX}px`;
        particle.style.top = `${e.clientY}px`;
        particle.style.width = `${Math.random() * 8 + 4}px`;
        particle.style.height = particle.style.width;
        particle.style.backgroundColor = color;
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '9999';
        particle.style.imageRendering = 'pixelated';
        
        document.body.appendChild(particle);

        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 50 + 20;
        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity + 50; // Add gravity effect

        particle.animate(
          [
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
            { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`, opacity: 0 }
          ],
          {
            duration: 400 + Math.random() * 200,
            easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
          }
        ).onfinish = () => particle.remove();
      }
    };

    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  return null; // This component doesn't render anything directly
};
