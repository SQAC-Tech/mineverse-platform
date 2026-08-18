'use client';

import Image from 'next/image';
import { useRef, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { RoundPortals, type DashboardRound } from '@/features/dashboard/round-portals';
import { supabaseClient } from '@/lib/supabase/client';

export function VideoBackground() {
  const router = useRouter();

  // ── Round data driving the four portals ───────────────────────
  const [rounds, setRounds] = useState<DashboardRound[]>([]);
  const [devUnlock, setDevUnlock] = useState(false);

  // ── Team identity & resources ─────────────────────────────────
  const [teamName, setTeamName] = useState<string | null>(null);
  const [resources, setResources] = useState<Record<string, number>>({});

  // ── Toast notification ────────────────────────────────────────
  const [toast, setToast] = useState<{ icon: string; title: string; subtitle: string; key: number } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (icon: string, title: string, subtitle: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ icon, title, subtitle, key: Date.now() });
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  };

  // ── Map Modal (Steve click trigger) ───────────────────────────
  const [showMapModal, setShowMapModal] = useState(false);

  // Close map modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMapModal(false);
    };
    if (showMapModal) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showMapModal]);

  // ── Transition Video ────────────────────────────────────────
  const [transitionTarget, setTransitionTarget] = useState<string | null>(null);
  const transitionVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!transitionTarget) return;
    const v = transitionVideoRef.current;
    if (v) {
      v.currentTime = 0;
      v.play().catch(() => {
        v.muted = true;
        v.play().catch(() => { });
      });
    }
  }, [transitionTarget]);

  // ── Fetch the team's round state so the portals know what is enterable ──
  const fetchRounds = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/data', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setRounds(json.rounds ?? []);
        setDevUnlock(Boolean(json.dev_unlock));
        if (json.team?.name) setTeamName(json.team.name);
        if (json.resources) setResources(json.resources);
      }
    } catch {
      // The portals still render; they stay locked until a fetch succeeds.
    }
  }, []);

  useEffect(() => {
    void fetchRounds();
    const poll = window.setInterval(fetchRounds, 10000);
    return () => window.clearInterval(poll);
  }, [fetchRounds]);

  // Refetch when an admin unlocks a round mid-session.
  useEffect(() => {
    const channel = supabaseClient
      .channel('round_status')
      .on('broadcast', { event: 'unlock' }, () => void fetchRounds())
      .subscribe();

    return () => {
      void supabaseClient.removeChannel(channel);
    };
  }, [fetchRounds]);

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', overflow: 'hidden', background: '#000' }}>

      {/* Static Background Image: background1.webp */}
      <Image
        src="/background1.webp"
        alt="Dashboard Background"
        fill
        priority
        style={{
          objectFit: 'cover',
          zIndex: 1,
        }}
      />

      {/* Top Left Logo */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 50,
        width: 'clamp(70px, 8vw, 130px)',
        pointerEvents: 'none',
      }}>
        <Image
          src="/logo1.svg"
          alt="Mineverse Logo"
          width={180}
          height={60}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.6))',
          }}
          priority
        />
      </div>

      {/* Player Statistics HUD */}
      <div className="stats-hud">
        {/* Team name header */}
        <div style={{ fontSize: '11px', borderBottom: '2px solid #555', paddingBottom: '6px', marginBottom: '2px', textAlign: 'center', color: '#ffff55', letterSpacing: '1px' }}>
          {teamName ?? 'LOADING...'}
        </div>
        <div style={{ fontSize: '9px', textAlign: 'center', color: '#aaaaaa', letterSpacing: '1px', marginBottom: '4px' }}>RESOURCES</div>
        {[
          { label: 'WOOD',     key: 'wood',     color: '#c8a87a' },
          { label: 'STONE',    key: 'stone',    color: '#aaaaaa' },
          { label: 'IRON',     key: 'iron',     color: '#d8d8d8' },
          { label: 'GOLD',     key: 'gold',     color: '#ffaa00' },
          { label: 'DIAMOND',  key: 'diamond',  color: '#55ffff' },
          { label: 'EMERALD',  key: 'emerald',  color: '#55ff55' },
          { label: 'OBSIDIAN', key: 'obsidian', color: '#9966cc' },
        ].map(({ label, key, color }) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '12px' }}>
            <span style={{ color: '#cccccc' }}>{label}</span>
            <span style={{ color, fontWeight: 'bold' }}>{resources[key] ?? 0}</span>
          </div>
        ))}
      </div>

      {/* DASHBOARD TITLE — dashboard.webp */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 8,
        pointerEvents: 'none',
        width: 'clamp(320px, 64vw, 880px)',
      }}>
        <Image
          src="/dashboard.webp"
          alt="Dashboard"
          width={880}
          height={350}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            filter: 'drop-shadow(0 12px 40px rgba(0,0,0,0.7))',
          }}
          priority
        />
      </div>

      {/* Steve — click to open map modal */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setShowMapModal(true)}
        style={{
          position: 'absolute', bottom: '230px', left: '30px', zIndex: 10,
          width: 'clamp(200px, 25vw, 420px)',
          transition: 'transform 0.18s ease',
          cursor: 'var(--mv-cursor-pickaxe)',
          outline: 'none',
        }}
        className="scene-btn steve-btn"
      >
        {/* Floating map hint — also clickable */}
        <button
          type="button"
          onClick={() => setShowMapModal(true)}
          style={{
            position: 'absolute',
            top: '-35px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(20, 24, 30, 0.9)',
            border: '2px solid #a0a0a0',
            borderRadius: '4px',
            padding: '8px 12px',
            color: '#ffffff',
            fontFamily: 'var(--font-minecraft), system-ui, sans-serif',
            fontSize: 'clamp(10px, 1.2vw, 14px)',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            textShadow: '1px 2px 2px rgba(0,0,0,0.8)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.8), 0 0 10px rgba(255,255,255,0.2)',
            animation: 'float-bounce 2s ease-in-out infinite',
            cursor: 'pointer',
          }}
        >
          CLICK TO OPEN MAP
        </button>
        <Image src="/steve.svg" alt="Steve" width={680} height={560}
          style={{ width: '100%', height: 'auto', display: 'block', filter: 'drop-shadow(0 12px 32px rgba(0,0,0,0.65))' }}
          priority />
      </div>

      {/* ── FULL SCREEN MAP (Triggered by Steve) ── */}
      {showMapModal && (
        <div
          onClick={() => setShowMapModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0, 0, 0, 0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            cursor: 'pointer',
            animation: 'mc-backdrop-fade 0.25s ease-out forwards',
          }}
        >
          {/* Map Wrapper with Hotspot Overlay */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              maxHeight: '100vh',
              maxWidth: '100vw',
              aspectRatio: '1024 / 815',
              margin: 'auto',
            }}
          >
            {(() => {
              const r5 = rounds.find(r => r.round_id === 5)?.can_enter;
              const r4 = rounds.find(r => r.round_id === 4)?.can_enter;
              const r3 = rounds.find(r => r.round_id === 3)?.can_enter;
              const r2 = rounds.find(r => r.round_id === 2)?.can_enter;

              let imgSrc = '/map.webp';
              if (r5) imgSrc = '/final-biome-map.jpg';
              else if (r4) imgSrc = '/nether-biome-map.jpg';
              else if (r3) imgSrc = '/mountain-biome-map.jpg';
              else if (r2) imgSrc = '/cave-biome-map.jpg';

              return (
                <img
                  src={imgSrc}
                  alt="World Map"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                    animation: 'map-pop-in 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
                    filter: 'drop-shadow(0 0 40px rgba(0,0,0,0.9))',
                  }}
                />
              );
            })()}

            {/* Access Forest & Grassland Region Button (Backend Linked to Round 1) */}
            {(() => {
              const round1 = rounds.find(r => r.round_id === 1);
              const enterable = round1?.can_enter ?? false;
              const completed = Boolean(round1?.completed_at);

              return (
                <button
                  type="button"
                  disabled={!enterable}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (enterable) {
                      setShowMapModal(false);
                      setTransitionTarget('/round1');
                    }
                  }}
                  style={{
                    position: 'absolute',
                    top: '25%',
                    left: '65%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 100,
                    background: enterable
                      ? 'linear-gradient(135deg, rgba(20, 90, 40, 0.95), rgba(10, 45, 20, 0.96))'
                      : 'rgba(30, 34, 42, 0.92)',
                    border: `2px solid ${enterable ? '#55ff55' : 'rgba(140, 150, 170, 0.4)'}`,
                    borderRadius: '6px',
                    padding: '10px 20px',
                    color: enterable ? '#ffffff' : 'rgba(255, 255, 255, 0.45)',
                    fontFamily: 'var(--font-minecraft), system-ui, sans-serif',
                    fontSize: 'clamp(11px, 1.2vw, 15px)',
                    fontWeight: 'bold',
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    textShadow: enterable ? '1px 2px 4px rgba(0,0,0,0.9)' : 'none',
                    boxShadow: enterable
                      ? '0 0 20px rgba(85, 255, 85, 0.6), 0 6px 16px rgba(0, 0, 0, 0.8)'
                      : '0 4px 12px rgba(0, 0, 0, 0.6)',
                    cursor: enterable ? 'var(--mv-cursor-pickaxe, pointer)' : 'not-allowed',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    animation: enterable ? 'pulse-forest-btn 2s infinite alternate' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (enterable) {
                      e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.08)';
                      e.currentTarget.style.boxShadow = '0 0 32px rgba(85, 255, 85, 0.95), 0 8px 24px rgba(0, 0, 0, 0.9)';
                      e.currentTarget.style.borderColor = '#aaffaa';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (enterable) {
                      e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)';
                      e.currentTarget.style.boxShadow = '0 0 20px rgba(85, 255, 85, 0.6), 0 6px 16px rgba(0, 0, 0, 0.8)';
                      e.currentTarget.style.borderColor = '#55ff55';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{enterable ? (completed ? '🔄' : '🌲') : '🔒'}</span>
                    <span>{completed ? 'REPLAY FOREST BIOME' : enterable ? 'ACCESS FOREST BIOME' : 'FOREST BIOME LOCKED'}</span>
                  </div>
                  {round1?.unlocked_by_dev_mode && (
                    <span style={{ fontSize: '9px', color: '#ffcc00', letterSpacing: '1px' }}>DEV UNLOCKED</span>
                  )}
                </button>
              );
            })()}

            {/* Access Cave Biome Button (Backend Linked to Round 2) */}
            {(() => {
              const round1 = rounds.find(r => r.round_id === 1);
              const round2 = rounds.find(r => r.round_id === 2);

              // Only show the Cave Biome button if Forest is completed, OR Cave (or any later round) is unlocked
              const isR2OrLater = round2?.can_enter || rounds.some(r => r.round_id > 2 && r.can_enter);
              if (!round1?.completed_at && !isR2OrLater) return null;

              const enterable = round2?.can_enter ?? false;
              const completed = Boolean(round2?.completed_at);

              return (
                <button
                  type="button"
                  disabled={!enterable}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (enterable) {
                      setShowMapModal(false);
                      setTransitionTarget('/round2');
                    }
                  }}
                  style={{
                    position: 'absolute',
                    top: '65%',
                    left: '35%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 100,
                    background: enterable
                      ? 'linear-gradient(135deg, rgba(70, 70, 80, 0.95), rgba(40, 40, 50, 0.96))'
                      : 'rgba(30, 34, 42, 0.92)',
                    border: `2px solid ${enterable ? '#a0a0b0' : 'rgba(140, 150, 170, 0.4)'}`,
                    borderRadius: '6px',
                    padding: '10px 20px',
                    color: enterable ? '#ffffff' : 'rgba(255, 255, 255, 0.45)',
                    fontFamily: 'var(--font-minecraft), system-ui, sans-serif',
                    fontSize: 'clamp(11px, 1.2vw, 15px)',
                    fontWeight: 'bold',
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    textShadow: enterable ? '1px 2px 4px rgba(0,0,0,0.9)' : 'none',
                    boxShadow: enterable
                      ? '0 0 20px rgba(180, 180, 200, 0.6), 0 6px 16px rgba(0, 0, 0, 0.8)'
                      : '0 4px 12px rgba(0, 0, 0, 0.6)',
                    cursor: enterable ? 'var(--mv-cursor-pickaxe, pointer)' : 'not-allowed',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    animation: enterable ? 'pulse-cave-btn 2s infinite alternate' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (enterable) {
                      e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.08)';
                      e.currentTarget.style.boxShadow = '0 0 32px rgba(180, 180, 200, 0.95), 0 8px 24px rgba(0, 0, 0, 0.9)';
                      e.currentTarget.style.borderColor = '#d0d0e0';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (enterable) {
                      e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)';
                      e.currentTarget.style.boxShadow = '0 0 20px rgba(180, 180, 200, 0.6), 0 6px 16px rgba(0, 0, 0, 0.8)';
                      e.currentTarget.style.borderColor = '#a0a0b0';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{enterable ? (completed ? '🔄' : '⛏️') : '🔒'}</span>
                    <span>{completed ? 'REPLAY CAVE BIOME' : enterable ? 'ACCESS CAVE BIOME' : 'CAVE BIOME LOCKED'}</span>
                  </div>
                  {round2?.unlocked_by_dev_mode && (
                    <span style={{ fontSize: '9px', color: '#ffcc00', letterSpacing: '1px' }}>DEV UNLOCKED</span>
                  )}
                </button>
              );
            })()}

            {/* Access Mountain Biome Button (Round 3) */}
            {(() => {
              const round2 = rounds.find(r => r.round_id === 2);
              const round3 = rounds.find(r => r.round_id === 3);

              const isR3OrLater = round3?.can_enter || rounds.some(r => r.round_id > 3 && r.can_enter);
              if (!round2?.completed_at && !isR3OrLater) return null;

              const enterable = round3?.can_enter ?? false;
              const completed = Boolean(round3?.completed_at);

              return (
                <button
                  type="button"
                  disabled={!enterable}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (enterable) {
                      setShowMapModal(false);
                      setTransitionTarget('/round3');
                    }
                  }}
                  style={{
                    position: 'absolute',
                    top: '30%',
                    left: '35%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 100,
                    background: enterable
                      ? 'linear-gradient(135deg, rgba(80, 120, 150, 0.95), rgba(40, 70, 90, 0.96))'
                      : 'rgba(30, 34, 42, 0.92)',
                    border: `2px solid ${enterable ? '#aaddff' : 'rgba(140, 150, 170, 0.4)'}`,
                    borderRadius: '6px',
                    padding: '10px 20px',
                    color: enterable ? '#ffffff' : 'rgba(255, 255, 255, 0.45)',
                    fontFamily: 'var(--font-minecraft), system-ui, sans-serif',
                    fontSize: 'clamp(11px, 1.2vw, 15px)',
                    fontWeight: 'bold',
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    textShadow: enterable ? '1px 2px 4px rgba(0,0,0,0.9)' : 'none',
                    boxShadow: enterable
                      ? '0 0 20px rgba(170, 220, 255, 0.6), 0 6px 16px rgba(0, 0, 0, 0.8)'
                      : '0 4px 12px rgba(0, 0, 0, 0.6)',
                    cursor: enterable ? 'var(--mv-cursor-pickaxe, pointer)' : 'not-allowed',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  }}
                  onMouseEnter={(e) => {
                    if (enterable) {
                      e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.08)';
                      e.currentTarget.style.boxShadow = '0 0 32px rgba(170, 220, 255, 0.95), 0 8px 24px rgba(0, 0, 0, 0.9)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (enterable) {
                      e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)';
                      e.currentTarget.style.boxShadow = '0 0 20px rgba(170, 220, 255, 0.6), 0 6px 16px rgba(0, 0, 0, 0.8)';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{enterable ? (completed ? '🔄' : '❄️') : '🔒'}</span>
                    <span>{completed ? 'REPLAY MOUNTAIN BIOME' : enterable ? 'ACCESS MOUNTAIN BIOME' : 'MOUNTAIN BIOME LOCKED'}</span>
                  </div>
                  {round3?.unlocked_by_dev_mode && (
                    <span style={{ fontSize: '9px', color: '#ffcc00', letterSpacing: '1px' }}>DEV UNLOCKED</span>
                  )}
                </button>
              );
            })()}

            {/* Access Nether Biome Button (Round 4) */}
            {(() => {
              const round3 = rounds.find(r => r.round_id === 3);
              const round4 = rounds.find(r => r.round_id === 4);

              const isR4OrLater = round4?.can_enter || rounds.some(r => r.round_id > 4 && r.can_enter);
              if (!round3?.completed_at && !isR4OrLater) return null;

              const enterable = round4?.can_enter ?? false;
              const completed = Boolean(round4?.completed_at);

              return (
                <button
                  type="button"
                  disabled={!enterable}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (enterable) {
                      setShowMapModal(false);
                      setTransitionTarget('/round4');
                    }
                  }}
                  style={{
                    position: 'absolute',
                    top: '65%',
                    left: '65%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 100,
                    background: enterable
                      ? 'linear-gradient(135deg, rgba(120, 40, 40, 0.95), rgba(70, 20, 20, 0.96))'
                      : 'rgba(30, 34, 42, 0.92)',
                    border: `2px solid ${enterable ? '#ff6666' : 'rgba(140, 150, 170, 0.4)'}`,
                    borderRadius: '6px',
                    padding: '10px 20px',
                    color: enterable ? '#ffffff' : 'rgba(255, 255, 255, 0.45)',
                    fontFamily: 'var(--font-minecraft), system-ui, sans-serif',
                    fontSize: 'clamp(11px, 1.2vw, 15px)',
                    fontWeight: 'bold',
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    textShadow: enterable ? '1px 2px 4px rgba(0,0,0,0.9)' : 'none',
                    boxShadow: enterable
                      ? '0 0 20px rgba(255, 100, 100, 0.6), 0 6px 16px rgba(0, 0, 0, 0.8)'
                      : '0 4px 12px rgba(0, 0, 0, 0.6)',
                    cursor: enterable ? 'var(--mv-cursor-pickaxe, pointer)' : 'not-allowed',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  }}
                  onMouseEnter={(e) => {
                    if (enterable) {
                      e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.08)';
                      e.currentTarget.style.boxShadow = '0 0 32px rgba(255, 100, 100, 0.95), 0 8px 24px rgba(0, 0, 0, 0.9)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (enterable) {
                      e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)';
                      e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 100, 100, 0.6), 0 6px 16px rgba(0, 0, 0, 0.8)';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{enterable ? (completed ? '🔄' : '🔥') : '🔒'}</span>
                    <span>{completed ? 'REPLAY NETHER BIOME' : enterable ? 'ACCESS NETHER BIOME' : 'NETHER BIOME LOCKED'}</span>
                  </div>
                  {round4?.unlocked_by_dev_mode && (
                    <span style={{ fontSize: '9px', color: '#ffcc00', letterSpacing: '1px' }}>DEV UNLOCKED</span>
                  )}
                </button>
              );
            })()}

            {/* Access The End Button (Round 5) */}
            {(() => {
              const round4 = rounds.find(r => r.round_id === 4);
              const round5 = rounds.find(r => r.round_id === 5);

              if (!round4?.completed_at && !round5?.can_enter) return null;

              const enterable = round5?.can_enter ?? false;
              const completed = Boolean(round5?.completed_at);

              return (
                <button
                  type="button"
                  disabled={!enterable}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (enterable) {
                      setShowMapModal(false);
                      setTransitionTarget('/round5');
                    }
                  }}
                  style={{
                    position: 'absolute',
                    top: '78%',
                    left: '75%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 100,
                    background: enterable
                      ? 'linear-gradient(135deg, rgba(140, 40, 180, 0.95), rgba(70, 20, 90, 0.96))'
                      : 'rgba(30, 34, 42, 0.92)',
                    border: `2px solid ${enterable ? '#dd88ff' : 'rgba(140, 150, 170, 0.4)'}`,
                    borderRadius: '6px',
                    padding: '10px 20px',
                    color: enterable ? '#ffffff' : 'rgba(255, 255, 255, 0.45)',
                    fontFamily: 'var(--font-minecraft), system-ui, sans-serif',
                    fontSize: 'clamp(11px, 1.2vw, 15px)',
                    fontWeight: 'bold',
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    textShadow: enterable ? '1px 2px 4px rgba(0,0,0,0.9)' : 'none',
                    boxShadow: enterable
                      ? '0 0 20px rgba(220, 140, 255, 0.6), 0 6px 16px rgba(0, 0, 0, 0.8)'
                      : '0 4px 12px rgba(0, 0, 0, 0.6)',
                    cursor: enterable ? 'var(--mv-cursor-pickaxe, pointer)' : 'not-allowed',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  }}
                  onMouseEnter={(e) => {
                    if (enterable) {
                      e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.08)';
                      e.currentTarget.style.boxShadow = '0 0 32px rgba(220, 140, 255, 0.95), 0 8px 24px rgba(0, 0, 0, 0.9)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (enterable) {
                      e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)';
                      e.currentTarget.style.boxShadow = '0 0 20px rgba(220, 140, 255, 0.6), 0 6px 16px rgba(0, 0, 0, 0.8)';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{enterable ? (completed ? '🔄' : '👁️') : '🔒'}</span>
                    <span>{completed ? 'REPLAY THE END' : enterable ? 'ACCESS THE END' : 'THE END LOCKED'}</span>
                  </div>
                  {round5?.unlocked_by_dev_mode && (
                    <span style={{ fontSize: '9px', color: '#ffcc00', letterSpacing: '1px' }}>DEV UNLOCKED</span>
                  )}
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── TRANSITION VIDEO OVERLAY ── */}
      {transitionTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <video
            ref={transitionVideoRef}
            src="/transition1.mp4"
            autoPlay
            playsInline
            onEnded={() => {
              router.push(transitionTarget);
            }}
            style={{
              width: '100vw',
              height: '100vh',
              objectFit: 'cover',
              display: 'block',
            }}
          />

          <button
            type="button"
            onClick={() => router.push(transitionTarget)}
            style={{
              position: 'absolute',
              top: '24px',
              right: '24px',
              zIndex: 10,
              background: 'rgba(0,0,0,0.65)',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: '4px',
              color: 'rgba(255,255,255,0.9)',
              padding: '8px 16px',
              fontSize: '12px',
              fontFamily: 'var(--font-minecraft), system-ui, sans-serif',
              letterSpacing: '1px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            }}
          >
            SKIP ›
          </button>
        </div>
      )}

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

      {/* ── STYLES ── */}
      <style>{`
        /* ── Scene character hover glow ── */
        .scene-btn { position: relative; }

        .steve-btn:hover, .steve-btn:focus-visible {
          filter: drop-shadow(0 12px 32px rgba(0,0,0,0.65))
                  drop-shadow(0 0 22px rgba(100,200,255,0.75))
                  brightness(1.12) !important;
          z-index: 50 !important;
        }
        .steve-btn:active { transform: scale(0.96) !important; }

        /* ── Toast slide-in from right ── */
        @keyframes mc-toast-in {
          from { opacity: 0; transform: translateX(110%); }
          to   { opacity: 1; transform: translateX(0); }
        }

        /* ── Map Modal Pop-in & Backdrop ── */
        @keyframes map-pop-in {
          0%   { opacity: 0; transform: scale(0.55) rotate(-2deg); filter: blur(8px); }
          70%  { opacity: 1; transform: scale(1.02) rotate(0.5deg); filter: blur(0px); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); filter: blur(0px); }
        }
        @keyframes mc-backdrop-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pulse-forest-btn {
          0%   { box-shadow: 0 0 15px rgba(85, 255, 85, 0.5), 0 4px 14px rgba(0, 0, 0, 0.8); }
          100% { box-shadow: 0 0 28px rgba(85, 255, 85, 0.85), 0 6px 18px rgba(0, 0, 0, 0.9); }
        }
        @keyframes pulse-cave-btn {
          0%   { box-shadow: 0 0 15px rgba(180, 180, 200, 0.5), 0 4px 14px rgba(0, 0, 0, 0.8); }
          100% { box-shadow: 0 0 28px rgba(180, 180, 200, 0.85), 0 6px 18px rgba(0, 0, 0, 0.9); }
        }
        @keyframes float-bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-8px); }
        }
        @keyframes slide-in-right {
          0% { transform: translateX(120%); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }

        /* Stats HUD — responsive Minecraft panel */
        .stats-hud {
          position: absolute;
          top: 40px;
          right: 30px;
          z-index: 10;
          background: rgba(40, 40, 40, 0.88);
          border: 3px solid #555;
          border-top-color: #888;
          border-left-color: #888;
          border-bottom-color: #222;
          border-right-color: #222;
          padding: 12px 16px;
          font-family: var(--font-minecraft), system-ui, sans-serif;
          color: #ffffff;
          text-shadow: 2px 2px 0 #000;
          animation: slide-in-right 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          box-shadow: 0 8px 24px rgba(0,0,0,0.8);
          display: flex;
          flex-direction: column;
          gap: 7px;
          min-width: 180px;
        }
        @media (max-width: 600px) {
          .stats-hud {
            top: auto;
            bottom: 12px;
            right: 12px;
            min-width: 140px;
            padding: 8px 12px;
            gap: 5px;
            font-size: 10px;
          }
        }
      `}</style>

    </div>
  );
}
