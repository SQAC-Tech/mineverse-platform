'use client';

import { useCallback, useEffect, useState } from 'react';
import { Scanner } from '@/components/attendance/scanner';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  registrationYears, splitRegistrationNo, joinRegistrationNo,
  academicYearFromRegistrationNo,
  REG_NO_SUFFIX_LENGTH, REGISTRATION_NO,
} from '@/lib/registration-no';

const CHECKPOINT_KEY = 'mnv.attendance.checkpoint';
const YEARS = registrationYears();

type Member = {
  id: string;
  name: string;
  is_team_lead: boolean;
  /** Null for anyone who registered before the field existed — ask them here. */
  registration_no: string | null;
};

type Checkpoint = {
  id: number;
  code: string;
  label: string;
  day: number;
  covers_rounds: number[];
  marked: number;
  expected: number;
};

type ResolvedTeam = {
  id: string;
  team_code: string;
  team_name: string;
  team_size: number;
  /** Members actually on the roster. The denominator — see the API note. */
  roster_size: number;
  size_mismatch: boolean;
  is_payment_verified: boolean;
  /** False when this team has no seat at this checkpoint — see `markingEntitlement`. */
  entitled: boolean;
  entitlement_message: string | null;
  members: Member[];
  existing: { member_ids: string[]; members_present: number; marked_at: string; method: string } | null;
  history: { checkpoint_id: number; members_present: number; label: string }[];
};

