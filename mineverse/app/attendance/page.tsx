'use client';

import { useCallback, useEffect, useState } from 'react';
import { Scanner } from '@/components/attendance/scanner';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const CHECKPOINT_KEY = 'mnv.attendance.checkpoint';

type Member = { id: string; name: string; is_team_lead: boolean };

type ResolvedTeam = {
  id: string;
  team_code: string;
  team_name: string;
  team_size: number;
  is_payment_verified: boolean;
  members: Member[];
  existing: { member_ids: string[]; members_present: number } | null;
};

export default function AttendancePanel() {
  const [checkpoints, setCheckpoints] = useState<{ id: number; label: string }[]>([]);
  const [checkpoint, setCheckpoint] = useState('');
  const [team, setTeam] = useState<ResolvedTeam | null>(null);
  const [method, setMethod] = useState<'qr_scan' | 'manual'>('qr_scan');
  const [present, setPresent] = useState<string[]>([]);
  const [manualCode, setManualCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/attendance/checkpoints')
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        setCheckpoints(d.data);
        // The marshal picks their checkpoint once per shift, not once per team.
        const saved = localStorage.getItem(CHECKPOINT_KEY);
        if (saved && d.data.some((c: { id: number }) => c.id.toString() === saved)) setCheckpoint(saved);
      })
      .catch(() => toast.error('Could not load checkpoints'));
  }, []);

  const selectCheckpoint = (value: string | null) => {
    const next = value ?? '';
    setCheckpoint(next);
    localStorage.setItem(CHECKPOINT_KEY, next);
  };

  const resolve = useCallback(
    async (code: string, via: 'qr_scan' | 'manual') => {
      if (busy || team) return;
      if (!checkpoint) return toast.error('Pick a checkpoint first');

      setBusy(true);
      try {
        const res = await fetch('/api/attendance/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, checkpoint_id: Number(checkpoint) }),
        });
        const json = await res.json();
        if (!json.success) return toast.error(json.error);

        const resolved: ResolvedTeam = json.data;
        setTeam(resolved);
        setMethod(via);
        // Re-marking restores the previous ticks; a fresh mark assumes everyone showed up.
        setPresent(resolved.existing?.member_ids ?? resolved.members.map((m) => m.id));
        setManualCode('');
      } catch {
        toast.error('Network error — try again');
      } finally {
        setBusy(false);
      }
    },
    [busy, team, checkpoint],
  );

  const toggleMember = (id: string) =>
    setPresent((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));

  const mark = async () => {
    if (!team) return;
    setBusy(true);
    try {
      const res = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: team.id,
          checkpoint_id: Number(checkpoint),
          member_ids: present,
          method,
        }),
      });
      const json = await res.json();
      if (!json.success) return toast.error(json.error);

      toast.success(
        `${team.team_code} — ${present.length}/${team.team_size} present${json.updated ? ' (updated)' : ''}`,
      );
      setTeam(null);
      setPresent([]);
    } catch {
      toast.error('Failed to mark attendance');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto w-full max-w-md space-y-4 p-4 sm:max-w-lg sm:p-6">
        <header className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <h1 className="text-lg font-bold text-cyan-400 sm:text-xl">Attendance</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetch('/api/panel/logout', { method: 'POST' }).then(() => (window.location.href = '/'))}
          >
            Logout
          </Button>
        </header>

        <Select value={checkpoint} onValueChange={selectCheckpoint}>
          <SelectTrigger className="h-12 w-full border-slate-800 bg-slate-900 text-base text-white">
            <SelectValue placeholder="Select checkpoint" />
          </SelectTrigger>
          <SelectContent className="border-slate-800 bg-slate-900 text-white">
            {checkpoints.map((cp) => (
              <SelectItem key={cp.id} value={cp.id.toString()}>
                {cp.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!checkpoint ? (
          <p className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-400">
            Pick a checkpoint to start marking.
          </p>
        ) : team ? (
          <Card className="border-slate-800 bg-slate-900">
            <CardContent className="space-y-4 p-4">
              <div>
                <p className="font-mono text-lg font-bold text-cyan-400">{team.team_code}</p>
                <p className="text-sm text-slate-400">{team.team_name}</p>
                {!team.is_payment_verified && (
                  <p className="mt-2 rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-400">
                    Payment not verified — check with the desk before marking.
                  </p>
                )}
                {team.existing && (
                  <p className="mt-2 text-xs text-slate-500">
                    Already marked here ({team.existing.members_present}/{team.team_size}). Saving will update it.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Who is present?</p>
                {team.members.map((member) => (
                  <label
                    key={member.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 p-3 active:bg-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={present.includes(member.id)}
                      onChange={() => toggleMember(member.id)}
                      className="h-5 w-5 shrink-0 accent-cyan-500"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">{member.name}</span>
                    {member.is_team_lead && <span className="shrink-0 text-xs text-slate-500">Lead</span>}
                  </label>
                ))}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="h-12 flex-1 border-slate-700 text-slate-300"
                  onClick={() => setTeam(null)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button
                  className="h-12 flex-1 bg-cyan-600 font-bold text-white hover:bg-cyan-500"
                  onClick={mark}
                  disabled={busy}
                >
                  Mark {present.length}/{team.team_size}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Scanner onScan={(code) => resolve(code, 'qr_scan')} />
            <p className="text-center text-xs text-slate-500">Scan the team QR, or type the code below</p>

            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                resolve(manualCode, 'manual');
              }}
            >
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="MNV-000"
                autoCapitalize="characters"
                autoCorrect="off"
                className="h-12 flex-1 border-slate-800 bg-slate-900 font-mono text-base text-white"
              />
              <Button type="submit" className="h-12 bg-slate-700 px-6 hover:bg-slate-600" disabled={busy}>
                Find
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
