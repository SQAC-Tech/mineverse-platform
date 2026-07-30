'use client';

import React, { useEffect, useState } from 'react';

type Block = {
  id: number;
  left: string;
  animationDuration: string;
  animationDelay: string;
  size: number;
  type: 'dirt' | 'stone' | 'wood';
};

export const FloatingBlocks: React.FC = () => {
  const [blocks, setBlocks] = useState<Block[]>([]);

  useEffect(() => {
    // Generate a fixed number of blocks that will continuously loop
    const newBlocks: Block[] = Array.from({ length: 15 }).map((_, i) => {
      const types: ('dirt' | 'stone' | 'wood')[] = ['dirt', 'stone', 'wood'];
      return {
        id: i,
        left: `${Math.random() * 100}%`,
        animationDuration: `${Math.random() * 20 + 15}s`,
        animationDelay: `${Math.random() * 15}s`,
        size: Math.random() * 40 + 20, // 20px to 60px
        type: types[Math.floor(Math.random() * types.length)],
      };
    });
    setBlocks(newBlocks);
  }, []);

  const getColorForType = (type: string) => {
    switch (type) {
      case 'dirt': return '#79553a';
      case 'stone': return '#7d7d7d';
      case 'wood': return '#5c4033';
      default: return '#79553a';
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {blocks.map((block) => (
        <div
          key={block.id}
          className="absolute bottom-[-100px] animate-rise flex opacity-30"
          style={{
            left: block.left,
            animationDuration: block.animationDuration,
            animationDelay: block.animationDelay,
            width: `${block.size}px`,
            height: `${block.size}px`,
          }}
        >
          {/* Simple CSS block representation */}
          <div 
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: getColorForType(block.type),
              border: '2px solid rgba(0,0,0,0.5)',
              boxShadow: 'inset 4px 4px 0px rgba(255,255,255,0.2), inset -4px -4px 0px rgba(0,0,0,0.4)',
              transform: `rotate(${Math.random() * 45}deg)`,
              imageRendering: 'pixelated'
            }}
          />
        </div>
      ))}
    </div>
  );
};
