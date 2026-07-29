'use client';

import { useState, useEffect } from 'react';

export default function Round1Page() {
  const [timeLeft, setTimeLeft] = useState(60 * 60); // 60 minutes
  
  const [toasts, setToasts] = useState<{ id: number; icon: string; title: string; subtitle: string; }[]>([]);
  const [activeSlot, setActiveSlot] = useState(1);

  const inventory = [
    { key: 1, name: 'Wood', icon: '/wood.png', count: 25 },
    { key: 2, name: 'Stone', icon: '/stone.png', count: 10 },
    { key: 3, name: 'Iron', icon: '/iron.png', count: 0 },
    { key: 4, name: 'Gold', icon: '/gold.png', count: 0 },
    { key: 5, name: 'Diamond', icon: '/diamond.png', count: 0 },
    { key: 6, name: 'Emerald', icon: '/emerald.png', count: 5 },
    { key: 7, name: 'Obsidian', icon: '/obsidian.png', count: 0 },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        setActiveSlot(num);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const addToast = (icon: string, title: string, subtitle: string) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, icon, title, subtitle }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };



  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const mc = { fontFamily: 'var(--font-minecraft), system-ui, sans-serif' };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col relative overflow-hidden">
      <style>{`
        @keyframes mc-toast-in {
          from { opacity: 0; transform: translateX(110%); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      
      {/* Minecraft Toasts */}
      <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' }}>
        {toasts.map(toast => (
          <div key={toast.id} style={{
            display: 'flex', alignItems: 'center',
            background: 'rgba(14,14,14,0.92)',
            border: '2px solid rgba(80,80,80,0.9)',
            borderRadius: '4px', overflow: 'hidden',
            boxShadow: '4px 4px 0 rgba(0,0,0,0.8)',
            minWidth: '260px', maxWidth: '340px',
            animation: 'mc-toast-in 0.35s cubic-bezier(0.22,1,0.36,1) forwards',
            fontFamily: 'var(--font-minecraft, monospace)',
          }}>
            <div style={{
              width: '52px', minWidth: '52px', height: '52px',
              background: 'rgba(30,30,30,0.95)',
              borderRight: '2px solid rgba(80,80,80,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '26px', flexShrink: 0,
            }}>{toast.icon}</div>
            <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{
                color: toast.title.includes('Advancement') ? '#FFAA00' : toast.title.includes('Challenge') ? '#FF55FF' : '#FFFF55', 
                fontSize: '11px', fontWeight: 700,
                letterSpacing: '0.5px', textShadow: '1px 1px 0 rgba(0,0,0,0.9)', lineHeight: 1.2,
              }}>{toast.title}</div>
              <div style={{
                color: 'rgba(255,255,255,0.88)', fontSize: '10px',
                letterSpacing: '0.3px', textShadow: '1px 1px 0 rgba(0,0,0,0.9)', lineHeight: 1.3,
              }}>{toast.subtitle}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Background Video Loop */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute top-0 left-0 w-full h-full object-cover z-0"
        style={{ filter: 'brightness(0.6)' }}
      >
        <source src="/biome1-1.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* Timer Container */}
      <div className="relative z-10 w-full p-6 flex items-center pointer-events-none">
        <div className="relative pointer-events-auto flex items-center justify-center ml-6 md:ml-20">
          <img 
            src="/timer.png" 
            alt="Timer background" 
            className="w-32 md:w-44 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]"
            style={{ imageRendering: 'pixelated' }}
          />
          <div 
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ ...mc }}
          >
            <span className="text-[#fde047] text-[8px] md:text-[10px] drop-shadow-[2px_2px_0_#000] mb-0.5">TIME LEFT</span>
            <span className="text-white text-base md:text-lg drop-shadow-[2px_2px_0_#000]">{formatTime(timeLeft)}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4">
        <div style={{
          background: 'rgba(74, 51, 32, 0.8)',
          borderTop: '6px solid #6c4b31',
          borderLeft: '6px solid #6c4b31',
          borderBottom: '6px solid #1f140c',
          borderRight: '6px solid #1f140c',
          padding: '32px 64px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <h1 style={{
            ...mc,
            fontSize: 'clamp(2rem, 5vw, 4rem)',
            color: '#fde047',
            textShadow: '4px 4px 0 #000',
            letterSpacing: '0.1em',
            textAlign: 'center',
            margin: 0
          }}>
            ROUND 1
          </h1>
          <p style={{
            ...mc,
            marginTop: '1.5rem',
            fontSize: 'clamp(1rem, 2vw, 1.5rem)',
            color: '#aaa',
            textShadow: '2px 2px 0 #000',
            textAlign: 'center'
          }}>
            COMMENCING SOON
          </p>
        </div>
      </div>

      {/* Crafting Image */}
      <div 
        role="button"
        tabIndex={0}
        onClick={() => addToast('🪵', 'Coming Soon!', 'Crafting Table is closed')}
        className="absolute bottom-6 -left-0 md:bottom-10 md:-left-34 z-20 pointer-events-auto cursor-pointer group"
      >
        {/* Counter badge */}
        <div style={{
          position: 'absolute', top: '15%', right: '20%', zIndex: 30,
          background: 'linear-gradient(135deg,#1a1a2e,#16213e)',
          border: '2px solid rgba(100,210,255,0.6)',
          borderRadius: '50%', width: '32px', height: '32px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(100,210,255,0.9)', fontSize: '13px', fontWeight: 700,
          fontFamily: 'var(--font-minecraft, monospace)',
          boxShadow: '0 0 12px rgba(100,210,255,0.5)',
        }}>0</div>
        <img 
          src="/crafting.png" 
          alt="Crafting" 
          className="w-[18rem] md:w-[22rem] lg:w-[26rem] drop-shadow-[0_10px_15px_rgba(0,0,0,0.8)] group-hover:scale-105 group-hover:drop-shadow-[0_0_20px_rgba(100,210,255,0.5)] transition-all"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      {/* Minecraft HUD Hotbar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
        <div 
          className="flex bg-[#8b8b8b] p-1.5"
          style={{ 
            borderTop: '3px solid #ffffff',
            borderLeft: '3px solid #ffffff',
            borderBottom: '3px solid #373737',
            borderRight: '3px solid #373737',
          }}
        >
          {Array.from({ length: 9 }).map((_, i) => {
            const slotNum = i + 1;
            const item = inventory.find(inv => inv.key === slotNum);
            const isActive = slotNum === activeSlot;
            return (
              <div 
                key={slotNum}
                onClick={() => setActiveSlot(slotNum)}
                className="relative w-12 h-12 md:w-16 md:h-16 bg-[#8b8b8b] mx-[2px] flex items-center justify-center cursor-pointer"
                style={{
                  borderTop: '3px solid #373737',
                  borderLeft: '3px solid #373737',
                  borderBottom: '3px solid #ffffff',
                  borderRight: '3px solid #ffffff',
                }}
              >
                {isActive && (
                  <div className="absolute -inset-[4px] border-[4px] border-white z-20 pointer-events-none" />
                )}
                {item && (
                  <>
                    <img 
                      src={item.icon} 
                      alt={item.name} 
                      className="w-8 h-8 md:w-10 md:h-10 object-contain drop-shadow-[2px_2px_0_rgba(0,0,0,0.6)]" 
                      style={{ imageRendering: 'pixelated' }} 
                    />
                    <span 
                      className="absolute top-0.5 right-1 text-white drop-shadow-[2px_2px_0_#000] z-10"
                      style={{ ...mc, fontSize: 'clamp(10px, 1.5vw, 14px)' }}
                    >
                      {item.count}
                    </span>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
}
