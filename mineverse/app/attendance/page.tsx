'use client';

import { useEffect, useState } from 'react';
import { Scanner } from '@/components/attendance/scanner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function AttendancePanel() {
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<string>('');
  
  const [scannedTeam, setScannedTeam] = useState<any>(null);
  const [membersPresent, setMembersPresent] = useState<number>(0);
  const [isResolving, setIsResolving] = useState(false);
  const [scanCooldown, setScanCooldown] = useState(false);

  useEffect(() => {
    fetch('/api/attendance/checkpoints')
      .then(r => r.json())
      .then(d => { if (d.success) setCheckpoints(d.data); });
  }, []);

  const handleScan = async (data: string) => {
    if (scanCooldown || scannedTeam || isResolving) return;
    setIsResolving(true);
    setScanCooldown(true);
    setTimeout(() => setScanCooldown(false), 2000);

    try {
      const res = await fetch('/api/attendance/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_token: data })
      });
      const result = await res.json();
      
      if (result.success) {
        setScannedTeam(result.data);
        setMembersPresent(result.data.team_size);
        toast.success(`Team ${result.data.team_code} found!`);
      } else {
        toast.error(result.error);
      }
    } catch (e) {
      toast.error('Network error scanning QR');
    } finally {
      setIsResolving(false);
    }
  };

  const handleMarkAttendance = async () => {
    if (!selectedCheckpoint) return toast.error('Select a checkpoint first');
    if (!scannedTeam) return;

    try {
      const res = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: scannedTeam.id,
          checkpoint_id: selectedCheckpoint,
          members_present: membersPresent,
          method: 'qr_scan'
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Attendance marked successfully!');
        setScannedTeam(null);
      } else {
        toast.error(data.error);
      }
    } catch (e) {
      toast.error('Failed to mark attendance');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-6">
        <header className="flex justify-between items-center border-b border-slate-800 pb-4">
          <h1 className="text-2xl font-bold text-cyan-400">Scanner Mode</h1>
          <Button variant="ghost" onClick={() => {
            fetch('/api/panel/logout', { method: 'POST' }).then(() => window.location.href = '/');
          }}>Logout</Button>
        </header>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-200">Active Checkpoint</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedCheckpoint} onValueChange={setSelectedCheckpoint}>
              <SelectTrigger className="bg-slate-950 border-slate-800 text-white h-12 text-lg">
                <SelectValue placeholder="Select current checkpoint..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                {checkpoints.map(cp => (
                  <SelectItem key={cp.id} value={cp.id.toString()}>{cp.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedCheckpoint ? (
          scannedTeam ? (
            <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-cyan-500 shadow-xl shadow-cyan-900/20">
              <CardHeader>
                <CardTitle className="text-xl text-white">Team Details: {scannedTeam.team_code}</CardTitle>
                <p className="text-slate-400">{scannedTeam.team_name}</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-lg">
                  <div>
                    <Label className="text-slate-500">Registered Size</Label>
                    <div className="text-2xl font-bold">{scannedTeam.team_size}</div>
                  </div>
                  <div>
                    <Label className="text-slate-500">Members Present</Label>
                    <Input 
                      type="number" 
                      min={0} 
                      max={scannedTeam.team_size} 
                      value={membersPresent}
                      onChange={(e) => setMembersPresent(parseInt(e.target.value) || 0)}
                      className="bg-slate-800 border-slate-700 text-xl font-bold h-10 w-24"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button variant="outline" className="flex-1 border-slate-700 text-slate-300" onClick={() => setScannedTeam(null)}>Cancel</Button>
                  <Button className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold" onClick={handleMarkAttendance}>
                    Mark Attendance
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              <Scanner onScan={handleScan} />
              <p className="text-center text-sm text-slate-500">Point camera at team QR code</p>
            </div>
          )
        ) : (
          <div className="text-center p-8 bg-slate-900 border border-slate-800 rounded-lg text-slate-400">
            Please select a checkpoint above to start scanning.
          </div>
        )}
      </div>
    </div>
  );
}
