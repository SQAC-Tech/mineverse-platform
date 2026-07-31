'use client';

import Image from 'next/image';
import { useRef, useEffect, useState, useCallback } from 'react';

import { useRouter } from 'next/navigation';

// Longer crossfade for a more cinematic, seamless feel
const CROSSFADE_MS = 1200;
const TRIGGER_BEFORE_END_S = CROSSFADE_MS / 1000 + 0.3;

const DASH_VIDEO = '/dashvid.mp4';
const LEVEL1_VIDEO = '/vid2.mp4';
const VID3_VIDEO = '/vid3.mp4';

// ── Team members ────────────────────────────────────────────────
const TEAM_PLAYERS = [
  { name: 'ChiragPaul', icon: '👾', ping: 4 },
  { name: 'SkyForger',  icon: '👽', ping: 3 },
  { name: 'NovaBlaze',  icon: '💖', ping: 3 },
  { name: 'LunaStrike', icon: '⭐', ping: 4 },
];

export function VideoBackground() {
  const router = useRouter();
  const videoA = useRef<HTMLVideoElement>(null);
  const videoB = useRef<HTMLVideoElement>(null);

  const [opacityA, setOpacityA] = useState(1);
  const [opacityB, setOpacityB] = useState(0);

  const activeRef = useRef<'A' | 'B'>('A');
  const crossfadingRef = useRef(false);
  const rafRef = useRef<number>(0);

  // ── Drag slider ────────────────────────────────────────────────
  const [hintDone, setHintDone] = useState(false);
  const [dragPct, setDragPct] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // ── Transition triggered when slider hits the right end ────────
  const [sliderComplete, setSliderComplete] = useState(false);
  const transitionedRef = useRef(false);
  const [isPlayingVid3, setIsPlayingVid3] = useState(false);
  const [vid2Complete, setVid2Complete] = useState(false);

  // ── Toast notification ────────────────────────────────────────
  const [toast, setToast] = useState<{ icon: string; title: string; subtitle: string; key: number } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (icon: string, title: string, subtitle: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ icon, title, subtitle, key: Date.now() });
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  };

  // ── Player list (Steve click) ─────────────────────────────────
  const [showPlayerList, setShowPlayerList] = useState(false);

  // Hint → interactive after 3.2 s
  useEffect(() => {
    const t = setTimeout(() => setHintDone(true), 3200);
    return () => clearTimeout(t);
  }, []);

  const calcPct = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const { left, width } = track.getBoundingClientRect();
    const travel = width - 40 - 12;
    const raw = ((clientX - left - 6) / travel) * 100;
    setDragPct(Math.max(0, Math.min(100, raw)));
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isDraggingRef.current = true;
    setIsDragging(true);
    calcPct(e.clientX);
  }, [calcPct]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    isDraggingRef.current = true;
    setIsDragging(true);
    calcPct(e.touches[0].clientX);
  }, [calcPct]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (isDraggingRef.current) calcPct(e.clientX); };
    const onUp = () => { isDraggingRef.current = false; setIsDragging(false); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [calcPct]);

  useEffect(() => {
    const onMove = (e: TouchEvent) => { if (isDraggingRef.current) calcPct(e.touches[0].clientX); };
    const onEnd = () => { isDraggingRef.current = false; setIsDragging(false); };
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [calcPct]);

  // Fire transition when slider reaches the right end
  useEffect(() => {
    if (dragPct >= 98 && !transitionedRef.current) {
      transitionedRef.current = true;
      setSliderComplete(true);
    }
  }, [dragPct]);

  // ── Video crossfade (dashboard loop) ──────────────────────────
  const doSwap = useCallback(() => {
    if (crossfadingRef.current) return;
    crossfadingRef.current = true;

    const active = activeRef.current;
    const standby = active === 'A' ? 'B' : 'A';
    const standbyEl = standby === 'A' ? videoA.current : videoB.current;

    if (!standbyEl) { crossfadingRef.current = false; return; }

    standbyEl.currentTime = 0;

    if (standby === 'A') { setOpacityA(1); setOpacityB(0); }
    else { setOpacityA(0); setOpacityB(1); }

    setTimeout(() => {
      activeRef.current = standby;
      crossfadingRef.current = false;
    }, CROSSFADE_MS);
  }, []);

  useEffect(() => {
    const vA = videoA.current;
    const vB = videoB.current;
    if (!vA || !vB) return;

    vA.src = DASH_VIDEO;
    vB.src = DASH_VIDEO;
    vA.play().catch(() => { });
    vB.play().catch(() => { });

    const tick = () => {
      // Stop the dash-loop RAF once transition is triggered
      if (transitionedRef.current) return;
      if (!crossfadingRef.current) {
        const activeEl = activeRef.current === 'A' ? vA : vB;
        if (activeEl.duration) {
          const remaining = activeEl.duration - activeEl.currentTime;
          if (remaining > 0 && remaining <= TRIGGER_BEFORE_END_S) doSwap();
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => { cancelAnimationFrame(rafRef.current); vA.pause(); vB.pause(); };
  }, [doSwap]);

  // ── When slider completes: swap to level-1 transition video ───
  useEffect(() => {
    if (!sliderComplete) return;

    const vA = videoA.current;
    const vB = videoB.current;
    if (!vA || !vB) return;

    // Cancel the RAF loop so it stops trying to do dashboard crossfades
    cancelAnimationFrame(rafRef.current);

    const standby = activeRef.current === 'A' ? 'B' : 'A';
    const standbyEl = standby === 'A' ? vA : vB;
    const activeEl = activeRef.current === 'A' ? vA : vB;

    // Stop dashboard looping on the active element
    activeEl.loop = false;

    // Load transition video (plays once)
    standbyEl.loop = false;
    standbyEl.src = LEVEL1_VIDEO;
    standbyEl.load();
    standbyEl.play().catch(() => { });

    // Crossfade: bring transition video forward
    if (standby === 'A') { setOpacityA(1); setOpacityB(0); }
    else { setOpacityA(0); setOpacityB(1); }

    setTimeout(() => {
      activeEl.pause();
      activeRef.current = standby;

      const onEndedVid2 = () => {
        standbyEl.removeEventListener('ended', onEndedVid2);
        setVid2Complete(true);
      };
      standbyEl.addEventListener('ended', onEndedVid2);
    }, CROSSFADE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sliderComplete]);

  // ── Play Vid 3 and redirect to round1 ──
  const playVid3 = useCallback(() => {
    setIsPlayingVid3(true);
    const vA = videoA.current;
    const vB = videoB.current;
    if (!vA || !vB) return;

    const standby = activeRef.current === 'A' ? 'B' : 'A';
    const standbyEl = standby === 'A' ? vA : vB;
    const activeEl = activeRef.current === 'A' ? vA : vB;

    standbyEl.loop = false;
    standbyEl.src = VID3_VIDEO;
    standbyEl.load();
    standbyEl.play().catch(() => {});

    if (standby === 'A') { setOpacityA(1); setOpacityB(0); }
    else { setOpacityA(0); setOpacityB(1); }

    setTimeout(() => {
      activeEl.pause();
      activeRef.current = standby;

      const onEnded = () => {
        standbyEl.removeEventListener('ended', onEnded);
        router.push('/round1');
      };
      standbyEl.addEventListener('ended', onEnded);
    }, CROSSFADE_MS);
  }, [router]);

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', overflow: 'hidden', background: '#000' }}>

      {/* Video A */}
      <video ref={videoA} muted playsInline loop preload="auto" style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'cover', opacity: opacityA,
        transition: `opacity ${CROSSFADE_MS}ms ease-in-out`, zIndex: 1,
      }} />

      {/* Video B */}
      <video ref={videoB} muted playsInline loop preload="auto" style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'cover', opacity: opacityB,
        transition: `opacity ${CROSSFADE_MS}ms ease-in-out`, zIndex: 2,
      }} />

      {/* ── DIM OVERLAY — darkens all videos uniformly ── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.35)',
        zIndex: 3,
        pointerEvents: 'none',
      }} />

      {/* ── Middle-Left Button to Trigger vid3 ── */}
      {vid2Complete && !isPlayingVid3 && (
        <button
          onClick={playVid3}
          style={{
            position: 'absolute',
            top: '50%',
            left: '10%',
            zIndex: 9999,
            pointerEvents: 'auto',
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
            border: '2px solid rgba(100,210,255,0.6)',
            color: '#fff',
            fontFamily: 'var(--font-minecraft), system-ui, sans-serif',
            fontSize: '18px',
            cursor: 'var(--mv-cursor-hand-closed)',
            boxShadow: '0 0 12px rgba(100,210,255,0.5)',
            animation: 'btn-float-up 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
          }}
          className="scene-btn"
        >
          Play Video 3
        </button>
      )}

      {/* ── SCENE IMAGES — fade out when slider completes ── */}


      {/* TEXT 1 — 3D block "Dashboard" title, centered upper area */}
      <div style={{
        position: 'absolute',
        top: '8%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 8,
        pointerEvents: 'none',
        opacity: sliderComplete ? 0 : 1,
        transition: 'opacity 0.7s ease-out',
        width: 'clamp(320px, 68vw, 900px)',
      }}>
        <Image
          src="/text1.png"
          alt="Dashboard"
          width={700}
          height={300}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            filter: 'drop-shadow(0 12px 40px rgba(0,0,0,0.7))',
          }}
          priority
        />
      </div>

      {/* TEXT 2 — Wooden sign "Welcome to Mineverse 2.0", centered below text1 */}
      <div style={{
        position: 'absolute',
        top: '34%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 8,
        pointerEvents: 'none',
        opacity: sliderComplete ? 0 : 1,
        transition: 'opacity 0.7s ease-out',
        width: 'clamp(200px, 44vw, 620px)',
      }}>
        <Image
          src="/text2.png"
          alt="Welcome to Mineverse 2.0"
          width={620}
          height={80}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            filter: 'drop-shadow(0 6px 20px rgba(0,0,0,0.75))',
          }}
          priority
        />
      </div>

      {/* Steve — click to toggle player list */}
      <div
        role="button"
        tabIndex={sliderComplete ? -1 : 0}
        onClick={() => !sliderComplete && setShowPlayerList(p => !p)}
        style={{
          position: 'absolute', bottom: '46%', left: '-1%', zIndex: 10,
          width: 'clamp(240px, 30vw, 520px)',
          opacity: sliderComplete ? 0 : 1,
          transition: 'opacity 0.7s ease-out, transform 0.18s ease',
          cursor: sliderComplete ? 'var(--mv-cursor-sword)' : 'var(--mv-cursor-pickaxe)',
          outline: 'none',
        }}
        className="scene-btn steve-btn"
      >
        <Image src="/steve.png" alt="Steve" width={680} height={560}
          style={{ width: '100%', height: 'auto', display: 'block', filter: 'drop-shadow(0 12px 32px rgba(0,0,0,0.65))' }}
          priority />
      </div>

      {/* Player list panel — bottom-left, toggled by Steve */}
      {showPlayerList && !sliderComplete && (
        <div style={{
          position: 'absolute', bottom: '4%', left: '1%', zIndex: 20,
          minWidth: '210px',
          animation: 'mc-playerlist-in 0.22s ease-out forwards',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(0,0,0,0.72)',
            borderBottom: '1px solid rgba(255,255,255,0.12)',
            padding: '4px 10px',
            display: 'flex', alignItems: 'center',
          }}>
            <span style={{
              color: 'rgba(255,255,255,0.55)', fontSize: '9px',
              fontFamily: 'var(--font-minecraft), system-ui, sans-serif',
              letterSpacing: '2px', textTransform: 'uppercase',
            }}>Team ({TEAM_PLAYERS.length} players)</span>
          </div>
          {TEAM_PLAYERS.map((player) => (
            <div key={player.name} style={{
              background: 'rgba(0,0,0,0.68)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <div style={{
                width: '20px', height: '20px',
                background: 'rgba(80,60,40,0.8)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '2px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', flexShrink: 0,
              }}>{player.icon}</div>
              <span style={{
                color: '#ffffff', fontSize: '10px',
                fontFamily: 'var(--font-minecraft), system-ui, sans-serif',
                letterSpacing: '0.5px',
                textShadow: '1px 1px 0 rgba(0,0,0,0.9)', flex: 1,
              }}>{player.name}</span>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '14px' }}>
                {[1,2,3,4].map(bar => (
                  <div key={bar} style={{
                    width: '3px', height: `${bar * 3 + 2}px`,
                    background: bar <= player.ping ? '#55FF55' : 'rgba(255,255,255,0.15)',
                    borderRadius: '1px',
                  }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Crafting Table — click shows "coming soon" toast */}
      <div
        role="button"
        tabIndex={sliderComplete ? -1 : 0}
        onClick={() => !sliderComplete && showToast('🪵', 'Coming Soon!', 'Crafting Table is not accessible right now')}
        style={{
          position: 'absolute', bottom: '28%', right: '19%', zIndex: 10,
          width: 'clamp(160px, 18vw, 300px)',
          opacity: sliderComplete ? 0 : 1,
          transition: 'opacity 0.7s ease-out, transform 0.18s ease',
          cursor: sliderComplete ? 'var(--mv-cursor-sword)' : 'var(--mv-cursor-pickaxe)',
          outline: 'none',
        }}
        className="scene-btn crafting-btn"
      >
        {/* Counter badge */}
        <div style={{
          position: 'absolute', top: '15%', right: '15%', zIndex: 20,
          background: 'linear-gradient(135deg,#1a1a2e,#16213e)',
          border: '2px solid rgba(100,210,255,0.6)',
          borderRadius: '50%', width: '32px', height: '32px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(100,210,255,0.9)', fontSize: '13px', fontWeight: 700,
          fontFamily: 'var(--font-minecraft), system-ui, sans-serif',
          boxShadow: '0 0 12px rgba(100,210,255,0.5)',
        }}>0</div>
        <Image src="/crafting.png" alt="Crafting Table" width={680} height={500}
          style={{ width: '100%', height: 'auto', display: 'block', filter: 'drop-shadow(0 8px 28px rgba(0,0,0,0.65))' }}
          priority />
      </div>

      {/* Trader + Llama — click shows "coming soon" toast */}
      <div
        role="button"
        tabIndex={sliderComplete ? -1 : 0}
        onClick={() => !sliderComplete && showToast('🧙', 'Coming Soon!', 'Wandering Trader is not accessible right now')}
        style={{
          position: 'absolute', bottom: -19, right: '-5%', zIndex: 10,
          width: 'clamp(260px, 60vw, 560px)',
          opacity: sliderComplete ? 0 : 1,
          transition: 'opacity 0.7s ease-out, transform 0.18s ease',
          cursor: sliderComplete ? 'var(--mv-cursor-sword)' : 'var(--mv-cursor-pickaxe)',
          outline: 'none',
        }}
        className="scene-btn trader-btn"
      >
        {/* Counter badge */}
        <div style={{
          position: 'absolute', top: '28%', left: '38%', zIndex: 20,
          background: 'linear-gradient(135deg,#1a1a2e,#16213e)',
          border: '2px solid rgba(255,180,60,0.7)',
          borderRadius: '50%', width: '32px', height: '32px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,200,80,0.95)', fontSize: '13px', fontWeight: 700,
          fontFamily: 'var(--font-minecraft), system-ui, sans-serif',
          boxShadow: '0 0 12px rgba(255,180,60,0.5)',
        }}>0</div>
        <Image src="/traderbg.png" alt="Wandering Trader" width={900} height={800}
          style={{ width: '100%', height: 'auto', display: 'block', filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.6))' }}
          priority />
      </div>

      {/* Minecraft advancement toast — top-right */}
      {toast && (
        <div key={toast.key} style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
          display: 'flex', alignItems: 'center',
          background: 'rgba(14,14,14,0.92)',
          border: '2px solid rgba(80,80,80,0.9)',
          borderRadius: '4px', overflow: 'hidden',
          boxShadow: '4px 4px 0 rgba(0,0,0,0.8)',
          minWidth: '260px', maxWidth: '340px',
          animation: 'mc-toast-in 0.35s cubic-bezier(0.22,1,0.36,1) forwards',
          pointerEvents: 'none',
          fontFamily: 'var(--font-minecraft), system-ui, sans-serif',
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
              color: '#FFAA00', fontSize: '11px', fontWeight: 700,
              letterSpacing: '0.5px', textShadow: '1px 1px 0 rgba(0,0,0,0.9)', lineHeight: 1.2,
            }}>{toast.title}</div>
            <div style={{
              color: 'rgba(255,255,255,0.88)', fontSize: '10px',
              letterSpacing: '0.3px', textShadow: '1px 1px 0 rgba(0,0,0,0.9)', lineHeight: 1.3,
            }}>{toast.subtitle}</div>
          </div>
        </div>
      )}

      {/* ── DRAG SLIDER ── */}
      <style>{`
        @keyframes drag-thumb-once {
          0%   { left: 6px;               opacity: 1; }
          60%  { left: calc(100% - 46px); opacity: 1; }
          85%  { left: calc(100% - 46px); opacity: 0; }
          100% { left: 6px;               opacity: 0; }
        }
        @keyframes drag-trail-once {
          0%   { width: 0px;               opacity: 0; }
          8%   {                           opacity: 0.85; }
          60%  { width: calc(100% - 52px); opacity: 0.85; }
          85%  { width: calc(100% - 52px); opacity: 0; }
          100% { width: 0px;               opacity: 0; }
        }
        @keyframes drag-chevron-hint {
          0%, 100% { opacity: 0.2; transform: translateX(0px); }
          50%      { opacity: 0.9; transform: translateX(6px); }
        }
        @keyframes drag-label-pulse {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }
        @keyframes slider-done-pulse {
          0%, 100% { box-shadow: 0 2px 20px rgba(80,220,120,0.6), 0 0 0 4px rgba(80,220,120,0.2); }
          50%      { box-shadow: 0 2px 28px rgba(80,220,120,1),   0 0 0 8px rgba(80,220,120,0.35); }
        }

        @keyframes btn-float-up {
          0% { opacity: 0; transform: translateY(40px); }
          100% { opacity: 1; transform: translateY(-50%); }
        }

        /* ── Scene character hover glow ── */
        .scene-btn { position: relative; }

        .steve-btn:hover, .steve-btn:focus-visible {
          filter: drop-shadow(0 12px 32px rgba(0,0,0,0.65))
                  drop-shadow(0 0 22px rgba(100,200,255,0.75))
                  brightness(1.12) !important;
          z-index: 50 !important;
        }
        .steve-btn:active { transform: scale(0.96) !important; }

        .crafting-btn:hover, .crafting-btn:focus-visible {
          filter: drop-shadow(0 8px 28px rgba(0,0,0,0.65))
                  drop-shadow(0 0 26px rgba(100,210,255,0.8))
                  brightness(1.15) !important;
          z-index: 50 !important;
        }
        .crafting-btn:active { transform: scale(0.94) !important; }

        .trader-btn:hover, .trader-btn:focus-visible {
          filter: drop-shadow(0 10px 30px rgba(0,0,0,0.6))
                  drop-shadow(0 0 28px rgba(255,190,60,0.75))
                  brightness(1.12) !important;
          z-index: 50 !important;
        }
        .trader-btn:active { transform: scale(0.96) !important; }

        /* ── Toast slide-in from right ── */
        @keyframes mc-toast-in {
          from { opacity: 0; transform: translateX(110%); }
          to   { opacity: 1; transform: translateX(0); }
        }

        /* ── Player list slide up ── */
        @keyframes mc-playerlist-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

      `}</style>

      {/* Hide the entire slider once transition fires */}
      {!sliderComplete && (
        <div style={{
          position: 'absolute', bottom: '9%', left: '50%',
          transform: 'translateX(-50%)', zIndex: 15,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
          width: '60%', maxWidth: '680px', minWidth: '320px',
          pointerEvents: hintDone ? 'auto' : 'none',
        }}>
          {/* Label */}
          <div style={{
            color: 'rgba(255,255,255,0.9)', fontSize: '10px', letterSpacing: '4px',
            textTransform: 'uppercase', fontFamily: 'var(--font-minecraft), system-ui, sans-serif',
            textShadow: '0 0 20px rgba(0,0,0,1), 0 2px 6px rgba(0,0,0,0.9)',
            animation: hintDone ? 'none' : 'drag-label-pulse 2s ease-in-out infinite',
            opacity: hintDone ? 0.85 : undefined,
          }}>
            drag to explore
          </div>

          {/* Track */}
          <div ref={trackRef}
            onMouseDown={hintDone ? onMouseDown : undefined}
            onTouchStart={hintDone ? onTouchStart : undefined}
            style={{
              position: 'relative', width: '100%', height: '52px',
              cursor: hintDone ? (isDragging ? 'var(--mv-cursor-hand-closed)' : 'var(--mv-cursor-hand-open)') : 'var(--mv-cursor-sword)',
              userSelect: 'none', WebkitUserSelect: 'none',
            }}
          >
            {/* Frosted pill */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)', borderRadius: '26px',
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 4px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
            }} />

            {/* Dashed rail */}
            <div style={{
              position: 'absolute', left: '52px', right: '52px', top: '50%',
              height: '2px', marginTop: '-1px',
              backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.4) 0 7px, transparent 7px 14px)',
            }} />

            {/* Hint trail (one-shot) */}
            {!hintDone && (
              <div style={{
                position: 'absolute', left: '26px', top: '50%', height: '3px',
                marginTop: '-1.5px', width: '0px',
                background: 'linear-gradient(90deg, rgba(100,210,255,1), rgba(60,160,255,0.3))',
                borderRadius: '2px', boxShadow: '0 0 10px rgba(100,210,255,0.8)',
                animation: 'drag-trail-once 2.8s cubic-bezier(0.25,0,0.2,1) 1 forwards',
              }} />
            )}

            {/* Interactive fill bar */}
            {hintDone && (
              <div style={{
                position: 'absolute', left: '26px', top: '50%', height: '3px',
                marginTop: '-1.5px',
                width: `calc((100% - 52px) * ${dragPct / 100})`,
                background: 'linear-gradient(90deg, rgba(100,210,255,1), rgba(60,160,255,0.3))',
                borderRadius: '2px', boxShadow: '0 0 10px rgba(100,210,255,0.8)',
                transition: isDragging ? 'none' : 'width 0.05s linear',
              }} />
            )}

            {/* Left dot */}
            <div style={{
              position: 'absolute', left: '14px', top: '50%',
              width: '12px', height: '12px', marginTop: '-6px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.6)', border: '2px solid rgba(255,255,255,0.9)',
              boxShadow: '0 0 10px rgba(255,255,255,0.5)',
            }} />

            {/* Right dot */}
            <div style={{
              position: 'absolute', right: '14px', top: '50%',
              width: '12px', height: '12px', marginTop: '-6px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)', border: '2px solid rgba(255,255,255,0.5)',
            }} />

            {/* Hint chevrons */}
            {!hintDone && [0, 1, 2].map((i) => (
              <div key={i} style={{
                position: 'absolute', left: `${36 + i * 11}%`, top: '50%', marginTop: '-9px',
                color: 'rgba(255,255,255,0.4)', fontSize: '18px', lineHeight: 1,
                animation: 'drag-chevron-hint 1s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }}>›</div>
            ))}

            {/* Hint thumb (one-shot) */}
            {!hintDone && (
              <div style={{
                position: 'absolute', top: '50%', marginTop: '-20px', left: '6px',
                width: '40px', height: '40px', borderRadius: '50%',
                background: 'radial-gradient(circle at 36% 32%, #ffffff, #c8e8ff)',
                border: '2px solid rgba(255,255,255,0.95)',
                boxShadow: '0 2px 20px rgba(80,180,255,0.85), 0 0 0 4px rgba(100,210,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'drag-thumb-once 2.8s cubic-bezier(0.25,0,0.2,1) 1 forwards',
              }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path d="M4 10H16M16 10L11 5M16 10L11 15" stroke="#1a5c8a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}

            {/* Interactive thumb */}
            {hintDone && (
              <div
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
                style={{
                  position: 'absolute', top: '50%', marginTop: '-20px',
                  left: `calc(6px + (100% - 52px) * ${dragPct / 100})`,
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: 'radial-gradient(circle at 36% 32%, #ffffff, #c8e8ff)',
                  border: '2px solid rgba(255,255,255,0.95)',
                  boxShadow: '0 2px 20px rgba(80,180,255,0.85), 0 0 0 4px rgba(100,210,255,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: isDragging ? 'var(--mv-cursor-hand-closed)' : 'var(--mv-cursor-hand-open)',
                  transition: isDragging ? 'none' : 'left 0.05s linear',
                  touchAction: 'none',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path d="M4 10H16M16 10L11 5M16 10L11 15" stroke="#1a5c8a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
