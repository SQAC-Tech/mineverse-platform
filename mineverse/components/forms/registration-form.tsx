'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registrationSchema } from '@/lib/validation/schemas';
import { Turnstile } from '@marsidev/react-turnstile';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Trash2, Plus } from 'lucide-react';

type FormValues = {
  honeypot: '';
  challenge_id: string;
  verification_token: string;
  team_name: string;
  members: {
    name: string;
    email: string;
    college_email: string;
    phone: string;
    section?: string;
    department: 'CSE' | 'IT' | 'ECE' | 'EEE' | 'MECH' | 'CIVIL' | 'OTHER';
    is_team_lead: boolean;
  }[];
};

export function RegistrationForm() {
  const router = useRouter();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  
  // OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const { register, control, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      honeypot: '',
      challenge_id: '',
      verification_token: '',
      team_name: '',
      members: [{ name: '', email: '', college_email: '', phone: '', section: '', department: 'CSE', is_team_lead: true }],
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'members' });

  const leadCollegeEmail = watch('members.0.college_email');

  const handleSendOtp = async () => {
    if (!turnstileToken) {
      toast.error('Please complete the captcha first');
      return;
    }
    if (!leadCollegeEmail || !leadCollegeEmail.includes('@')) {
      toast.error('Please enter a valid college email for the team lead');
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ college_email: leadCollegeEmail, turnstile_token: turnstileToken }),
      });
      const data = await res.json();
      
      if (data.success) {
        setChallengeId(data.challenge_id);
        setValue('challenge_id', data.challenge_id);
        setOtpSent(true);
        toast.success('OTP sent to your college email!');
      } else {
        toast.error(data.error || 'Failed to send OTP');
      }
    } catch (e) {
      toast.error('Network error');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6) {
      toast.error('OTP must be 6 digits');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId, otp: otpValue }),
      });
      const data = await res.json();
      
      if (data.success) {
        setVerificationToken(data.verification_token);
        setValue('verification_token', data.verification_token);
        setOtpVerified(true);
        toast.success('Email verified successfully!');
      } else {
        toast.error(data.error || 'Invalid OTP');
      }
    } catch (e) {
      toast.error('Network error');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const onSubmit = async (data: FormValues) => {
    if (data.honeypot) return; // Bot detected
    if (!otpVerified || !data.challenge_id || !data.verification_token) {
      toast.error('Please verify the team lead\'s college email first');
      return;
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (result.success) {
        toast.success('Registration successful! Redirecting to payment...');
        router.push(result.redirect);
      } else {
        toast.error(result.error || 'Registration failed');
      }
    } catch (e) {
      toast.error('An error occurred during registration');
    }
  };

  const mc = { fontFamily: 'var(--font-minecraft), system-ui, sans-serif' };

  const woodBg = {
    background: 'linear-gradient(180deg, #6c4b31 0%, #4a3320 50%, #2f1f12 100%)',
    border: '4px solid #1f140c',
    boxShadow: 'inset 0 2px 0 #8b6240, inset 0 -2px 0 #1f140c, inset 2px 0 0 #8b6240, inset -2px 0 0 #1f140c, 0 8px 32px rgba(0,0,0,0.8)',
    imageRendering: 'pixelated' as any,
  };

  const parchmentBg = {
    backgroundColor: '#dbb778',
    border: '4px solid #3c2415',
    boxShadow: 'inset 0 0 20px rgba(100, 60, 20, 0.5), 0 10px 30px rgba(0,0,0,0.8)',
    position: 'relative' as any,
  };

  const inputBg = {
    backgroundColor: '#4a3320',
    border: '2px solid #2f1f12',
    color: '#fde047',
    padding: '10px 12px',
    outline: 'none',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
    width: '100%',
    fontFamily: 'var(--font-minecraft), system-ui, sans-serif',
  };

  const iconBtn = {
    backgroundColor: '#4a3320',
    border: '2px solid #2f1f12',
    width: '42px',
    height: '42px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
    color: '#aaa',
    cursor: 'pointer'
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-4xl mx-auto flex justify-center relative pb-20">
      {/* Honeypot field */}
      <input type="text" {...register('honeypot')} className="hidden" tabIndex={-1} autoComplete="off" />

      {/* Center Parchment Form */}
      <div style={{ ...parchmentBg, width: '100%', maxWidth: '640px', padding: '40px 30px' }}>
         {/* Decorative Nails */}
         <div style={{ position: 'absolute', top: '10px', left: '10px', width: '12px', height: '12px', background: '#333', boxShadow: 'inset -2px -2px 0 #111, inset 2px 2px 0 #666', imageRendering: 'pixelated' as any }} />
         <div style={{ position: 'absolute', top: '10px', right: '10px', width: '12px', height: '12px', background: '#333', boxShadow: 'inset -2px -2px 0 #111, inset 2px 2px 0 #666', imageRendering: 'pixelated' as any }} />
         <div style={{ position: 'absolute', bottom: '10px', left: '10px', width: '12px', height: '12px', background: '#333', boxShadow: 'inset -2px -2px 0 #111, inset 2px 2px 0 #666', imageRendering: 'pixelated' as any }} />
         <div style={{ position: 'absolute', bottom: '10px', right: '10px', width: '12px', height: '12px', background: '#333', boxShadow: 'inset -2px -2px 0 #111, inset 2px 2px 0 #666', imageRendering: 'pixelated' as any }} />

         <div className="text-center mb-8">
            <h3 style={{ ...mc, color: '#315433', fontSize: '1.8rem', textShadow: '1px 1px 0 rgba(255,255,255,0.4)' }}>
              ⚔️ REGISTER NOW ⚔️
            </h3>
         </div>

         <div className="space-y-6">
              {/* Team Name */}
              <div>
                <label style={{ ...mc, display: 'block', color: '#3c2415', fontSize: '0.8rem', marginBottom: '6px' }}>&gt; TEAM NAME</label>
                <div className="flex gap-2">
                  <input {...register('team_name')} style={inputBg} placeholder="Enter your team name" />
                  <div style={iconBtn}>👥</div>
                </div>
                {errors.team_name && <p className="text-red-700 text-xs mt-1 font-bold">{errors.team_name.message}</p>}
              </div>

              {/* Members Loop */}
              {fields.map((field, index) => (
                <div key={field.id} className="pt-4 mt-4 border-t-2 border-[#a37b45] border-dashed">
                  <div className="flex justify-between items-center mb-4">
                    <h4 style={{ ...mc, color: '#315433', fontSize: '1rem' }}>
                      {index === 0 ? 'TEAM LEADER (MEMBER 1)' : `MEMBER ${index + 1}`}
                    </h4>
                    {index > 0 && (
                      <button type="button" onClick={() => remove(index)} className="text-red-800 hover:text-red-600 transition-colors">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label style={{ ...mc, display: 'block', color: '#3c2415', fontSize: '0.8rem', marginBottom: '6px' }}>&gt; FULL NAME</label>
                      <div className="flex gap-2">
                        <input {...register(`members.${index}.name`)} style={inputBg} placeholder="Enter full name" />
                        <div style={iconBtn}>👤</div>
                      </div>
                    </div>

                    <div>
                      <label style={{ ...mc, display: 'block', color: '#3c2415', fontSize: '0.8rem', marginBottom: '6px' }}>&gt; PERSONAL EMAIL</label>
                      <div className="flex gap-2">
                        <input {...register(`members.${index}.email`)} style={inputBg} placeholder="Enter personal email" />
                        <div style={iconBtn}>✉️</div>
                      </div>
                    </div>

                    <div>
                      <label style={{ ...mc, display: 'block', color: '#3c2415', fontSize: '0.8rem', marginBottom: '6px' }}>&gt; COLLEGE EMAIL {index === 0 && '(VERIFICATION REQ)'}</label>
                      <div className="flex gap-2">
                        <input 
                          {...register(`members.${index}.college_email`)} 
                          style={inputBg} 
                          disabled={index === 0 && otpVerified}
                          placeholder="Enter college email" 
                        />
                        {index === 0 && !otpVerified && (
                          <button type="button" onClick={handleSendOtp} disabled={isSendingOtp || !turnstileToken} style={{...iconBtn, width: 'auto', padding: '0 10px', color: '#fde047', fontFamily: 'var(--font-minecraft)'}}>
                            {isSendingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : 'OTP'}
                          </button>
                        )}
                        {index === 0 && otpVerified && (
                          <div style={{...iconBtn, width: 'auto', padding: '0 10px', color: '#4ade80'}}>✓</div>
                        )}
                      </div>
                    </div>

                    {index === 0 && otpSent && !otpVerified && (
                      <div className="p-3 bg-[#3c2415]/20 border border-[#3c2415] rounded">
                        <label style={{ ...mc, display: 'block', color: '#3c2415', fontSize: '0.8rem', marginBottom: '6px' }}>&gt; ENTER OTP</label>
                        <div className="flex gap-2">
                          <input value={otpValue} onChange={e => setOtpValue(e.target.value)} maxLength={6} style={inputBg} placeholder="6-digit code" />
                          <button type="button" onClick={handleVerifyOtp} disabled={isVerifyingOtp || otpValue.length !== 6} style={{...iconBtn, width: 'auto', padding: '0 10px', color: '#fde047', fontFamily: 'var(--font-minecraft)'}}>
                            {isVerifyingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : 'VERIFY'}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1">
                        <label style={{ ...mc, display: 'block', color: '#3c2415', fontSize: '0.8rem', marginBottom: '6px' }}>&gt; WHATSAPP NO.</label>
                        <input {...register(`members.${index}.phone`)} style={inputBg} placeholder="10 digits" />
                      </div>
                      <div className="w-full sm:w-[120px]">
                        <label style={{ ...mc, display: 'block', color: '#3c2415', fontSize: '0.8rem', marginBottom: '6px' }}>&gt; DEPT</label>
                        <select {...register(`members.${index}.department`)} style={inputBg}>
                          <option value="CSE">CSE</option>
                          <option value="IT">IT</option>
                          <option value="ECE">ECE</option>
                          <option value="EEE">EEE</option>
                          <option value="MECH">MECH</option>
                          <option value="CIVIL">CIVIL</option>
                          <option value="OTHER">OTHER</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Form Footer */}
            <div className="mt-8 pt-6 border-t-2 border-[#a37b45] border-dashed flex flex-col items-center gap-6">
              
              {fields.length < 3 && (
                <button 
                  type="button" 
                  onClick={() => append({ name: '', email: '', college_email: '', phone: '', section: '', department: 'CSE', is_team_lead: false })}
                  style={{
                    ...woodBg,
                    padding: '10px 24px',
                    color: '#fca311',
                    fontSize: '0.8rem',
                    ...mc,
                    cursor: 'pointer'
                  }}
                  className="hover:brightness-110 active:scale-95 transition-all w-full max-w-sm flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> ADD MEMBER
                </button>
              )}

              <div className="bg-[#3c2415]/20 p-2 rounded">
                <Turnstile
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}
                  onSuccess={(token) => setTurnstileToken(token)}
                />
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting || !otpVerified || !turnstileToken}
                style={{
                  background: (isSubmitting || !otpVerified || !turnstileToken) ? '#555' : '#3e8e2b',
                  borderTop: `4px solid ${(isSubmitting || !otpVerified || !turnstileToken) ? '#777' : '#5aba3c'}`,
                  borderLeft: `4px solid ${(isSubmitting || !otpVerified || !turnstileToken) ? '#777' : '#5aba3c'}`,
                  borderBottom: `4px solid ${(isSubmitting || !otpVerified || !turnstileToken) ? '#333' : '#1f4a15'}`,
                  borderRight: `4px solid ${(isSubmitting || !otpVerified || !turnstileToken) ? '#333' : '#1f4a15'}`,
                  padding: '16px 32px',
                  cursor: (isSubmitting || !otpVerified || !turnstileToken) ? 'not-allowed' : 'pointer',
                  color: '#fff',
                  textShadow: '2px 2px 0 #111',
                  fontSize: '1.2rem',
                  letterSpacing: '0.1em',
                  ...mc,
                  width: '100%',
                  maxWidth: '384px'
                }}
                className={`transition-all ${(isSubmitting || !otpVerified || !turnstileToken) ? '' : 'hover:brightness-110 active:scale-95'}`}
              >
                {isSubmitting ? 'PROCESSING...' : 'REGISTER NOW'}
              </button>

              <div style={{
                ...woodBg,
                padding: '8px 20px',
                marginTop: '10px'
              }}>
                <span style={{ ...mc, color: '#d4c4a8', fontSize: '0.7rem', letterSpacing: '0.1em' }}>
                  GEAR UP. CODE ON. CONQUER.
                </span>
              </div>
            </div>

      </div>
    </form>
  );
}

