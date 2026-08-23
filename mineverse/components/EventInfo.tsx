'use client';
import React, { useState, useEffect } from 'react';

export const EventInfo = () => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isClient, setIsClient] = useState(false);
  
  const venue = process.env.NEXT_PUBLIC_EVENT_VENUE || 'TP 2 711';
  const dateDisplay = process.env.NEXT_PUBLIC_EVENT_DATE_DISPLAY || 'NOV 15-16, 2026';
  const timeDisplay = process.env.NEXT_PUBLIC_EVENT_TIME || '09:00 AM';

  // Reliable parsing for "24 August 2026 09:00 AM" to avoid NaN in Safari/others
  const getEventTime = () => {
    try {
      const dStr = process.env.NEXT_PUBLIC_EVENT_DATE_DISPLAY || '24 August 2026';
      const tStr = process.env.NEXT_PUBLIC_EVENT_TIME || '09:00 AM';
      
      const months: Record<string, number> = { January: 0, February: 1, March: 2, April: 3, May: 4, June: 5, July: 6, August: 7, September: 8, October: 9, November: 10, December: 11 };
      const parts = dStr.split(' ');
      if (parts.length === 3 && months[parts[1]] !== undefined) {
        const day = parseInt(parts[0], 10);
        const month = months[parts[1]];
        const year = parseInt(parts[2], 10);
        
        let hours = 0;
        let mins = 0;
        const timeParts = tStr.split(' ');
        if (timeParts.length === 2) {
          const hm = timeParts[0].split(':');
          hours = parseInt(hm[0], 10);
          mins = parseInt(hm[1], 10);
          if (timeParts[1].toUpperCase() === 'PM' && hours < 12) hours += 12;
          if (timeParts[1].toUpperCase() === 'AM' && hours === 12) hours = 0;
        }
        
        return new Date(year, month, day, hours, mins, 0).getTime();
      }
      return new Date(`${dStr} ${tStr}`).getTime();
    } catch (e) {
      return new Date('2026-08-24T09:00:00').getTime();
    }
  };

  useEffect(() => {
    setIsClient(true);
    const eventTime = getEventTime();
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = eventTime - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      } else {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Prevent hydration mismatch
  if (!isClient) return <div className="min-h-[100px]"></div>;

  const timerUnits = [
    { label: 'DAYS', value: timeLeft.days },
    { label: 'HRS', value: timeLeft.hours },
    { label: 'MIN', value: timeLeft.minutes },
    { label: 'SEC', value: timeLeft.seconds }
  ];

  return (
    <div className="flex flex-col items-center justify-center my-4 md:my-6 w-full z-10" style={{ fontFamily: 'var(--font-minecraft)' }}>
      
      {/* Venue · Date · Time — single compact line */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center mb-6 md:mb-8">
        <span className="text-[#FFB000] text-xs md:text-sm tracking-[0.2em] flex items-center drop-shadow-[1px_1px_0_#000]">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 16 16" 
            className="w-4 h-4 mr-2 md:w-5 md:h-5"
            style={{ shapeRendering: 'crispEdges' }}
          >
            <path fill="#000000" d="M6 1h4v1h2v1h1v5h-1v2h-1v2h-1v2H9v2H7v-2H6v-2H5v-2H4V8H3V3h1V2h2V1z"/>
            <path fill="#fc5454" d="M6 2h4v1h2v5h-1v2h-1v2H6v-2H5V8H4V3h2V2z"/>
            <path fill="#ffffff" d="M7 4h2v2H7V4z"/>
            <rect x="11" y="3" width="1" height="5" fill="#aa0000" />
            <rect x="10" y="8" width="1" height="2" fill="#aa0000" />
            <rect x="9" y="10" width="1" height="2" fill="#aa0000" />
            <rect x="6" y="11" width="3" height="1" fill="#aa0000" />
          </svg>
          {venue}
        </span>
        <span className="text-white/30 text-xs hidden sm:inline">•</span>
        <span className="text-white/90 text-xs md:text-sm tracking-[0.15em] drop-shadow-[1px_1px_0_#000] uppercase">{dateDisplay}</span>
        <span className="text-white/30 text-xs hidden sm:inline">•</span>
        <span className="text-white/60 text-xs md:text-sm tracking-[0.15em] drop-shadow-[1px_1px_0_#000]">{timeDisplay}</span>
      </div>

      {/* Countdown Timer */}
      <div className="flex items-center gap-2 sm:gap-3 md:gap-5">
        {timerUnits.map((item, idx) => (
          <React.Fragment key={idx}>
            <div className="flex flex-col items-center">
              <div 
                className="text-2xl sm:text-3xl md:text-5xl text-white tabular-nums"
                style={{ textShadow: '3px 3px 0 #4CAF50, 0 0 12px rgba(76,175,80,0.3)' }}
              >
                {item.value.toString().padStart(2, '0')}
              </div>
              <div className="text-[8px] sm:text-[10px] md:text-xs text-[#888] tracking-[0.25em] mt-1 drop-shadow-[1px_1px_0_#000]">
                {item.label}
              </div>
            </div>
            {idx < timerUnits.length - 1 && (
              <span 
                className="text-lg sm:text-xl md:text-3xl text-[#4CAF50]/60 self-start mt-0.5 sm:mt-1"
                style={{ textShadow: '0 0 8px rgba(76,175,80,0.3)' }}
              >
                :
              </span>
            )}
          </React.Fragment>
        ))}
      </div>
      
    </div>
  );
};
