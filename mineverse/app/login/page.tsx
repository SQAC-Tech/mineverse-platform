'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Users } from 'lucide-react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { DashboardLoginCard } from '@/components/dashboard/DashboardLoginCard';

/**
 * Normalise team-code input to the canonical MNV-XXX format.
 * Accepts "MNV000", "mnv-000", "mnv 000", etc. and always returns "MNV-XXX".
 */
function normalizeTeamCode(raw: string): string {
  const upper = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Insert dash after the 3-letter prefix when the user types the 4th char
  if (upper.length > 3 && upper.startsWith('MNV')) {
    return `${upper.slice(0, 3)}-${upper.slice(3)}`;
  }
  return upper;
}

export default function LoginPage() {
  const router = useRouter();
  const [teamCode, setTeamCode] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  
  // OTP state
  const [challengeId, setChallengeId] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');

  // Turnstile state
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);

  const mc = { fontFamily: 'var(--font-minecraft), system-ui, sans-serif' };

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnstileToken) {
      toast.error('Please complete the captcha first');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_code: teamCode, turnstile_token: turnstileToken })
      });
      const data = await res.json();
      if (data.success) {
        setChallengeId(data.challenge_id);
        setMaskedEmail(data.lead_email_masked);
        setStep(2);
        toast.success('OTP sent to lead\'s college email');
        
        // Show OTP directly in dev mode
        if (data.devOtp) {
          toast.info(`DEV MODE OTP: ${data.devOtp}`, {
            duration: 15000,
            description: "Use this since real emails aren't configured yet."
          });
        }
      } else {
        toast.error(data.error);
        // Reset Turnstile — token is single-use
        turnstileRef.current?.reset();
        setTurnstileToken(null);
      }
    } catch (err) {
      toast.error('Network error');
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId, otp })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Login successful!');
        /**
         * The dashboard, unless the server has a reason to send the team
         * somewhere else — payment pending, for one.
         *
         * There used to be a chooser here, screening or dashboard, decided
         * before the OTP. The qualifier is over, so the only live destination
         * is the dashboard and the choice was removed rather than left as a
         * one-option menu.
         */
        router.push(data.redirect || '/dashboard');
        router.refresh();
      } else {
        toast.error(data.error);
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const buttonStyle = {
    width: '100%',
    background: '#3e8e2b',
    borderTop: '4px solid #5aba3c',
    borderLeft: '4px solid #5aba3c',
    borderBottom: '4px solid #1f4a15',
    borderRight: '4px solid #1f4a15',
    color: '#fff',
    padding: '16px',
    fontSize: '1.2rem',
    cursor: 'var(--mv-cursor-pickaxe)',
    textShadow: '2px 2px 0 #111',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    ...mc
  };

  const inputStyle = {
    width: '100%',
    background: '#1a110a',
    borderTop: '4px solid #0f0a06',
    borderLeft: '4px solid #0f0a06',
    borderBottom: '4px solid #332316',
    borderRight: '4px solid #332316',
    color: '#fff',
    padding: '16px',
    fontSize: '1.2rem',
    textAlign: 'center' as const,
    outline: 'none',
    ...mc
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col relative overflow-hidden">
      {/* Background with slight tint */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        backgroundImage: 'url(/cavern-bg.webp)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        filter: 'brightness(0.3)',
      }} />

      <div className="relative z-10 w-full p-6 flex items-center justify-between pointer-events-none">
        <Link href="/" className="pointer-events-auto">
          <button style={{
            background: '#4a3320',
            borderTop: '3px solid #6c4b31',
            borderLeft: '3px solid #6c4b31',
            borderBottom: '3px solid #1f140c',
            borderRight: '3px solid #1f140c',
            padding: '8px 16px',
            color: '#fca311',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            ...mc
          }} className="hover:brightness-110 active:scale-95 transition-all">
            <ArrowLeft className="w-4 h-4" /> BACK TO HOME
          </button>
        </Link>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4">
        <div style={{
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
              <Users className="w-12 h-12 text-[#fca311]" />
            </div>
            <h1 style={{
              ...mc,
              fontSize: '1.8rem',
              color: '#fde047',
              textShadow: '2px 2px 0 #000',
              letterSpacing: '0.1em'
            }}>
              TEAM LOGIN
            </h1>
            <p style={{ ...mc, color: '#aaa', fontSize: '0.8rem', textShadow: '1px 1px 0 #000' }}>
              MINEVERSE 2026
            </p>
          </div>
          
          {step === 1 && <DashboardLoginCard mc={mc} />}

          {step === 1 ? (
            <form onSubmit={requestOtp} className="space-y-6">
              <div>
                <label style={{ ...mc, display: 'block', color: '#fca311', fontSize: '0.8rem', marginBottom: '8px', textShadow: '1px 1px 0 #000' }}>
                  &gt; TEAM CODE
                </label>
                <input 
                  placeholder="MNV-XXX" 
                  value={teamCode}
                  onChange={(e) => setTeamCode(normalizeTeamCode(e.target.value))}
                  maxLength={7}
                  style={inputStyle}
                  autoFocus
                />
              </div>
              <div className="flex justify-center">
                <Turnstile
                  ref={turnstileRef}
                  siteKey="0x4AAAAAAEB7O-NKSvtQ5iNu"
                  options={{ action: 'turnstile-spin-v2' }}
                  onSuccess={(token) => setTurnstileToken(token)}
                  onError={() => setTurnstileToken(null)}
                  onExpire={() => setTurnstileToken(null)}
                />
              </div>
              <button 
                type="submit" 
                disabled={loading || !teamCode || !turnstileToken}
                style={{
                  ...buttonStyle,
                  opacity: (loading || !teamCode || !turnstileToken) ? 0.7 : 1,
                  cursor: (loading || !teamCode || !turnstileToken) ? 'var(--mv-cursor-barrier)' : 'var(--mv-cursor-pickaxe)'
                }}
                className="hover:brightness-110 active:scale-95 transition-all"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'SEND OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-6">
              <div className="text-center mb-6 p-3" style={{ background: '#1a110a', border: '2px solid #332316' }}>
                <p style={{ ...mc, fontSize: '0.7rem', color: '#aaa', marginBottom: '4px' }}>OTP SENT TO TEAM LEAD:</p>
                <p style={{ ...mc, fontSize: '0.9rem', color: '#5aba3c' }}>{maskedEmail}</p>
              </div>
              <div>
                <label style={{ ...mc, display: 'block', color: '#fca311', fontSize: '0.8rem', marginBottom: '8px', textShadow: '1px 1px 0 #000' }}>
                  &gt; ENTER OTP
                </label>
                <input 
                  placeholder="6-DIGIT CODE" 
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  style={{ ...inputStyle, letterSpacing: '0.2em' }}
                  autoFocus
                />
              </div>
              <button 
                type="submit" 
                disabled={loading || otp.length !== 6}
                style={{
                  ...buttonStyle,
                  opacity: (loading || otp.length !== 6) ? 0.7 : 1,
                  cursor: (loading || otp.length !== 6) ? 'var(--mv-cursor-barrier)' : 'var(--mv-cursor-pickaxe)'
                }}
                className="hover:brightness-110 active:scale-95 transition-all"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'ENTER DASHBOARD'}
              </button>
              <button 
                type="button" 
                onClick={() => setStep(1)}
                style={{
                  ...mc,
                  width: '100%',
                  background: 'transparent',
                  color: '#aaa',
                  border: 'none',
                  padding: '12px',
                  fontSize: '0.9rem',
                  cursor: 'var(--mv-cursor-pickaxe)',
                  textDecoration: 'underline'
                }}
                className="hover:text-white transition-colors"
              >
                BACK
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

