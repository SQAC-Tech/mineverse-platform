'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [teamCode, setTeamCode] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  
  // OTP state
  const [challengeId, setChallengeId] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_code: teamCode })
      });
      const data = await res.json();
      if (data.success) {
        setChallengeId(data.challenge_id);
        setMaskedEmail(data.lead_email_masked);
        setStep(2);
        toast.success('OTP sent to lead\'s college email');
      } else {
        toast.error(data.error);
      }
    } catch (err) {
      toast.error('Network error');
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
        router.push(data.redirect);
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

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-sm bg-slate-900 border-slate-800">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-white tracking-tight">Team Login</CardTitle>
          <p className="text-slate-400 text-sm">MINEVERSE 2026</p>
        </CardHeader>
        <CardContent>
          {step === 1 ? (
            <form onSubmit={requestOtp} className="space-y-4">
              <div>
                <Label className="text-slate-300">Team Code</Label>
                <Input 
                  placeholder="MNV-XXX" 
                  value={teamCode}
                  onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                  className="bg-slate-950 border-slate-800 text-white h-12 uppercase"
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-bold" disabled={loading || !teamCode}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send OTP'}
              </Button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div className="text-center mb-4">
                <p className="text-sm text-slate-300">OTP sent to team lead:</p>
                <p className="font-semibold text-emerald-400">{maskedEmail}</p>
              </div>
              <div>
                <Label className="text-slate-300">Enter OTP</Label>
                <Input 
                  placeholder="6-digit code" 
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  className="bg-slate-950 border-slate-800 text-center text-lg tracking-widest text-white h-12"
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-bold" disabled={loading || otp.length !== 6}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enter Dashboard'}
              </Button>
              <Button type="button" variant="ghost" className="w-full text-slate-400" onClick={() => setStep(1)}>
                Back
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
