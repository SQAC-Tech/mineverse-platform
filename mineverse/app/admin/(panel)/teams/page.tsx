'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Search, ChevronDown } from 'lucide-react';
import { Panel, Btn, Pill, statusTone, Table, Empty, Loading, PageTitle, apiCall, Grid, StatTile } from '@/components/admin/nether-ui';

type Member = { id: string; name: string; email: string; phone?: string };
type TeamRow = {
  id: string;
  team_code: string;
  team_name: string;
  team_size: number;
  status: string;
  is_payment_verified: boolean;
  total_score: number;
  created_at: string;
  members?: Member[];
  attendance_records?: { checkpoint_id: number; members_present: number }[];
};

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<TeamRow[] | null>(null);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiCall<TeamRow[]>('/api/admin/teams');
    if (res.ok) setTeams(res.data ?? []);
    else toast.error(res.message);
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (!teams) {
    return (<><PageTitle title="Teams" /><Panel><Loading label="Loading roster" /></Panel></>);
  }

  const needle = query.trim().toLowerCase();
  const visible = teams.filter((t) =>
    !needle ||
    t.team_code?.toLowerCase().includes(needle) ||
    t.team_name?.toLowerCase().includes(needle) ||
    t.members?.some((m) => m.name?.toLowerCase().includes(needle) || m.email?.toLowerCase().includes(needle)),
  );

  const verified = teams.filter((t) => t.is_payment_verified).length;
  const participants = teams.reduce((sum, t) => sum + (t.team_size ?? 0), 0);
  const checkedIn = teams.filter((t) => (t.attendance_records?.length ?? 0) > 0).length;

  return (
    <>
      <PageTitle
        title="Teams"
        subtitle="Full roster with members and attendance"
        actions={<Btn onClick={load}><RefreshCw size={12} /> Refresh</Btn>}
      />

      <Grid min={190}>
        <StatTile label="Teams" value={teams.length} />
        <StatTile label="Participants" value={participants} />
        <StatTile label="Payment verified" value={verified} />
        <StatTile label="Checked in" value={checkedIn} hint="Has at least one attendance record" />
      </Grid>

      <div style={{ marginTop: 12 }}>
        <Panel
          title={`Roster (${visible.length})`}
          actions={
            <div style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-portal)' }} />
              <input
                className="n-input"
                style={{ paddingLeft: 24, width: 210 }}
                placeholder="Team, code or member"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          }
        >
          <Table head={['Code', 'Team', 'Size', 'Payment', 'Status', 'Score', '']}>
            {visible.map((team) => (
              <Fragment key={team.id}>
                <tr>
                  <td className="n-mono">{team.team_code}</td>
                  <td>{team.team_name}</td>
                  <td>{team.team_size}</td>
                  <td>
                    <Pill tone={team.is_payment_verified ? 'ok' : 'warn'}>
                      {team.is_payment_verified ? 'verified' : 'pending'}
                    </Pill>
                  </td>
                  <td><Pill tone={statusTone(team.status)}>{team.status}</Pill></td>
                  <td>{team.total_score ?? 0}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Btn
                      variant="ghost"
                      small
                      onClick={() => setExpanded(expanded === team.id ? null : team.id)}
                      aria-expanded={expanded === team.id}
                    >
                      <ChevronDown
                        size={12}
                        style={{
                          transform: expanded === team.id ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.15s ease',
                        }}
                      />
                      {team.members?.length ?? 0} members
                    </Btn>
                  </td>
                </tr>
                {expanded === team.id && (
                  <tr>
                    <td colSpan={7} style={{ background: 'var(--bg-void)', padding: 0 }}>
                      <div style={{ padding: '12px 14px' }}>
                        <div className="n-label" style={{ marginBottom: 8 }}>Members</div>
                        {(team.members ?? []).length === 0 ? (
                          <div className="n-panel-sub">No members recorded</div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 8 }}>
                            {(team.members ?? []).map((m) => (
                              <div
                                key={m.id}
                                style={{ padding: '8px 10px', border: '1px solid rgb(150 35 14 / 22%)', background: 'var(--bg-panel)' }}
                              >
                                <div style={{ fontSize: 10.5 }}>{m.name}</div>
                                <div className="n-panel-sub n-mono" style={{ marginTop: 3 }}>{m.email}</div>
                                {m.phone && <div className="n-panel-sub n-mono">{m.phone}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                        {(team.attendance_records?.length ?? 0) > 0 && (
                          <div style={{ marginTop: 12 }}>
                            <div className="n-label" style={{ marginBottom: 6 }}>Attendance</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {team.attendance_records!.map((a, i) => (
                                <Pill key={i} tone="ok">
                                  Checkpoint {a.checkpoint_id} · {a.members_present} present
                                </Pill>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {visible.length === 0 && <Empty colSpan={7}>No matching teams</Empty>}
          </Table>
        </Panel>
      </div>
    </>
  );
}
