'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Plus, Trash2, ClipboardList, Download } from 'lucide-react';
import {
  Panel, Btn, Table, Empty, Loading, PageTitle, Field, Grid, StatTile, Pill, apiCall,
} from '@/components/admin/nether-ui';

type Desk = 'c2c' | 'helpdesk';

const DESKS: { key: Desk; label: string }[] = [
  { key: 'c2c', label: 'C2C' },
  { key: 'helpdesk', label: 'Helpdesk' },
];

type Entry = {
  id: string;
  desk: Desk;
  person_name: string;
  reported_at: string;
  hours: number;
  notes: string | null;
};

/** `datetime-local` wants local wall-clock time, not the ISO/UTC string. */
function toLocalInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** "Today, 12:05" reads faster than "12-08-2026 12:05" at a busy desk. */
function describeWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid time';

  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (sameDay(date, today)) return `Today, ${time}`;
  if (sameDay(date, yesterday)) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString([], { day: '2-digit', month: 'short' })}, ${time}`;
}

export default function StaffAttendancePage() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [filter, setFilter] = useState<Desk | 'all'>('all');
  const [busy, setBusy] = useState(false);

  const [desk, setDesk] = useState<Desk>('c2c');
  const [name, setName] = useState('');
  const [hours, setHours] = useState('');
  const [when, setWhen] = useState(() => toLocalInput(new Date()));
  const [showPicker, setShowPicker] = useState(false);

  /** Quick backfill: minutes before now. 0 means "right now". */
  const shiftWhen = (minutesAgo: number) =>
    setWhen(toLocalInput(new Date(Date.now() - minutesAgo * 60_000)));

  const load = useCallback(async () => {
    const res = await apiCall<Entry[]>('/api/admin/staff-attendance');
    if (res.ok) setEntries(res.data ?? []);
    else toast.error(res.message);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(
    () => (entries ?? []).filter((e) => filter === 'all' || e.desk === filter),
    [entries, filter],
  );

  const totals = useMemo(() => {
    const sum = (rows: Entry[]) => rows.reduce((acc, r) => acc + Number(r.hours), 0);
    const all = entries ?? [];
    return {
      c2c: sum(all.filter((e) => e.desk === 'c2c')),
      helpdesk: sum(all.filter((e) => e.desk === 'helpdesk')),
      people: new Set(all.map((e) => e.person_name.toLowerCase())).size,
    };
  }, [entries]);

  const submit = async () => {
    const trimmed = name.trim();
    const parsedHours = Number(hours);

    if (!trimmed) return toast.error('Enter who came in');
    if (!Number.isFinite(parsedHours) || parsedHours <= 0 || parsedHours > 24) {
      return toast.error('Hours must be between 0 and 24');
    }

    setBusy(true);
    const res = await apiCall('/api/admin/staff-attendance', {
      method: 'POST',
      body: JSON.stringify({
        desk,
        person_name: trimmed,
        hours: parsedHours,
        reported_at: new Date(when).toISOString(),
      }),
    });
    setBusy(false);

    if (!res.ok) return toast.error(res.message);

    toast.success(`${trimmed} logged — ${parsedHours} h`);
    setName('');
    setHours('');
    setWhen(toLocalInput(new Date()));
    setShowPicker(false);
    void load();
  };

  /**
   * Exports whatever the desk filter is currently showing, so "export the
   * Helpdesk sheet" is one click rather than a spreadsheet edit afterwards.
   */
  const exportCsv = () => {
    const query = filter === 'all' ? '' : `&desk=${filter}`;
    window.location.href = `/api/admin/staff-attendance?format=csv${query}`;
  };

  const remove = async (entry: Entry) => {
    if (!confirm(`Remove ${entry.person_name}'s entry?`)) return;
    const res = await apiCall(`/api/admin/staff-attendance?id=${entry.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Entry removed');
      void load();
    } else {
      toast.error(res.message);
    }
  };

  return (
    <>
      <PageTitle
        title="Desk attendance"
        subtitle="Duty log for the C2C and Helpdesk volunteers — who came in, when, and for how long."
        actions={
          <>
            <Btn onClick={exportCsv} disabled={!entries?.length}>
              <Download size={14} /> Export CSV
            </Btn>
            <Btn onClick={load}><RefreshCw size={14} /> Refresh</Btn>
          </>
        }
      />

      <Grid min={190}>
        <StatTile label="C2C hours" value={totals.c2c.toFixed(1)} />
        <StatTile label="Helpdesk hours" value={totals.helpdesk.toFixed(1)} />
        <StatTile label="People logged" value={totals.people} />
      </Grid>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginTop: 12 }}>
        <Panel title="Log a shift" subtitle="Defaults to right now — change the time to backfill">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Desk">
              <div style={{ display: 'flex', gap: 8 }}>
                {DESKS.map((d) => (
                  <Btn
                    key={d.key}
                    variant={desk === d.key ? 'primary' : 'secondary'}
                    onClick={() => setDesk(d.key)}
                    style={{ flex: 1 }}
                  >
                    {d.label}
                  </Btn>
                ))}
              </div>
            </Field>

            <Field label="Name">
              <input
                className="n-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Who came in"
                onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
              />
            </Field>

            {/*
              The answer is "now" almost every time, so the exact picker stays
              collapsed behind a toggle and the common backfills are one tap.
            */}
            <div>
              <span className="n-label">When</span>
              <div className="n-when">
                <strong className="n-when-value">{describeWhen(when)}</strong>
                <div className="n-when-chips">
                  <Btn small variant="ghost" onClick={() => shiftWhen(0)}>Now</Btn>
                  <Btn small variant="ghost" onClick={() => shiftWhen(60)}>1 h ago</Btn>
                  <Btn small variant="ghost" onClick={() => shiftWhen(120)}>2 h ago</Btn>
                  <Btn
                    small
                    variant="ghost"
                    onClick={() => setShowPicker((v) => !v)}
                    aria-expanded={showPicker}
                  >
                    {showPicker ? 'Hide' : 'Pick'}
                  </Btn>
                </div>
              </div>
              {showPicker && (
                <input
                  className="n-input"
                  style={{ marginTop: 8 }}
                  type="datetime-local"
                  value={when}
                  max={toLocalInput(new Date())}
                  onChange={(e) => setWhen(e.target.value)}
                />
              )}
            </div>

            <Field label="Hours">
              <input
                className="n-input"
                type="number"
                min={0.5}
                max={24}
                step={0.5}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="e.g. 3.5"
                onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
              />
            </Field>

            <Btn variant="primary" disabled={busy} onClick={submit}>
              <Plus size={14} /> {busy ? 'Saving…' : 'Add entry'}
            </Btn>
          </div>
        </Panel>

        <Panel
          title={`Log (${visible.length})`}
          subtitle="Newest first"
          actions={
            <div style={{ display: 'flex', gap: 6 }}>
              <Btn small variant={filter === 'all' ? 'primary' : 'ghost'} onClick={() => setFilter('all')}>All</Btn>
              {DESKS.map((d) => (
                <Btn
                  key={d.key}
                  small
                  variant={filter === d.key ? 'primary' : 'ghost'}
                  onClick={() => setFilter(d.key)}
                >
                  {d.label}
                </Btn>
              ))}
            </div>
          }
        >
          {!entries ? (
            <Loading label="Loading duty log" />
          ) : (
            <Table head={['Name', 'Desk', 'When', 'Hours', '']}>
              {visible.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.person_name}</td>
                  <td>
                    <Pill tone={entry.desk === 'c2c' ? 'live' : 'idle'}>
                      {DESKS.find((d) => d.key === entry.desk)?.label ?? entry.desk}
                    </Pill>
                  </td>
                  <td className="n-panel-sub" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(entry.reported_at).toLocaleString([], {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="n-mono">{Number(entry.hours).toFixed(1)} h</td>
                  <td>
                    <Btn small variant="ghost" onClick={() => remove(entry)} aria-label={`Remove ${entry.person_name}`}>
                      <Trash2 size={13} />
                    </Btn>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <Empty colSpan={5}>
                  <ClipboardList size={20} style={{ opacity: 0.5, marginBottom: 6 }} />
                  <div>No shifts logged yet</div>
                </Empty>
              )}
            </Table>
          )}
        </Panel>
      </div>
    </>
  );
}
