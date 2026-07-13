'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Play, Square, Clock } from 'lucide-react';

export default function AdminRoundsPage() {
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRounds = async () => {
    const res = await fetch('/api/admin/rounds');
    const json = await res.json();
    if (json.success) setRounds(json.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchRounds();
  }, []);

  const handleToggle = async (id: number) => {
    try {
      const res = await fetch('/api/admin/rounds/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round_id: id, action: 'toggle' })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Round status changed to ${data.newStatus}`);
        fetchRounds();
      }
    } catch (e) {
      toast.error('Network error');
    }
  };

  const handleExtend = async (id: number) => {
    try {
      const res = await fetch('/api/admin/rounds/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round_id: id, action: 'extend', minutes: 10 })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Round extended by 10 minutes');
        fetchRounds();
      }
    } catch (e) {
      toast.error('Network error');
    }
  };

  if (loading) return <div>Loading rounds...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white tracking-tight">Round Controls</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {rounds.map(r => (
          <Card key={r.id} className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <CardTitle className="text-xl text-slate-200">{r.name}</CardTitle>
                <p className="text-sm text-slate-400">Day {r.day} • Round {r.sequence}</p>
              </div>
              <Badge className={
                r.status === 'locked' ? 'bg-slate-800 text-slate-400' : 
                r.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 
                'bg-blue-500/20 text-blue-400'
              }>
                {r.status.toUpperCase()}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex justify-between items-center text-sm text-slate-300">
                <span>Base Time: {r.time_allotted}m</span>
                {r.starts_at && <span>Started: {new Date(r.starts_at).toLocaleTimeString()}</span>}
              </div>

              <div className="flex gap-2 pt-4">
                {r.status === 'locked' ? (
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white" onClick={() => handleToggle(r.id)}>
                    <Play className="w-4 h-4 mr-2" /> Start Round
                  </Button>
                ) : r.status === 'active' ? (
                  <>
                    <Button variant="outline" className="flex-1 border-slate-700 text-slate-300" onClick={() => handleExtend(r.id)}>
                      <Clock className="w-4 h-4 mr-2" /> +10m
                    </Button>
                    <Button className="flex-1 bg-red-600 hover:bg-red-500 text-white" onClick={() => handleToggle(r.id)}>
                      <Square className="w-4 h-4 mr-2" /> End Round
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" className="w-full border-slate-700 text-slate-500" disabled>
                    Round Completed
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
