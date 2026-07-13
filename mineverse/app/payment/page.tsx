'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import Image from 'next/image';

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
        ) : (
          <>
            {data.qr_image ? (
              <div className="bg-white p-4 rounded-xl shadow-lg">
                <Image src={data.qr_image} alt="Payment QR" width={250} height={250} className="w-64 h-64 object-contain" />
              </div>
            ) : (
              <div className="w-64 h-64 bg-slate-800 rounded-xl flex items-center justify-center text-slate-500">
                QR Not Available
              </div>
            )}

            {data.qr_image && (
              <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white" asChild>
                <a href={data.qr_image} download={`payment-qr-${data.team_code}.png`}>
                  <Download className="w-4 h-4 mr-2" /> Download QR
                </a>
              </Button>
            )}

            <div className="w-full bg-slate-950 p-6 rounded-lg border border-slate-800">
              <h3 className="font-semibold text-slate-200 mb-4">Instructions</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-slate-400">
                <li>Scan the QR code using any UPI app (GPay, PhonePe, Paytm).</li>
                <li>Pay the exact amount of <strong className="text-white">₹{data.amount}</strong>.</li>
                <li>Do not modify the remarks/note. It must be <strong className="text-white">Team-{data.team_code}</strong>.</li>
                <li>Wait for an admin to verify your payment. This page will automatically update.</li>
              </ol>
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
