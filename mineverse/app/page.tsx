'use client';

import { useEffect, useState } from 'react';

// Minecraft block colors
const BLOCK_COLORS = [
  '#5D8C3E', // grass green
  '#8B6914', // dirt brown
  '#6B6B6B', // stone gray
  '#3F3F3F', // dark stone
  '#4A7A2E', // dark grass
  '#7A5B12', // dark dirt
  '#2D5016', // deep green
  '#9B7D4A', // sand
  '#4169E1', // diamond blue
  '#FFD700', // gold
];

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  speed: number;
  delay: number;
  opacity: number;
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 8 + 4,
    color: BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)],
    speed: Math.random() * 20 + 15,
    delay: Math.random() * 10,
    opacity: Math.random() * 0.4 + 0.1,
  }));
}

export default function ComingSoonPage() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setParticles(generateParticles(50));
    setMounted(true);
  }, []);

  return (
    <>
      <style>{`
        @keyframes float-up {
          0% {
            transform: translateY(100vh) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: var(--particle-opacity);
          }
          90% {
            opacity: var(--particle-opacity);
          }
          100% {
            transform: translateY(-20vh) rotate(360deg);
            opacity: 0;
          }
        }

        @keyframes pulse-glow {
          0%, 100% {
            text-shadow:
              0 0 6px rgba(93, 140, 62, 0.5),
              0 0 12px rgba(74, 122, 46, 0.25);
            filter: brightness(1);
          }
          50% {
            text-shadow:
              0 0 8px rgba(107, 175, 74, 0.6),
              0 0 18px rgba(93, 140, 62, 0.3);
            filter: brightness(1.05);
          }
        }

        @keyframes flicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pickaxe-swing {
          0%, 100% { transform: rotate(-10deg); }
          50% { transform: rotate(20deg); }
        }

        @keyframes border-glow {
          0%, 100% {
            border-color: rgba(93, 140, 62, 0.3);
            box-shadow: 0 0 15px rgba(93, 140, 62, 0.1), inset 0 0 15px rgba(93, 140, 62, 0.05);
          }
          50% {
            border-color: rgba(93, 140, 62, 0.6);
            box-shadow: 0 0 30px rgba(93, 140, 62, 0.2), inset 0 0 30px rgba(93, 140, 62, 0.1);
          }
        }

        @keyframes dot-pulse {
          0% { content: '.'; }
          33% { content: '..'; }
          66% { content: '...'; }
        }

        .coming-soon-bg {
          background: #050a02;
        }


        .pixel-border {
          border: 3px solid rgba(93, 140, 62, 0.4);
          box-shadow:
            inset 0 0 30px rgba(93, 140, 62, 0.05),
            0 0 20px rgba(93, 140, 62, 0.1);
          animation: border-glow 4s ease-in-out infinite;
        }

        .grass-line {
          background: linear-gradient(90deg,
            transparent 0%,
            #5D8C3E 15%,
            #4A7A2E 30%,
            #6BAF4A 50%,
            #4A7A2E 70%,
            #5D8C3E 85%,
            transparent 100%
          );
          height: 3px;
          image-rendering: pixelated;
        }

        .block-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 4px;
        }

        .mini-block {
          width: 10px;
          height: 10px;
          image-rendering: pixelated;
        }
      `}</style>

      <div className="coming-soon-bg relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background image layer */}
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: "url('/minecraft-bg.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed',
          }}
        />
        {/* Dark overlay on top of bg image */}
        <div
          className="absolute inset-0 z-0"
          style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.5) 100%)',
          }}
        />
        {/* Floating pixel particles */}
        {mounted && particles.map((p) => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: '0',
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.color,
              animation: `float-up ${p.speed}s linear ${p.delay}s infinite`,
              imageRendering: 'pixelated' as const,
              ['--particle-opacity' as string]: p.opacity,
              opacity: 0,
            }}
          />
        ))}

        {/* Vignette overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)',
          }}
        />

        {/* Main content */}
        <div
          className="relative z-10 text-center px-6 py-16 max-w-3xl mx-auto"
          style={{
            animation: mounted ? 'slide-up 1s ease-out forwards' : 'none',
            opacity: mounted ? 1 : 0,
          }}
        >
          {/* SQAC Logo */}
          <img
            src="/sqac-logo.png"
            alt="SQAC Logo"
            style={{
              width: 'clamp(80px, 15vw, 130px)',
              height: 'auto',
              margin: '0 auto 16px',
              display: 'block',
              filter: 'drop-shadow(0 0 12px rgba(255, 150, 50, 0.3))',
              animation: mounted ? 'slide-up 0.8s ease-out forwards' : 'none',
            }}
          />
          {/* Community name */}
          <p
            className="font-minecraft"
            style={{
              fontFamily: 'var(--font-minecraft)',
              fontSize: 'clamp(0.5rem, 1.8vw, 0.85rem)',
              color: 'rgba(255, 180, 100, 0.8)',
              letterSpacing: '0.2em',
              marginBottom: '24px',
              animation: mounted ? 'slide-up 0.9s ease-out forwards' : 'none',
            }}
          >
            SOFTWARE QUALITY ASSURANCE COMMUNITY
          </p>

          {/* Decorative pickaxe */}
          <div
            className="text-4xl mb-6"
            style={{ animation: 'pickaxe-swing 2s ease-in-out infinite' }}
          >
            ⛏️
          </div>

          {/* Grass line top */}
          <div className="grass-line w-full mb-10 mx-auto" style={{ maxWidth: '500px' }} />

          {/* MINEVERSE title */}
          <h1
            className="font-minecraft tracking-widest mb-8"
            style={{
              fontFamily: 'var(--font-minecraft)',
              fontSize: 'clamp(2rem, 6vw, 4rem)',
              color: '#5D8C3E',
              animation: 'pulse-glow 3s ease-in-out infinite',
              letterSpacing: '0.15em',
              lineHeight: 1.2,
            }}
          >
            MINEVERSE
          </h1>

          {/* Under Construction */}
          <div className="pixel-border inline-block px-8 py-4 mb-8" style={{ borderRadius: '2px' }}>
            <p
              className="font-minecraft uppercase tracking-wider"
              style={{
                fontFamily: 'var(--font-minecraft)',
                fontSize: 'clamp(0.6rem, 2vw, 1rem)',
                color: '#FFD700',
                animation: 'flicker 3s ease-in-out infinite',
                letterSpacing: '0.2em',
              }}
            >
              🚧 Under Construction 🚧
            </p>
          </div>

          {/* Grass line middle */}
          <div className="grass-line w-full my-8 mx-auto" style={{ maxWidth: '350px', opacity: 0.5 }} />

          {/* Coming Soon */}
          <p
            className="font-minecraft mb-6"
            style={{
              fontFamily: 'var(--font-minecraft)',
              fontSize: 'clamp(0.7rem, 2.5vw, 1.2rem)',
              color: '#9B7D4A',
              animation: mounted ? 'slide-up 1s ease-out 0.3s both' : 'none',
              letterSpacing: '0.1em',
            }}
          >
            Coming Soon
          </p>

          {/* Stay Tuned */}
          <p
            className="font-minecraft"
            style={{
              fontFamily: 'var(--font-minecraft)',
              fontSize: 'clamp(0.5rem, 1.5vw, 0.75rem)',
              color: 'rgba(107, 175, 74, 0.7)',
              animation: mounted ? 'slide-up 1s ease-out 0.6s both' : 'none',
              letterSpacing: '0.15em',
            }}
          >
            Stay Tuned
          </p>

          {/* Grass line bottom */}
          <div className="grass-line w-full mt-10 mx-auto" style={{ maxWidth: '500px' }} />

          {/* Decorative mini blocks */}
          <div className="flex justify-center gap-3 mt-8">
            {['#5D8C3E', '#8B6914', '#6B6B6B', '#4169E1', '#FFD700', '#6B6B6B', '#8B6914', '#5D8C3E'].map((color, i) => (
              <div
                key={i}
                style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: color,
                  opacity: 0.4,
                  imageRendering: 'pixelated' as const,
                  animation: mounted ? `slide-up 0.5s ease-out ${0.8 + i * 0.1}s both` : 'none',
                }}
              />
            ))}
          </div>
        </div>

        {/* Bottom grass blocks strip */}
        <div className="absolute bottom-0 left-0 right-0 h-16 overflow-hidden" style={{ imageRendering: 'pixelated' as const }}>
          {/* Grass layer */}
          <div
            className="absolute top-0 left-0 right-0 h-4"
            style={{
              background: 'linear-gradient(180deg, #5D8C3E 0%, #4A7A2E 60%, #3D6624 100%)',
            }}
          />
          {/* Dirt layer */}
          <div
            className="absolute top-4 left-0 right-0 h-12"
            style={{
              background: 'linear-gradient(180deg, #8B6914 0%, #7A5B12 50%, #6B4E10 100%)',
            }}
          />
          {/* Pixel grid overlay */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
              `,
              backgroundSize: '8px 8px',
            }}
          />
        </div>
      </div>
    </>
  );
}
