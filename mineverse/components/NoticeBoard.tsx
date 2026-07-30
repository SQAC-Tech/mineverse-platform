import React from 'react';

interface NoticeBoardProps {
  children: React.ReactNode;
  className?: string;
  width?: string;
  height?: string;
}

export const NoticeBoard: React.FC<NoticeBoardProps> = ({ children, className = '', width = '100%', height = 'auto' }) => {
  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{
        width,
        height,
        backgroundImage: "url('/mc_wooden_board.png')",
        backgroundSize: '100% 100%', // Stretch to fit like a board
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        padding: '6% 8%', // Give some padding based on the board edges
      }}
    >
      <div
        className="text-center w-full"
        style={{
          fontFamily: 'var(--font-minecraft), monospace',
          color: '#312111', // Dark text on light wood
          letterSpacing: '0.05em',
        }}
      >
        {children}
      </div>
    </div>
  );
};
