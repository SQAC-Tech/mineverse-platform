'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, ShieldCheck } from 'lucide-react';
import '../../theme-kit.css';
import '../nether.css';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/panel/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, scope: 'admin' }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Access granted');
        router.push(data.redirect);
        router.refresh();
      } else {
        toast.error(data.error || 'Access denied');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="nether"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        position: 'relative',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/cavern-bg.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.1,
          filter: 'saturate(0.35) hue-rotate(150deg)',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 40%, rgb(from var(--accent-primary) r g b / 14%), transparent 60%)',
        }}
      />

      <div className="n-panel" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 380 }}>
        <div style={{ padding: '30px 26px' }}>
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <ShieldCheck
              size={34}
              style={{ color: 'var(--accent-primary)', filter: 'drop-shadow(0 0 10px rgb(from var(--accent-primary) r g b / 70%))' }}
            />
            <h1
              style={{
                fontSize: 22,
                fontWeight: 650,
                letterSpacing: 1,
                marginTop: 12,
                color: 'var(--text-onDark)',
              }}
            >
              COMMAND BLOCK
            </h1>
            <p className="n-panel-sub" style={{ marginTop: 6 }}>
              Admin access required
            </p>
          </div>

          <div style={{ marginBottom: 18 }}><hr className="n-lava-divider" /></div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label>
              <span className="n-label">Password</span>
              <input
                type="password"
                className="n-input"
                style={{ textAlign: 'center', fontSize: 14, padding: 12, letterSpacing: 3 }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
              />
            </label>

            <button
              type="submit"
              disabled={loading || !password}
              className="n-btn n-btn-primary"
              style={{ width: '100%', padding: 12, fontSize: 12 }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Authenticate'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
