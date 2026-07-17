'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function PaymentContent() {
  const searchParams = useSearchParams();
  const teamCode = searchParams.get('team');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!teamCode) {
      setError('No team code provided');
      setLoading(false);
      return;
    }

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/payment/status?team=${teamCode}`);
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error || 'Failed to load payment details');
        }
      } catch (err) {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();

    const interval = setInterval(() => {
      if (data?.payment_status === 'pending') {
        fetchStatus();
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [teamCode, data?.payment_status]);

  if (loading) return <div className="text-center p-12 text-slate-400">Loading payment details...</div>;
  if (error) return <div className="text-center p-12 text-red-400">{error}</div>;
  if (!data) return null;

  const mc = { fontFamily: 'var(--font-minecraft), system-ui, sans-serif' };

  return (
    <div className="relative min-h-[600px] flex items-center justify-center p-4">
      {/* Container */}
      <div 
        className="w-full max-w-2xl mx-auto shadow-[8px_8px_0_rgba(0,0,0,0.5)]"
        style={{
          background: '#1a110a',
          borderTop: '6px solid #332316',
          borderLeft: '6px solid #332316',
          borderBottom: '6px solid #000000',
          borderRight: '6px solid #000000',
        }}
      >
        <div className="p-6 border-b-4 border-[#332316]">
          <h2 style={{ ...mc, fontSize: '1.5rem', color: '#fde047', textShadow: '2px 2px 0 #000', letterSpacing: '0.1em', textAlign: 'center' }}>
            PAYMENT PORTAL
          </h2>
          <p style={{ ...mc, fontSize: '0.7rem', color: '#aaaaaa', textAlign: 'center', marginTop: '8px' }}>
            TEAM {data.team_code}
          </p>
        </div>

        <div className="p-8 space-y-8 flex flex-col items-center">
          <div className="flex flex-col items-center gap-4">
            <span style={{ ...mc, fontSize: '0.8rem', color: '#aaaaaa' }}>AMOUNT DUE</span>
            <span style={{ ...mc, fontSize: '2.5rem', color: '#ffffff', textShadow: '3px 3px 0 #000' }}>₹{data.amount}</span>
          </div>

          <div className="flex flex-col items-center gap-3">
            <span style={{ ...mc, fontSize: '0.8rem', color: '#aaaaaa' }}>STATUS</span>
            <div style={{
              background: data.payment_status === 'verified' ? '#166534' : data.payment_status === 'rejected' ? '#991b1b' : '#854d0e',
              borderTop: '3px solid',
              borderLeft: '3px solid',
              borderBottom: '3px solid #000',
              borderRight: '3px solid #000',
              borderColor: data.payment_status === 'verified' ? '#22c55e' : data.payment_status === 'rejected' ? '#ef4444' : '#eab308',
              padding: '12px 20px',
            }}>
              <span style={{ ...mc, fontSize: '0.9rem', color: '#ffffff', textShadow: '1px 1px 0 #000' }}>
                {data.payment_status === 'verified' ? 'VERIFIED' : data.payment_status === 'rejected' ? 'REJECTED' : 'PENDING'}
              </span>
            </div>
          </div>

          {data.payment_status === 'verified' ? (
            <div style={{
              width: '100%',
              background: '#4a3320',
              borderTop: '3px solid #6c4b31',
              borderLeft: '3px solid #6c4b31',
              borderBottom: '3px solid #1f140c',
              borderRight: '3px solid #1f140c',
              padding: '20px',
              textAlign: 'center'
            }}>
              <p style={{ ...mc, fontSize: '1rem', color: '#4ade80', textShadow: '1px 1px 0 #000', marginBottom: '10px' }}>PAYMENT VERIFIED!</p>
              <p style={{ ...mc, fontSize: '0.65rem', color: '#aaaaaa', lineHeight: '1.6' }}>
                CHECK YOUR EMAIL FOR THE ATTENDANCE QR CODE AND WHATSAPP GROUP LINK.
              </p>
            </div>
          ) : data.payment_status === 'rejected' ? (
            <div style={{
              width: '100%',
              background: '#4a3320',
              borderTop: '3px solid #6c4b31',
              borderLeft: '3px solid #6c4b31',
              borderBottom: '3px solid #1f140c',
              borderRight: '3px solid #1f140c',
              padding: '20px',
              textAlign: 'center'
            }}>
              <p style={{ ...mc, fontSize: '1rem', color: '#f87171', textShadow: '1px 1px 0 #000', marginBottom: '10px' }}>PAYMENT REJECTED</p>
              <p style={{ ...mc, fontSize: '0.65rem', color: '#aaaaaa', lineHeight: '1.6' }}>
                THERE WAS AN ISSUE VERIFYING YOUR PAYMENT. PLEASE CONTACT THE ORGANIZERS.
              </p>
            </div>
          ) : (
            <div className="w-full space-y-6">
              <div style={{
                background: '#4a3320',
                borderTop: '3px solid #6c4b31',
                borderLeft: '3px solid #6c4b31',
                borderBottom: '3px solid #1f140c',
                borderRight: '3px solid #1f140c',
                padding: '20px',
              }}>
                <h3 style={{ ...mc, fontSize: '0.8rem', color: '#fde047', textShadow: '1px 1px 0 #000', marginBottom: '16px', textAlign: 'center' }}>
                  SUBMITTED DETAILS
                </h3>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row md:justify-between gap-2">
                    <span style={{ ...mc, fontSize: '0.65rem', color: '#aaaaaa' }}>TRANSACTION ID</span>
                    <span style={{ ...mc, fontSize: '0.75rem', color: '#ffffff' }}>{data.transaction_id}</span>
                  </div>
                  <div className="flex flex-col md:flex-row md:justify-between gap-2">
                    <span style={{ ...mc, fontSize: '0.65rem', color: '#aaaaaa' }}>SENDER NAME</span>
                    <span style={{ ...mc, fontSize: '0.75rem', color: '#ffffff' }}>{data.sender_name.toUpperCase()}</span>
                  </div>
                </div>
              </div>

              <div style={{
                background: '#1a110a',
                border: '2px solid #332316',
                padding: '16px',
              }}>
                <p style={{ ...mc, fontSize: '0.6rem', color: '#888888', lineHeight: '1.8', textAlign: 'center' }}>
                  YOUR PAYMENT WAS RECORDED DURING REGISTRATION AND IS NOW AWAITING MANUAL VERIFICATION. 
                  THIS PAGE UPDATES AUTOMATICALLY — YOU WILL RECEIVE A CONFIRMATION EMAIL WITH YOUR ATTENDANCE QR ONCE VERIFIED.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-50 p-6" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1a1a1a 0%, #050505 100%)' }}>
      <div className="max-w-5xl mx-auto">
        <Suspense fallback={<div className="text-center p-12">Loading...</div>}>
          <PaymentContent />
        </Suspense>
      </div>
    </div>
  );
}
