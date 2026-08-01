'use client';

import React from 'react';
import Link from 'next/link';
import { Embers } from './Embers';
import { EventInfo } from './EventInfo';

export const HeroSection: React.FC = () => {
  return (
    <section className="relative min-h-[100svh] flex flex-col items-center justify-between pt-16 sm:pt-20 pb-8 sm:pb-12 px-4 overflow-hidden">
      {/* Animated Background */}
      <div 
        className="absolute inset-0 z-0 animate-bg-zoom"
        style={{
          backgroundImage: "url('/landingbg.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      {/* Gradient overlay — darker at bottom for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/70 z-0"></div>
      {/* Particle overlay */}
      <Embers />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-4xl mx-auto flex-grow justify-center gap-4 sm:gap-6">
        
        {/* Title Logos */}
        <div className="text-center flex flex-col items-center animate-float space-y-4">
          <img 
            src="/sqac-presents.png" 
            alt="SQAC Presents" 
            className="h-4 sm:h-6 md:h-8 lg:h-10 object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)] mx-auto"
          />
          <div className="relative w-full max-w-[280px] sm:max-w-md md:max-w-2xl lg:max-w-3xl">
            <img 
              src="/font.png" 
              alt="Mineverse" 
              className="w-full drop-shadow-[0_8px_12px_rgba(0,0,0,0.8)] hover:scale-[1.03] transition-transform duration-500"
            />
          </div>
          <img 
            src="/srmist.png" 
            alt="SRMIST" 
            className="h-5 sm:h-6 md:h-8 lg:h-10 object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)] mx-auto"
          />
          <div className="mt-2 sm:mt-4 w-full flex justify-center">
              <img 
                src="/code-craft-conquer.png" 
                alt="CODE. CRAFT. CONQUER." 
                className="h-5 sm:h-8 md:h-10 lg:h-14 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]"
              />
          </div>
        </div>

        {/* Event Info and Countdown */}
        <EventInfo />

        {/* Register + Login Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-2 sm:mt-4">
          <Link href="/register" className="block">
            <div className="animate-pulse-glow inline-block">
              <button 
                className="btn-minecraft group relative px-8 sm:px-12 md:px-16 py-3 sm:py-4 md:py-5 bg-[#aa0000] text-white cursor-pointer"
                style={{ fontFamily: 'var(--font-minecraft)' }}
              >
                <span className="relative z-10 text-lg sm:text-2xl md:text-3xl tracking-[0.2em] drop-shadow-[3px_3px_0_rgba(0,0,0,0.9)] block">
                  REGISTER
                </span>
              </button>
            </div>
          </Link>

          <Link href="/login" className="block">
            <div className="animate-pulse-glow inline-block">
              <button 
                className="btn-minecraft group relative px-8 sm:px-12 md:px-16 py-3 sm:py-4 md:py-5 bg-[#006400] text-white cursor-pointer"
                style={{ fontFamily: 'var(--font-minecraft)' }}
              >
                <span className="relative z-10 text-lg sm:text-2xl md:text-3xl tracking-[0.2em] drop-shadow-[3px_3px_0_rgba(0,0,0,0.9)] block">
                  LOGIN
                </span>
              </button>
            </div>
          </Link>
        </div>
        
      </div>
    </section>
  );
};
