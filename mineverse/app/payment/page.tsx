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

  return (
    <Card className="max-w-xl mx-auto mt-12 bg-slate-900 border-slate-800">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl text-slate-100">Payment for Team {data.team_code}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 flex flex-col items-center">
        <div className="flex items-center gap-4">
          <span className="text-lg text-slate-400">Amount Due:</span>
          <span className="text-3xl font-bold text-white">₹{data.amount}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Status:</span>
          {data.payment_status === 'verified' ? (
            <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">Verified</Badge>
          ) : data.payment_status === 'rejected' ? (
            <Badge variant="destructive">Rejected</Badge>
          ) : (
            <Badge className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30">Pending Verification</Badge>
          )}
        </div>

        {data.payment_status === 'verified' ? (
          <div className="text-emerald-400 bg-emerald-500/10 p-4 rounded-lg text-center w-full border border-emerald-500/20">
            <p className="font-bold mb-2">Payment Verified! 🎉</p>
            <p className="text-sm text-emerald-500/80">Check your email for the attendance QR code and WhatsApp group link.</p>
          </div>
        ) : data.payment_status === 'rejected' ? (
          <div className="text-red-400 bg-red-500/10 p-4 rounded-lg text-center w-full border border-red-500/20">
            <p className="font-bold mb-2">Payment Rejected</p>
            <p className="text-sm text-red-500/80">There was an issue verifying your payment. Please contact the organizers.</p>
          </div>
        ) : (
          <>
            <div className="w-full bg-slate-950 p-6 rounded-lg border border-slate-800 space-y-3">
              <h3 className="font-semibold text-slate-200 mb-2">Submitted Payment Details</h3>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Transaction ID</span>
                <span className="text-white font-mono">{data.transaction_id}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Sender Name</span>
                <span className="text-white">{data.sender_name}</span>
              </div>
            </div>

            <div className="w-full bg-slate-950 p-6 rounded-lg border border-slate-800">
              <p className="text-sm text-slate-400">
                Your payment was recorded during registration and is now awaiting verification by the organizers.
                This page updates automatically — you&apos;ll also receive a confirmation email with your attendance QR once verified.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function PaymentPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <Suspense fallback={<div className="text-center p-12">Loading...</div>}>
          <PaymentContent />
        </Suspense>
      </div>
    </div>
  );
}
