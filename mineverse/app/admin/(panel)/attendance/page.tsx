'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Download, Search } from 'lucide-react';
import { Panel, Btn, Pill, Table, Empty, Loading, PageTitle, Grid, StatTile, apiCall } from '@/components/admin/nether-ui';

/**
 * Team attendance, per checkpoint.
 *
 * The round gates read exactly this table: `attendanceGate` refuses a round to
 * any team with no record at the checkpoint covering it. So the useful view is
 * not the list of arrivals but the list of absentees — those are the teams that
 * will be standing at the desk unable to start, and they are invisible on a
 * screen that only shows who was marked.
 *
 * Absent is therefore the default filter.
 */

interface Checkpoint {
  id: number;
  code: string;
  label: string;
  day: number;
  sequence: number;
  covers_rounds: number[] | null;
}

interface TeamRow {
  team_id: string;
  team_code: string;
  team_name: string;
  team_size: number;
  present: boolean;
  members_present: number;
  member_names: string[];
  method: string | null;
  notes: string | null;
  marked_at: string | null;
}

interface Summary {
  total_teams: number;
  present: number;
  absent: number;
  heads_present: number;
  heads_expected: number;
  partial: number;
}

interface Payload {
  checkpoints: Checkpoint[];
  checkpoint?: Checkpoint;
  teams: TeamRow[];
  summary: Summary | null;
}

type Filter = 'all' | 'present' | 'absent' | 'partial';

function markedAt(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toDateString() === new Date().toDateString()
    ? time
    : `${date.toLocaleDateString([], { day: '2-digit', month: 'short' })}, ${time}`;
}

function csvOf(rows: TeamRow[], checkpoint: Checkpoint | undefined) {
  const head = ['team_code', 'team_name', 'team_size', 'present', 'members_present', 'members', 'marked_at', 'method'];
  const body = rows.map((row) => [
    row.team_code,
    // Team names are free text and several contain commas.
    `"${(row.team_name ?? '').replace(/"/g, '""')}"`,
    row.team_size,
    row.present ? 'yes' : 'no',
    row.members_present,
    `"${row.member_names.join('; ').replace(/"/g, '""')}"`,
    row.marked_at ?? '',
    row.method ?? '',
  ].join(','));
  return `# ${checkpoint?.label ?? 'attendance'}\n${head.join(',')}\n${body.join('\n')}`;
}

export default function AdminAttendancePage() {
  const [data, setData] = useState<Payload | null>(null);
  const [checkpointId, setCheckpointId] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>('absent');
  const [query, setQuery] = useState('');
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const suffix = checkpointId === null ? '' : `?checkpoint_id=${checkpointId}`;
      const res = await apiCall<Payload>(`/api/admin/attendance${suffix}`);
      if (cancelled) return;
      if (res.ok) setData(res.data ?? null);
      else toast.error(res.message);
    })();
    return () => { cancelled = true; };
  }, [checkpointId, reloads]);

  const visible = useMemo(() => {
    const rows = data?.teams ?? [];
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === 'present' && !row.present) return false;
      if (filter === 'absent' && row.present) return false;
      if (filter === 'partial' && !(row.present && row.members_present > 0 && row.members_present < row.team_size)) return false;
      if (!term) return true;
      return row.team_code.toLowerCase().includes(term) || (row.team_name ?? '').toLowerCase().includes(term);
    });
  }, [data, filter, query]);

  const download = () => {
    const blob = new Blob([csvOf(visible, data?.checkpoint)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-${data?.checkpoint?.code ?? 'checkpoint'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!data) {
    return (<><PageTitle title="Team attendance" /><Panel><Loading label="Loading attendance" /></Panel></>);
  }

  const active = data.checkpoint;
  const summary = data.summary;

  return (
    <>
      <PageTitle
        title="Team attendance"
        subtitle="A team with no record at the checkpoint covering a round cannot start that round"
        actions={
          <>
            <Btn onClick={download}><Download size={12} /> CSV</Btn>
            <Btn onClick={() => setReloads((n) => n + 1)}><RefreshCw size={12} /> Refresh</Btn>
          </>
        }
      />

      {data.checkpoints.length === 0 ? (
        <Panel><Empty>No attendance checkpoints are configured.</Empty></Panel>
      ) : (
        <>
          <Panel title="Checkpoint">
            {[1, 2].map((day) => {
              const forDay = data.checkpoints.filter((point) => point.day === day);
              if (forDay.length === 0) return null;
              return (
                <div key={day} style={{ marginBottom: 10 }}>
                  <div className="n-label">Day {day}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {forDay.map((point) => (
                      <Btn
                        key={point.id}
                        small
                        variant={active?.id === point.id ? 'primary' : 'ghost'}
                        onClick={() => setCheckpointId(point.id)}
                      >
                        {point.label}
                      </Btn>
                    ))}
                  </div>
                </div>
              );
            })}
          </Panel>

          {summary && (
            <div style={{ marginTop: 12 }}>
              <Grid min={150}>
                <StatTile label="Teams present" value={`${summary.present}/${summary.total_teams}`} />
                <StatTile label="Still absent" value={summary.absent} />
                <StatTile label="Heads in the room" value={`${summary.heads_present}/${summary.heads_expected}`} />
                <StatTile label="Short-handed teams" value={summary.partial} />
              </Grid>
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <Panel
              title={active?.label ?? 'Teams'}
              subtitle={
                active?.covers_rounds?.length
                  ? `Unlocks round ${active.covers_rounds.join(' and ')} for the teams marked here`
                  : undefined
              }
            >
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
                {(['absent', 'present', 'partial', 'all'] as Filter[]).map((value) => (
                  <Btn key={value} small variant={filter === value ? 'primary' : 'ghost'} onClick={() => setFilter(value)}>
                    {value === 'partial' ? 'short-handed' : value}
                  </Btn>
                ))}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                  <Search size={13} aria-hidden="true" />
                  <input
                    className="n-input"
                    placeholder="Team code or name"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    style={{ minWidth: 180 }}
                  />
                </label>
              </div>

              <Table head={['Team', 'Size', 'Present', 'Who was marked', 'Marked at', 'Method']}>
                {visible.length === 0 ? (
                  <Empty colSpan={6}>
                    {filter === 'absent' && (data.teams ?? []).length > 0
                      ? 'Every team has been marked present at this checkpoint.'
                      : 'No teams match this filter.'}
                  </Empty>
                ) : visible.map((row) => (
                  <tr key={row.team_id}>
                    <td>
                      <div className="n-mono">{row.team_code}</div>
                      <div className="n-panel-sub">{row.team_name}</div>
                    </td>
                    <td className="n-mono">{row.team_size}</td>
                    <td>
                      {row.present ? (
                        <Pill tone={row.members_present < row.team_size ? 'warn' : 'ok'}>
                          {row.members_present}/{row.team_size}
                        </Pill>
                      ) : (
                        <Pill tone="danger">absent</Pill>
                      )}
                    </td>
                    <td className="n-panel-sub">
                      {row.member_names.length > 0 ? row.member_names.join(', ') : row.present ? 'headcount only' : '—'}
                    </td>
                    <td className="n-panel-sub">{markedAt(row.marked_at)}</td>
                    <td className="n-panel-sub">{row.method ?? '—'}</td>
                  </tr>
                ))}
              </Table>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
