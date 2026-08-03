'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Search } from 'lucide-react';
import { Panel, Btn, Pill, Table, Empty, Loading, PageTitle, apiCall, Grid, StatTile } from '@/components/admin/nether-ui';

type PaymentRow = {
  id: string;
  amount: number;
  transaction_id: string | null;
  sender_upi_id: string | null;
  sender_name: string | null;
  status: string;
  created_at: string;
  teams?: { team_code: string; team_name: string; is_payment_verified: boolean } | null;
};

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showPendingOnly, setShowPendingOnly] = useState(false);

  const load = useCallback(async () => {
    const res = await apiCall<PaymentRow[]>('/api/admin/payments');
    if (res.ok) setPayments(res.data ?? []);
    else toast.error(res.message);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const verify = async (id: string) => {
    setBusyId(id);
    const res = await apiCall('/api/admin/payments', {
      method: 'POST',
      body: JSON.stringify({ payment_id: id, action: 'verify' }),
    });
    setBusyId(null);

    if (res.ok) {
      toast.success('Payment verified — QR emailed to every member');
      void load();
    } else {
      toast.error(res.message);
    }
  };

  if (!payments) {
    return (<><PageTitle title="Payments" /><Panel><Loading label="Loading payments" /></Panel></>);
  }

  const pending = payments.filter((p) => p.status === 'pending');
  const collected = payments.filter((p) => p.status === 'verified').reduce((sum, p) => sum + (p.amount ?? 0), 0);

  const needle = query.trim().toLowerCase();
  const visible = payments.filter((p) => {
    if (showPendingOnly && p.status !== 'pending') return false;
    if (!needle) return true;
    return (
      p.teams?.team_code?.toLowerCase().includes(needle) ||
      p.teams?.team_name?.toLowerCase().includes(needle) ||
      p.transaction_id?.toLowerCase().includes(needle) ||
      p.sender_upi_id?.toLowerCase().includes(needle)
    );
  });

  return (
    <>
      <PageTitle
        title="Payments"
        subtitle="Verifying a payment issues the team's attendance QR and emails every member"
        actions={<Btn onClick={load}><RefreshCw size={12} /> Refresh</Btn>}
      />

      <Grid min={190}>
        <StatTile label="Total records" value={payments.length} />
        <StatTile label="Awaiting verification" value={pending.length} hint={pending.length ? 'Action needed' : 'All clear'} />
        <StatTile label="Collected" value={`₹${collected.toLocaleString('en-IN')}`} hint="Verified payments only" />
      </Grid>

      <div style={{ marginTop: 12 }}>
        <Panel
          title={`Records (${visible.length})`}
          actions={
            <>
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-portal)' }} />
                <input
                  className="n-input"
                  style={{ paddingLeft: 24, width: 190 }}
                  placeholder="Team, txn or UPI"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <Btn
                variant={showPendingOnly ? 'primary' : 'ghost'}
                small
                onClick={() => setShowPendingOnly((v) => !v)}
              >
                Pending only
              </Btn>
            </>
          }
        >
          <Table head={['Team', 'Amount', 'Transaction', 'Sender UPI', 'Status', '']}>
            {visible.map((p) => (
              <tr key={p.id}>
                <td>
                  <div>{p.teams?.team_code ?? '—'}</div>
                  <div className="n-panel-sub">{p.teams?.team_name ?? ''}</div>
                </td>
                <td>₹{p.amount}</td>
                <td className="n-mono">{p.transaction_id || '—'}</td>
                <td className="n-mono">{p.sender_upi_id || '—'}</td>
                <td>
                  <Pill tone={p.status === 'verified' ? 'ok' : 'warn'}>{p.status}</Pill>
                </td>
                <td style={{ textAlign: 'right' }}>
                  {p.status === 'pending' && (
                    <Btn variant="primary" small disabled={busyId === p.id} onClick={() => verify(p.id)}>
                      {busyId === p.id ? 'Verifying…' : 'Verify & send QR'}
                    </Btn>
                  )}
                </td>
              </tr>
            ))}
            {visible.length === 0 && <Empty colSpan={6}>No matching payments</Empty>}
          </Table>
        </Panel>
      </div>
    </>
  );
}
