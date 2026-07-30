'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Pickaxe } from 'lucide-react';

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
        body: JSON.stringify({ password, scope: 'admin' })
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success('Access Granted');
        router.push(data.redirect);
        router.refresh();
      } else {
        toast.error(data.error || 'Access Denied');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const mc = { fontFamily: 'var(--font-minecraft), system-ui, sans-serif' };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background with slight tint */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        backgroundImage: 'url(/cavern-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        filter: 'brightness(0.3)',
      }} />

      <div style={{
        position: 'relative',
        zIndex: 10,
        background: '#4a3320',
        borderTop: '6px solid #6c4b31',
        borderLeft: '6px solid #6c4b31',
        borderBottom: '6px solid #1f140c',
        borderRight: '6px solid #1f140c',
        padding: '32px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.8)',
      }}>
        <div className="text-center space-y-4 mb-8">
          <div className="flex justify-center">
            <Pickaxe className="w-12 h-12 text-[#fca311]" />
          </div>
          <h1 style={{
            ...mc,
            fontSize: '1.8rem',
            color: '#fde047',
            textShadow: '2px 2px 0 #000',
            letterSpacing: '0.1em'
          }}>
            COMMAND BLOCK
          </h1>
          <p style={{ ...mc, color: '#aaa', fontSize: '0.8rem', textShadow: '1px 1px 0 #000' }}>
            ENTER ADMIN PASSWORD TO PROCEED
          </p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <input 
              type="password" 
              placeholder="PASSWORD" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                background: '#1a110a',
                borderTop: '4px solid #0f0a06',
                borderLeft: '4px solid #0f0a06',
                borderBottom: '4px solid #332316',
                borderRight: '4px solid #332316',
                color: '#fff',
                padding: '16px',
                fontSize: '1.2rem',
                textAlign: 'center',
                outline: 'none',
                ...mc
              }}
              autoFocus
            />
          </div>
          <button 
            type="submit" 
            disabled={loading || !password}
            style={{
              width: '100%',
              background: '#3e8e2b',
              borderTop: '4px solid #5aba3c',
              borderLeft: '4px solid #5aba3c',
              borderBottom: '4px solid #1f4a15',
              borderRight: '4px solid #1f4a15',
              color: '#fff',
              padding: '16px',
              fontSize: '1.2rem',
              cursor: (loading || !password) ? 'var(--mv-cursor-barrier)' : 'var(--mv-cursor-pickaxe)',
              opacity: (loading || !password) ? 0.7 : 1,
              textShadow: '2px 2px 0 #111',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              ...mc
            }}
            className="hover:brightness-110 active:scale-95 transition-all"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'AUTHENTICATE'}
          </button>
        </form>
      </div>
    </div>
  );
}
