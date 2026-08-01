'use client';

import React from 'react';

export const Footer = () => {
  return (
    <footer className="w-full bg-[#2d1e0f] border-t-[6px] border-[#1a110a] text-white py-12 px-6 flex flex-col items-center justify-between min-h-[400px] relative overflow-hidden" style={{ fontFamily: 'var(--font-minecraft)' }}>
      {/* Top Header Row */}
      <div className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-center z-10 gap-6">
        <div className="flex items-center gap-2">
          <img src="/sqac-logo.png" alt="SQAC" className="h-8 object-contain bg-[#1a110a] p-1 rounded-sm hidden md:block" onError={(e) => e.currentTarget.style.display = 'none'} />
          <h2 className="text-xl font-bold tracking-widest text-[#fca311] drop-shadow-md">SQAC</h2>
        </div>

        <div className="text-xs text-gray-400 opacity-80">
          © 2026 SQAC
        </div>
      </div>

      {/* Middle Links Row */}
      <div className="w-full max-w-5xl flex flex-wrap justify-center gap-6 md:gap-12 text-sm text-gray-300 mt-8 md:mt-4 z-10">
        <a href="#" className="hover:text-[#fca311] transition-colors flex items-center">Privacy Policy</a>
        <a href="https://www.instagram.com/sqac.srmist/" target="_blank" rel="noopener noreferrer" className="hover:text-[#fca311] transition-colors flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
            <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
          </svg>
          Instagram
        </a>
      </div>

      {/* Main Game / Hero Area */}
      <div className="mt-20 flex flex-col items-center z-10 w-full mb-4">
        
        <h1 className="text-5xl md:text-6xl font-bold mb-4 flex items-center gap-4 tracking-widest text-[#5D8C3E] drop-shadow-[4px_4px_0_rgba(0,0,0,1)] uppercase">
          <span className="animate-pulse">{'>'}</span> sqac run
        </h1>
      </div>

      {/* Bottom Road/Track Decoration */}
      <div className="absolute bottom-16 left-0 right-0 h-[4px] bg-[#3c2512] w-full"></div>
      <div className="absolute bottom-10 left-0 right-0 w-full flex justify-between px-4 overflow-hidden opacity-80">
        <div className="w-4 h-1.5 bg-[#4a2e16]"></div>
        <div className="w-4 h-1.5 bg-[#4a2e16]"></div>
        <div className="w-4 h-1.5 bg-[#4a2e16]"></div>
        <div className="w-4 h-1.5 bg-[#4a2e16]"></div>
        <div className="w-4 h-1.5 bg-[#4a2e16]"></div>
        <div className="w-4 h-1.5 bg-[#4a2e16]"></div>
        <div className="w-4 h-1.5 bg-[#4a2e16]"></div>
        <div className="w-4 h-1.5 bg-[#4a2e16]"></div>
        <div className="w-4 h-1.5 bg-[#4a2e16]"></div>
        <div className="w-4 h-1.5 bg-[#4a2e16]"></div>
        <div className="w-4 h-1.5 bg-[#4a2e16]"></div>
        <div className="w-4 h-1.5 bg-[#4a2e16]"></div>
      </div>
    </footer>
  );
};
