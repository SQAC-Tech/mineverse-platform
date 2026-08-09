'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registrationSchema } from '@/lib/validation/schemas';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Trash2, Plus, CheckCircle2 } from 'lucide-react';

type FormValues = {
  honeypot: '';
  challenge_id: string;
  verification_token: string;
  turnstile_token: string;
  team_name: string;
  transaction_id: string;
  sender_name: string;
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
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);

  // OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const { register, control, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      honeypot: '',
      challenge_id: '',
      verification_token: '',
      turnstile_token: '',
      team_name: '',
      transaction_id: '',
      sender_name: '',
      members: [{ name: '', email: '', college_email: '', phone: '', section: '', department: 'CSE', is_team_lead: true }],
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'members' });

  /**
   * Keep the Turnstile token in both places it is read from: local state (drives the
   * submit button) and the form value (validated by registrationSchema). Setting only
   * the state leaves `turnstile_token: ''` in the form, which fails zod before onSubmit
   * ever runs — the captcha looks solved but submit reports it isn't.
   */
  const applyTurnstileToken = (token: string | null) => {
    setTurnstileToken(token);
    setValue('turnstile_token', token ?? '');
  };

  // Payment step (pay first, then submit): QR for the current team size
  const [paymentQr, setPaymentQr] = useState<{ qr_image: string; amount: number; upi_id: string } | null>(null);

  useEffect(() => {
    if (!otpVerified) return;
    let cancelled = false;
    fetch(`/api/payment/qr?size=${fields.length}`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data.success) setPaymentQr(data.data);
      })
      .catch(() => { if (!cancelled) toast.error('Failed to load payment QR'); });
    return () => { cancelled = true; };
  }, [otpVerified, fields.length]);

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
      // /api/otp/send calls siteverify, which burns the token — Turnstile tokens are
      // single-use, so reusing this one at /api/register returns timeout-or-duplicate.
      // Reset regardless of outcome: from here we can't tell if the server got far
      // enough to consume it.
      turnstileRef.current?.reset();
      applyTurnstileToken(null);
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

  // Zod blocks submit invisibly if a field error isn't rendered — surface it
  const onInvalid = (errs: any) => {
    const firstMessage = (function find(obj: any): string | null {
      if (!obj || typeof obj !== 'object') return null;
      if (typeof obj.message === 'string') return obj.message;
      for (const key of Object.keys(obj)) {
        const found = find(obj[key]);
        if (found) return found;
      }
      return null;
    })(errs);
    toast.error(firstMessage || 'Please fix the highlighted fields');
  };

  const onSubmit = async (data: FormValues) => {
    if (data.honeypot) return; // Bot detected
    if (!otpVerified || !data.challenge_id || !data.verification_token) {
      toast.error("Please verify the team lead's college email first");
      return;
    }
    if (!turnstileToken) {
      toast.error('Please complete the captcha');
      return;
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, turnstile_token: turnstileToken }),
      });
      const result = await res.json();

      if (result.success) {
        toast.success('Registration submitted! Payment is under verification.');
        router.push(result.redirect);
      } else {
        toast.error(result.error || 'Registration failed');
        // Reset Turnstile — token is single-use, must get a fresh one for retry
        turnstileRef.current?.reset();
        applyTurnstileToken(null);
      }
    } catch (e) {
      toast.error('An error occurred during registration');
      turnstileRef.current?.reset();
      applyTurnstileToken(null);
    }
  };

  const mc: React.CSSProperties = { fontFamily: 'var(--font-minecraft), system-ui, sans-serif' };

  const woodBg: React.CSSProperties = {
    background: 'linear-gradient(180deg, #6c4b31 0%, #4a3320 50%, #2f1f12 100%)',
    border: '4px solid #1f140c',
    boxShadow: 'inset 0 2px 0 #8b6240, inset 0 -2px 0 #1f140c, inset 2px 0 0 #8b6240, inset -2px 0 0 #1f140c, 0 8px 32px rgba(0,0,0,0.8)',
    imageRendering: 'pixelated',
  };

  const parchmentBg: React.CSSProperties = {
    backgroundColor: '#dbb778',
    border: '4px solid #3c2415',
    boxShadow: 'inset 0 0 20px rgba(100, 60, 20, 0.5), 0 10px 30px rgba(0,0,0,0.8)',
    position: 'relative',
    width: '100%',
    maxWidth: '640px',
    boxSizing: 'border-box',
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: '#4a3320',
    border: '2px solid #2f1f12',
    color: '#fde047',
    padding: '10px 12px',
    outline: 'none',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
    width: '100%',
    fontFamily: 'var(--font-minecraft), system-ui, sans-serif',
    fontSize: '0.75rem',
    boxSizing: 'border-box',
  };

  const iconEmoji: React.CSSProperties = {
    backgroundColor: '#4a3320',
    border: '2px solid #2f1f12',
    width: '42px',
    minWidth: '42px',
    height: '42px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
    fontSize: '1rem',
    flexShrink: 0,
  };

  const labelStyle: React.CSSProperties = {
    ...mc,
    display: 'block',
    color: '#3c2415',
    fontSize: 'clamp(0.6rem, 2vw, 0.8rem)',
    marginBottom: '6px',
  };

  const isDisabled = isSubmitting || !otpVerified || !turnstileToken;

  return (
    <form
      onSubmit={handleSubmit(onSubmit, onInvalid)}
      style={{ width: '100%', display: 'flex', justifyContent: 'center', position: 'relative', paddingBottom: '80px', boxSizing: 'border-box' }}
    >
      {/* Honeypot field */}
      <input type="text" {...register('honeypot')} style={{ display: 'none' }} tabIndex={-1} autoComplete="off" aria-hidden="true" />

      {/* Parchment Form */}
      <div style={{ ...parchmentBg, padding: 'clamp(20px, 5vw, 40px) clamp(16px, 4vw, 30px)' }}>
        {/* Decorative Nails */}
        {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h]) => (
          <div key={`${v}${h}`} style={{ position: 'absolute', [v]: '10px', [h]: '10px', width: '12px', height: '12px', background: '#333', boxShadow: 'inset -2px -2px 0 #111, inset 2px 2px 0 #666', imageRendering: 'pixelated' as any }} />
        ))}

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h3 style={{ ...mc, color: '#315433', fontSize: 'clamp(1.2rem, 4vw, 1.8rem)', textShadow: '1px 1px 0 rgba(255,255,255,0.4)', margin: 0 }}>
            ⚔️ REGISTER NOW ⚔️
          </h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ── Team Name ── */}
          <div>
            <label style={labelStyle}>&gt; TEAM NAME</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input {...register('team_name')} style={inputStyle} placeholder="Enter your team name" />
              <div style={iconEmoji}>👥</div>
            </div>
            {errors.team_name && <p style={{ color: '#b91c1c', fontSize: '0.7rem', marginTop: '4px', fontWeight: 'bold' }}>{errors.team_name.message}</p>}
          </div>

          {/* ── Members Loop ── */}
          {fields.map((field, index) => (
            <div key={field.id} style={{ paddingTop: '16px', marginTop: '4px', borderTop: '2px dashed #a37b45' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ ...mc, color: '#315433', fontSize: 'clamp(0.7rem, 2.5vw, 1rem)', margin: 0 }}>
                  {index === 0 ? 'TEAM LEADER (MEMBER 1)' : `MEMBER ${index + 1}`}
                </h4>
                {index > 0 && (
                  <button type="button" onClick={() => remove(index)} style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
                    <Trash2 size={18} />
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                {/* Full Name */}
                <div>
                  <label style={labelStyle}>&gt; FULL NAME</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input {...register(`members.${index}.name`)} style={inputStyle} placeholder="Enter full name" />
                    <div style={iconEmoji}>👤</div>
                  </div>
                  {errors.members?.[index]?.name && <p style={{ color: '#b91c1c', fontSize: '0.7rem', marginTop: '4px', fontWeight: 'bold' }}>{errors.members[index]?.name?.message}</p>}
                </div>

                {/* Personal Email */}
                <div>
                  <label style={labelStyle}>&gt; PERSONAL EMAIL</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input {...register(`members.${index}.email`)} style={inputStyle} placeholder="Enter personal email" type="email" />
                    <div style={iconEmoji}>✉️</div>
                  </div>
                  {errors.members?.[index]?.email && <p style={{ color: '#b91c1c', fontSize: '0.7rem', marginTop: '4px', fontWeight: 'bold' }}>{errors.members[index]?.email?.message}</p>}
                </div>

                {/* College Email */}
                <div>
                  <label style={labelStyle}>
                    &gt; COLLEGE EMAIL {index === 0 ? '(VERIFICATION REQ.)' : ''}
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      {...register(`members.${index}.college_email`)}
                      style={{ ...inputStyle, flex: '1 1 180px' }}
                      disabled={index === 0 && otpVerified}
                      placeholder="Enter college email"
                      type="email"
                    />
                    {index === 0 && !otpVerified && (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={isSendingOtp || !turnstileToken}
                        style={{
                          backgroundColor: isSendingOtp || !turnstileToken ? '#333' : '#4a3320',
                          border: '2px solid #2f1f12',
                          height: '42px',
                          padding: '0 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
                          color: '#fde047',
                          cursor: isSendingOtp || !turnstileToken ? 'not-allowed' : 'pointer',
                          fontFamily: 'var(--font-minecraft)',
                          fontSize: '0.7rem',
                          gap: '6px',
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isSendingOtp ? <Loader2 size={14} className="animate-spin" /> : null}
                        {otpSent ? 'RESEND OTP' : 'SEND OTP'}
                      </button>
                    )}
                    {index === 0 && otpVerified && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#166534', flexShrink: 0 }}>
                        <CheckCircle2 size={18} />
                        <span style={{ ...mc, fontSize: '0.65rem' }}>VERIFIED</span>
                      </div>
                    )}
                  </div>
                  {errors.members?.[index]?.college_email && <p style={{ color: '#b91c1c', fontSize: '0.7rem', marginTop: '4px', fontWeight: 'bold' }}>{errors.members[index]?.college_email?.message}</p>}
                </div>

                {/* OTP Entry (lead only, after sent, before verified) */}
                {index === 0 && otpSent && !otpVerified && (
                  <div style={{ padding: '14px', background: 'rgba(60,36,21,0.2)', border: '1px solid #3c2415', borderRadius: '2px' }}>
                    <label style={{ ...labelStyle, marginBottom: '8px' }}>&gt; ENTER OTP (sent to college email)</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        value={otpValue}
                        onChange={e => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        inputMode="numeric"
                        style={{ ...inputStyle, flex: '1 1 120px', letterSpacing: '6px', textAlign: 'center', fontSize: '1.1rem' }}
                        placeholder="——————"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={isVerifyingOtp || otpValue.length !== 6}
                        style={{
                          backgroundColor: isVerifyingOtp || otpValue.length !== 6 ? '#333' : '#4a3320',
                          border: '2px solid #2f1f12',
                          height: '42px',
                          padding: '0 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fde047',
                          cursor: isVerifyingOtp || otpValue.length !== 6 ? 'not-allowed' : 'pointer',
                          fontFamily: 'var(--font-minecraft)',
                          fontSize: '0.7rem',
                          gap: '6px',
                          flexShrink: 0,
                        }}
                      >
                        {isVerifyingOtp ? <Loader2 size={14} className="animate-spin" /> : null}
                        VERIFY
                      </button>
                    </div>
                  </div>
                )}

                {/* Phone + Department row */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '2 1 160px', minWidth: 0 }}>
                    <label style={labelStyle}>&gt; WHATSAPP NO.</label>
                    <input {...register(`members.${index}.phone`)} style={inputStyle} placeholder="10-digit number" inputMode="tel" />
                    {errors.members?.[index]?.phone && <p style={{ color: '#b91c1c', fontSize: '0.7rem', marginTop: '4px', fontWeight: 'bold' }}>{errors.members[index]?.phone?.message}</p>}
                  </div>
                  <div style={{ flex: '1 1 100px', minWidth: '90px' }}>
                    <label style={labelStyle}>&gt; DEPT</label>
                    <select {...register(`members.${index}.department`)} style={{ ...inputStyle, cursor: 'pointer' }}>
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

          {/* ── Payment Section (shown after OTP verified) ── */}
          {otpVerified && (
            <div style={{ paddingTop: '16px', marginTop: '4px', borderTop: '2px dashed #a37b45' }}>
              <h4 style={{ ...mc, color: '#315433', fontSize: 'clamp(0.7rem, 2.5vw, 1rem)', marginBottom: '14px' }}>
                💰 PAYMENT ({fields.length} {fields.length === 1 ? 'MEMBER' : 'MEMBERS'})
              </h4>

              {paymentQr ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <p style={{ ...mc, color: '#3c2415', fontSize: 'clamp(0.65rem, 2vw, 0.8rem)', textAlign: 'center', margin: 0 }}>
                    SCAN &amp; PAY <strong>₹{paymentQr.amount}</strong> TO {paymentQr.upi_id}
                  </p>
                  <img
                    src={paymentQr.qr_image}
                    alt="UPI payment QR"
                    style={{ width: 'min(200px, 60vw)', height: 'min(200px, 60vw)', border: '4px solid #3c2415', imageRendering: 'pixelated' }}
                  />
                  <p style={{ ...mc, color: '#3c2415', fontSize: '0.6rem', textAlign: 'center', margin: 0 }}>
                    AFTER PAYING, ENTER THE TRANSACTION ID AND SENDER&apos;S NAME BELOW, THEN SUBMIT.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                  <Loader2 size={24} className="animate-spin" style={{ color: '#3c2415' }} />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>&gt; UPI TRANSACTION ID</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input {...register('transaction_id')} style={inputStyle} placeholder="e.g. 415223987654" />
                    <div style={iconEmoji}>🧾</div>
                  </div>
                  {errors.transaction_id && <p style={{ color: '#b91c1c', fontSize: '0.7rem', marginTop: '4px', fontWeight: 'bold' }}>{errors.transaction_id.message}</p>}
                </div>
                <div>
                  <label style={labelStyle}>&gt; SENDER&apos;S NAME (ON UPI ACCOUNT)</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input {...register('sender_name')} style={inputStyle} placeholder="Name of the person who paid" />
                    <div style={iconEmoji}>🪪</div>
                  </div>
                  {errors.sender_name && <p style={{ color: '#b91c1c', fontSize: '0.7rem', marginTop: '4px', fontWeight: 'bold' }}>{errors.sender_name.message}</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Form Footer ── */}
        <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '2px dashed #a37b45', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>

          {/* Add Member Button */}
          {fields.length < 3 && (
            <button
              type="button"
              onClick={() => append({ name: '', email: '', college_email: '', phone: '', section: '', department: 'CSE', is_team_lead: false })}
              style={{
                ...woodBg,
                padding: '10px 20px',
                color: '#fca311',
                fontSize: 'clamp(0.6rem, 2vw, 0.8rem)',
                ...mc,
                cursor: 'pointer',
                width: '100%',
                maxWidth: '320px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
              className="hover:brightness-110 active:scale-95 transition-all"
            >
              <Plus size={16} /> ADD MEMBER
            </button>
          )}

          {/* Turnstile CAPTCHA */}
          <div style={{ background: 'rgba(60,36,21,0.2)', padding: '8px', borderRadius: '2px', maxWidth: '100%', overflowX: 'auto' }}>
            <Turnstile
              ref={turnstileRef}
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAEB7O-NKSvtQ5iNu'}
              options={{ action: 'turnstile-spin-v2', refreshExpired: 'auto' }}
              onSuccess={(token) => applyTurnstileToken(token)}
              onError={() => applyTurnstileToken(null)}
              onExpire={() => applyTurnstileToken(null)}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isDisabled}
            style={{
              background: isDisabled ? '#444' : '#3e8e2b',
              borderTop: `4px solid ${isDisabled ? '#666' : '#5aba3c'}`,
              borderLeft: `4px solid ${isDisabled ? '#666' : '#5aba3c'}`,
              borderBottom: `4px solid ${isDisabled ? '#222' : '#1f4a15'}`,
              borderRight: `4px solid ${isDisabled ? '#222' : '#1f4a15'}`,
              padding: 'clamp(12px, 3vw, 16px) clamp(20px, 5vw, 32px)',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              color: isDisabled ? '#aaa' : '#fff',
              textShadow: '2px 2px 0 #111',
              fontSize: 'clamp(0.9rem, 3vw, 1.2rem)',
              letterSpacing: '0.1em',
              ...mc,
              width: '100%',
              maxWidth: '384px',
              transition: 'all 0.15s',
            }}
            className={isDisabled ? '' : 'hover:brightness-110 active:scale-95'}
          >
            {isSubmitting ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Loader2 size={18} className="animate-spin" /> PROCESSING...
              </span>
            ) : 'REGISTER NOW'}
          </button>

          {/* Status hint */}
          {!otpVerified && (
            <p style={{ ...mc, color: '#5a3a1a', fontSize: '0.6rem', textAlign: 'center', margin: 0 }}>
              ↑ Complete the CAPTCHA and verify your college email to unlock registration
            </p>
          )}

          {/* Bottom tag */}
          <div style={{ ...woodBg, padding: '8px 18px' }}>
            <span style={{ ...mc, color: '#d4c4a8', fontSize: 'clamp(0.55rem, 1.8vw, 0.7rem)', letterSpacing: '0.1em' }}>
              GEAR UP. CODE ON. CONQUER.
            </span>
          </div>
        </div>
      </div>
    </form>
  );
}
