import React from 'react';

export const MinecraftBoard = ({ children, title }: { children: React.ReactNode, title?: string }) => {
  return (
    <div className="relative w-full max-w-md mx-auto flex flex-col items-center drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] mt-4 mb-4">
      {/* Sign Post */}
      <div className="absolute -bottom-10 w-12 h-16 bg-[#5c3a21] border-l-4 border-r-4 border-[#3c2512] z-0"></div>
      
      {/* Main Sign Board (Thick Dark Wood Border with Grain) */}
      <div 
        className="relative w-full p-4 z-10" 
        style={{ 
          backgroundColor: '#5c3a21',
          borderTop: '6px solid #6d4527',
          borderLeft: '10px solid #6d4527',
          borderBottom: '6px solid #3c2512',
          borderRight: '10px solid #3c2512',
          backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(0,0,0,0.05) 8px, rgba(0,0,0,0.05) 12px)',
          imageRendering: 'pixelated'
        }}
      >
        
        {/* Metal Studs in Corners */}
        <div className="absolute top-0 left-0 w-10 h-10 bg-[#5c3a21] border-t-[4px] border-l-[4px] border-[#6d4527] border-b-[4px] border-r-[4px] border-[#3c2512] flex items-center justify-center -ml-[14px] -mt-[10px] shadow-[2px_2px_4px_rgba(0,0,0,0.6)]">
          <div className="w-4 h-4 bg-[#888] border-t-[3px] border-l-[3px] border-[#ccc] border-b-[3px] border-r-[3px] border-[#444]"></div>
        </div>
        <div className="absolute top-0 right-0 w-10 h-10 bg-[#5c3a21] border-t-[4px] border-l-[4px] border-[#6d4527] border-b-[4px] border-r-[4px] border-[#3c2512] flex items-center justify-center -mr-[14px] -mt-[10px] shadow-[2px_2px_4px_rgba(0,0,0,0.6)]">
          <div className="w-4 h-4 bg-[#888] border-t-[3px] border-l-[3px] border-[#ccc] border-b-[3px] border-r-[3px] border-[#444]"></div>
        </div>
        <div className="absolute bottom-0 left-0 w-10 h-10 bg-[#5c3a21] border-t-[4px] border-l-[4px] border-[#6d4527] border-b-[4px] border-r-[4px] border-[#3c2512] flex items-center justify-center -ml-[14px] -mb-[10px] shadow-[2px_2px_4px_rgba(0,0,0,0.6)]">
          <div className="w-4 h-4 bg-[#888] border-t-[3px] border-l-[3px] border-[#ccc] border-b-[3px] border-r-[3px] border-[#444]"></div>
        </div>
        <div className="absolute bottom-0 right-0 w-10 h-10 bg-[#5c3a21] border-t-[4px] border-l-[4px] border-[#6d4527] border-b-[4px] border-r-[4px] border-[#3c2512] flex items-center justify-center -mr-[14px] -mb-[10px] shadow-[2px_2px_4px_rgba(0,0,0,0.6)]">
          <div className="w-4 h-4 bg-[#888] border-t-[3px] border-l-[3px] border-[#ccc] border-b-[3px] border-r-[3px] border-[#444]"></div>
        </div>

        {/* Inner Light Wood Area (Planks) */}
        <div 
          className="relative bg-[#d4aa73] border-[4px] border-t-[#8b6b47] border-l-[#8b6b47] border-b-[#e6c18a] border-r-[#e6c18a] p-6 min-h-[160px] flex flex-col justify-center text-center" 
          style={{ 
            backgroundImage: "repeating-linear-gradient(to bottom, transparent, transparent 32px, rgba(0,0,0,0.1) 32px, rgba(0,0,0,0.2) 34px)",
            boxShadow: "inset 0 0 20px rgba(0,0,0,0.4)"
          }}
        >
          {title && <h3 className="text-2xl text-[#2d1e0f] mb-4 font-bold" style={{ fontFamily: 'var(--font-minecraft)' }}>{title}</h3>}
          <div className="text-[#1a110a]" style={{ fontFamily: 'var(--font-minecraft)' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
