'use client';

import { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = async () => {
    const res = await fetch('/api/admin/payments');
    const json = await res.json();
    if (json.success) setPayments(json.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleVerify = async (id: string) => {
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: id, action: 'verify' })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Payment verified! Emails sent.');
        fetchPayments();
      } else {
        toast.error(data.error || 'Failed to verify');
      }
    } catch (e) {
      toast.error('Network error');
    }
  };

  if (loading) return <div>Loading payments...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white tracking-tight">Payments Verification</h2>
      
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-950">
            <TableRow className="border-slate-800">
              <TableHead className="text-slate-400">Team Code</TableHead>
              <TableHead className="text-slate-400">Amount</TableHead>
              <TableHead className="text-slate-400">Size</TableHead>
              <TableHead className="text-slate-400">Status</TableHead>
              <TableHead className="text-slate-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map(p => (
              <TableRow key={p.id} className="border-slate-800 hover:bg-slate-800/50">
                <TableCell className="font-medium text-slate-200">{p.teams?.team_code}</TableCell>
                <TableCell className="text-slate-300">₹{p.amount}</TableCell>
                <TableCell className="text-slate-300">{p.team_size}</TableCell>
                <TableCell>
                  {p.status === 'verified' ? (
                    <Badge className="bg-emerald-500/20 text-emerald-400">Verified</Badge>
                  ) : (
                    <Badge className="bg-amber-500/20 text-amber-400">Pending</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {p.status === 'pending' && (
                    <Button size="sm" onClick={() => handleVerify(p.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                      Verify & Send QR
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500 py-8">No payments found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
