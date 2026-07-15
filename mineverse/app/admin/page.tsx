'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Users, CreditCard, CheckCircle2, Clock } from 'lucide-react';

type TeamRow = {
  id: string;
  team_size: number;
  is_payment_verified: boolean;
  status: string;
};

export default function AdminDashboardPage() {
  const [teams, setTeams] = useState<TeamRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/teams')
      .then(res => res.json())
      .then(json => {
        if (json.success) setTeams(json.data);
        else setError(json.error || 'Failed to load teams');
      })
      .catch(() => setError('Network error'));
  }, []);

  if (error) return <div className="p-8 text-red-400">{error}</div>;
  if (!teams) return <div className="p-8 text-slate-400">Loading dashboard...</div>;

  const totalTeams = teams.length;
  const totalParticipants = teams.reduce((sum, t) => sum + t.team_size, 0);
  const verified = teams.filter(t => t.is_payment_verified).length;
  const pending = totalTeams - verified;

  const stats = [
    { label: 'Total Teams', value: totalTeams, icon: Users, color: 'text-sky-400' },
    { label: 'Participants', value: totalParticipants, icon: Users, color: 'text-slate-300' },
    { label: 'Payments Verified', value: verified, icon: CheckCircle2, color: 'text-emerald-400' },
    { label: 'Pending Verification', value: pending, icon: Clock, color: 'text-amber-400' },
  ];

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-white tracking-tight">Overview</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map(stat => (
          <Card key={stat.label} className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">{stat.label}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/admin/payments">
          <Card className="bg-slate-900 border-slate-800 hover:border-emerald-500/50 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg text-slate-200 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-400" /> Verify Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400">
                {pending > 0
                  ? `${pending} team${pending === 1 ? '' : 's'} waiting for payment verification.`
                  : 'All payments verified.'}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/rounds">
          <Card className="bg-slate-900 border-slate-800 hover:border-emerald-500/50 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg text-slate-200 flex items-center gap-2">
                <Clock className="h-5 w-5 text-sky-400" /> Manage Rounds
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400">Unlock, lock, or extend rounds on event day.</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
