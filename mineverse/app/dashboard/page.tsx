'use client';

import { useEffect, useState } from 'react';
import { supabaseClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock, Unlock, CheckCircle2 } from 'lucide-react';

export default function DashboardPage() {
  const [team, setTeam] = useState<any>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We get the team_id from the session endpoint or we just query by auth?
    // Wait, the client is anon, it can't fetch unless RLS allows.
    // Ah, RLS is deny-all! The dashboard must be server components or fetch from a Next API!
    // Since RLS is deny-all, Supabase client cannot fetch team data. I need an API route!
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const res = await fetch('/api/dashboard/data');
    const json = await res.json();
    if (json.success) {
      setTeam(json.team);
      setRounds(json.rounds);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!team) return;
    
    // Subscribe to team_round_access changes for THIS team (Supabase realtime on Postgres changes bypasses RLS? NO, it respects RLS unless WAL is exposed)
    // Wait! Since RLS is deny-all, realtime will NOT work for anon client!
    // Instead of raw postgres changes, we can use Supabase Broadcast channels!
    // The admin API will broadcast 'round_status' events.
    const channel = supabaseClient.channel('round_status')
      .on('broadcast', { event: 'unlock' }, (payload) => {
        if (payload.payload.team_id === team.id || payload.payload.team_id === 'all') {
          fetchDashboardData(); // Refetch
        }
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [team]);

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white tracking-tight">Welcome, {team?.team_name}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rounds.map((r: any) => (
          <Card key={r.round_id} className={`bg-slate-900 border-slate-800 relative overflow-hidden ${!r.is_locked ? 'border-emerald-500/50 shadow-lg shadow-emerald-900/20' : ''}`}>
            {r.is_locked && <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-slate-500" />
            </div>}
            
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg text-slate-200">{r.rounds.name}</CardTitle>
                {r.completed_at ? (
                  <CheckCircle2 className="text-emerald-500 w-5 h-5" />
                ) : !r.is_locked ? (
                  <Unlock className="text-emerald-400 w-5 h-5" />
                ) : null}
              </div>
              <p className="text-sm text-slate-400">Day {r.rounds.day} • Round {r.rounds.sequence}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-300 text-sm">{r.rounds.description}</p>
              
              <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                <span className="text-slate-400 text-sm">Time Allotted:</span>
                <Badge variant="outline" className="text-slate-300 border-slate-700">{r.rounds.time_allotted} min</Badge>
              </div>

              {!r.is_locked && !r.completed_at && (
                <div className="pt-2">
                  <div className="text-emerald-400 text-sm font-bold animate-pulse text-center bg-emerald-500/10 py-2 rounded-lg border border-emerald-500/20">
                    ROUND ACTIVE!
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