function time(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

/**
 * The admission year a registration number encodes, as a label.
 *
 * Shown beside each name because the desk is checking college IDs: a number the
 * volunteer cannot see is a number they cannot check against the card in front
 * of them. The page only ever displayed these for members who did *not* have
 * one, which is exactly backwards.
 */
function yearOf(registrationNo: string | null) {
  const year = academicYearFromRegistrationNo(registrationNo);
  return year === null ? null : `${year === 1 ? '1st' : year === 2 ? '2nd' : `${year}rd+`} yr`;
}

export default function AttendancePanel() {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [checkpoint, setCheckpoint] = useState('');
  const [team, setTeam] = useState<ResolvedTeam | null>(null);
  const [method, setMethod] = useState<'qr_scan' | 'manual'>('qr_scan');
  const [present, setPresent] = useState<string[]>([]);
  const [manualCode, setManualCode] = useState('');
  const [busy, setBusy] = useState(false);
  /** Registration numbers typed at the desk, keyed by member id. */
  const [regNos, setRegNos] = useState<Record<string, string>>({});

  /**
   * Reloaded after every mark, not just on open, so the desk's counter is live.
   * `restore` only runs on the first load — re-reading the saved checkpoint
   * later would fight a marshal who has just switched desks.
   */
  const loadCheckpoints = useCallback((restore = false) => {
    fetch('/api/attendance/checkpoints', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        setCheckpoints(d.data);
        if (!restore) return;
        // The marshal picks their checkpoint once per shift, not once per team.
        const saved = localStorage.getItem(CHECKPOINT_KEY);
        if (saved && d.data.some((c: Checkpoint) => c.id.toString() === saved)) setCheckpoint(saved);
      })
      .catch(() => toast.error('Could not load checkpoints'));
  }, []);

  useEffect(() => { loadCheckpoints(true); }, [loadCheckpoints]);

  const selectCheckpoint = (value: string | null) => {
    const next = value ?? '';
    setCheckpoint(next);
    localStorage.setItem(CHECKPOINT_KEY, next);
  };

  const resolve = useCallback(
    async (code: string, via: 'qr_scan' | 'manual') => {
      if (busy) return;
      /**
       * A card is already open.
       *
       * This used to return silently, so a marshal who scanned the next team's
       * QR while the previous card was still up saw nothing happen at all and
       * assumed the scanner had failed. It has to say something — and it must
       * not just swap the card, because the ticks on screen may be unsaved.
       */
      if (team) {
        toast.info(`Finish ${team.team_code} first — Mark or Cancel.`);
        return;
      }
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
        setRegNos({});
        setManualCode('');
      } catch {
        toast.error('Network error — try again');
      } finally {
        setBusy(false);
      }
    },
    [busy, team, checkpoint],
  );

  const active = checkpoints.find((cp) => cp.id.toString() === checkpoint) ?? null;

  const toggleMember = (id: string) =>
    setPresent((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));

  /**
   * A member only needs asking if they are being marked present and have
   * nothing on file. Absentees are left alone — chasing a number for someone
   * who did not turn up just holds up the queue.
   */
  const needsRegNo = (member: Member) => present.includes(member.id) && !member.registration_no;

  const mark = async () => {
    if (!team) return;

    // Checks the whole 15-character value, so "year picked but no digits typed"
    // is caught here rather than bouncing off the server.
    const incomplete = team.members.filter(
      (m) => needsRegNo(m) && !REGISTRATION_NO.test(regNos[m.id] ?? ''),
    );
    if (incomplete.length > 0) {
      return toast.error(
        `Complete the registration number for ${incomplete.map((m) => m.name).join(', ')}`,
      );
    }

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
          registration_numbers: regNos,
        }),
      });
      const json = await res.json();
      if (!json.success) return toast.error(json.error);

      toast.success(
        `${team.team_code} — ${present.length}/${team.roster_size} present${json.updated ? ' (updated)' : ''}`,
      );
      setTeam(null);
      setPresent([]);
      setRegNos({});
      // Keeps the desk counter honest without a reload.
      loadCheckpoints();
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

        {/*
          What this desk is for, and how far it has got.
          A marshal working a queue could not tell whether they were twenty
          teams in or nearly done without asking someone with a laptop.
        */}
        {active && (
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Admits {active.covers_rounds.length > 1 ? 'rounds' : 'round'}{' '}
                {active.covers_rounds.join(' & ')}
              </p>
              <p className="font-mono text-sm text-slate-300">
                <span className="font-bold text-cyan-400">{active.marked}</span>
                <span className="text-slate-500"> / {active.expected} teams</span>
              </p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-cyan-500 transition-all"
                style={{
                  width: `${active.expected > 0 ? Math.min(100, (active.marked / active.expected) * 100) : 0}%`,
                }}
              />
            </div>
            {active.expected === 0 && (
              <p className="mt-2 text-xs text-amber-400">
                No teams are eligible for this desk yet — RSVPs may not be marked.
              </p>
            )}
          </div>
        )}

        {!checkpoint ? (
          <p className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-400">
            Pick a checkpoint to start marking.
          </p>
        ) : team ? (
          <Card className="border-slate-800 bg-slate-900">
            <CardContent className="space-y-4 p-4">
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-mono text-lg font-bold text-cyan-400">{team.team_code}</p>
                  <p className="font-mono text-sm text-slate-400">
                    {present.length}<span className="text-slate-600">/{team.roster_size}</span>
                  </p>
                </div>
                <p className="text-sm text-slate-400">{team.team_name}</p>

                {!team.entitled && (
                  <p className="mt-2 rounded bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-400">
                    {team.entitlement_message ?? 'This team cannot be marked present.'} Saving will be
                    refused.
                  </p>
                )}
                {!team.is_payment_verified && (
                  <p className="mt-2 rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-400">
                    Payment not verified — check with the desk before marking.
                  </p>
                )}
                {/* The roster and the declared size disagree for a couple of
                    teams. Say so rather than quietly picking one. */}
                {team.size_mismatch && (
                  <p className="mt-2 rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-400">
                    Roster has {team.roster_size} member{team.roster_size === 1 ? '' : 's'} but the team
                    registered {team.team_size}. Going by the roster.
                  </p>
                )}
                {team.existing && (
                  <p className="mt-2 rounded bg-cyan-500/10 px-2 py-1 text-xs text-cyan-300">
                    Already marked here at {time(team.existing.marked_at)} (
                    {team.existing.members_present}/{team.roster_size}
                    {team.existing.method === 'manual' ? ', typed' : ''}). Saving updates it.
                  </p>
                )}
                {/* Seen at other desks — a team arriving at the second desk
                    having skipped the first is worth a question. */}
                {team.history.filter((h) => h.checkpoint_id !== Number(checkpoint)).length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Also marked:{' '}
                    {team.history
                      .filter((h) => h.checkpoint_id !== Number(checkpoint))
                      .map((h) => `${h.label} (${h.members_present})`)
                      .join(', ')}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Who is present?</p>
                {team.members.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden"
                  >
                    <label className="flex cursor-pointer items-center gap-3 p-3 active:bg-slate-800">
                      <input
                        type="checkbox"
                        checked={present.includes(member.id)}
                        onChange={() => toggleMember(member.id)}
                        className="h-5 w-5 shrink-0 accent-cyan-500"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm">{member.name}</span>
                          {member.is_team_lead && (
                            <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                              LEAD
                            </span>
                          )}
                        </span>
                        {/* The number the volunteer is checking against an ID
                            card. It was never rendered — only the input for
                            members who had none, which is backwards. */}
                        {member.registration_no && (
                          <span className="mt-0.5 flex items-center gap-2 font-mono text-xs text-slate-500">
                            <span className="truncate">{member.registration_no}</span>
                            {yearOf(member.registration_no) && (
                              <span className="shrink-0 text-slate-600">{yearOf(member.registration_no)}</span>
                            )}
                          </span>
                        )}
                      </span>
                    </label>

                    {needsRegNo(member) && (
                      <div className="border-t border-slate-800 bg-amber-500/5 px-3 pb-3 pt-2">
                        <p className="mb-1.5 text-xs text-amber-400">Registration number needed</p>
                        <div className="flex gap-2">
                          {/*
                            Native select, not the shadcn one: a volunteer on a
                            phone gets the OS picker, which is faster than a
                            popover and works with one thumb.
                          */}
                          <select
                            value={splitRegistrationNo(regNos[member.id] ?? '').prefix}
                            onChange={(e) =>
                              setRegNos((prev) => ({
                                ...prev,
                                [member.id]: joinRegistrationNo(
                                  e.target.value,
                                  splitRegistrationNo(prev[member.id] ?? '').suffix,
                                ),
                              }))
                            }
                            aria-label={`Year of study for ${member.name}`}
                            className="h-11 shrink-0 rounded-md border border-slate-700 bg-slate-900 px-2 text-base text-white"
                          >
                            <option value="">Year</option>
                            {YEARS.map((y) => (
                              <option key={y.prefix} value={y.prefix}>{y.prefix}</option>
                            ))}
                          </select>
                          <Input
                            value={splitRegistrationNo(regNos[member.id] ?? '').suffix}
                            onChange={(e) =>
                              setRegNos((prev) => ({
                                ...prev,
                                [member.id]: joinRegistrationNo(
                                  splitRegistrationNo(prev[member.id] ?? '').prefix,
                                  e.target.value,
                                ),
                              }))
                            }
                            placeholder="11003011234"
                            maxLength={REG_NO_SUFFIX_LENGTH}
                            inputMode="numeric"
                            autoComplete="off"
                            aria-label={`Registration number digits for ${member.name}`}
                            className="h-11 flex-1 border-slate-700 bg-slate-900 font-mono text-base text-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>
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
                {/* Disabled rather than hidden: the volunteer needs to see that
                    marking is the thing being refused, not that they mis-scanned. */}
                <Button
                  className="h-12 flex-1 bg-cyan-600 font-bold text-white hover:bg-cyan-500"
                  onClick={mark}
                  disabled={busy || !team.entitled}
                >
                  Mark {present.length}/{team.roster_size}
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
