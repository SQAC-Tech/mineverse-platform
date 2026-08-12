'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Search, ChevronDown, UserPlus, Trash2, AlertTriangle } from 'lucide-react';
import { Panel, Btn, Pill, statusTone, Table, Empty, Loading, PageTitle, apiCall, Grid, StatTile, Field } from '@/components/admin/nether-ui';

/** Mirrors `teams_team_size_check` in the database. */
const MAX_TEAM_SIZE = 3;

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

const EMPTY_MEMBER = { name: '', email: '', college_email: '', phone: '', department: '', section: '' };

/**
 * Desk override for adding someone the registration form missed. State is kept
 * per-team inside this component so opening a second team does not inherit
 * half-typed details from the first.
 */
function AddMemberForm({ teamId, onAdded }: { teamId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_MEMBER);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof EMPTY_MEMBER) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    const res = await apiCall('/api/admin/teams/members', {
      method: 'POST',
      body: JSON.stringify({ team_id: teamId, ...form }),
    });
    setBusy(false);

    if (!res.ok) return toast.error(res.message);

    toast.success(`${form.name.trim()} added to the team`);
    setForm(EMPTY_MEMBER);
    setOpen(false);
    onAdded();
  };

  if (!open) {
    return (
      <Btn small onClick={() => setOpen(true)} style={{ marginTop: 10 }}>
        <UserPlus size={13} /> Add member
      </Btn>
    );
  }

  return (
    <div
      style={{
        marginTop: 10,
        padding: 12,
        border: '1px solid rgb(from var(--accent-muted) r g b / 40%)',
        background: 'var(--bg-panel)',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
        <Field label="Full name">
          <input className="n-input" value={form.name} onChange={set('name')} placeholder="Name" />
        </Field>
        <Field label="Personal email">
          <input className="n-input" type="email" value={form.email} onChange={set('email')} placeholder="name@gmail.com" />
        </Field>
        <Field label="College email">
          <input className="n-input" type="email" value={form.college_email} onChange={set('college_email')} placeholder="name@college.edu.in" />
        </Field>
        <Field label="Phone">
          <input className="n-input" inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="10-digit number" />
        </Field>
        <Field label="Department">
          <input className="n-input" value={form.department} onChange={set('department')} placeholder="e.g. CSE" />
        </Field>
        <Field label="Section (optional)">
          <input className="n-input" value={form.section} onChange={set('section')} placeholder="e.g. B" />
        </Field>
      </div>

      <div className="n-panel-sub" style={{ marginTop: 10 }}>
        No OTP is sent and the fee is not recalculated — collect any difference at the desk.
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <Btn small variant="primary" disabled={busy} onClick={submit}>
          {busy ? 'Adding…' : 'Add to team'}
        </Btn>
        <Btn small variant="ghost" disabled={busy} onClick={() => { setForm(EMPTY_MEMBER); setOpen(false); }}>
          Cancel
        </Btn>
      </div>
    </div>
  );
}

/**
 * Deleting a team takes its members, payment and scores with it and cannot be
 * undone, so it sits behind the row expander rather than in the row itself, and
 * asks for the team code to be typed out — the same friction GitHub puts on
 * deleting a repo, for the same reason.
 */
function DeleteTeam({ team, onDeleted }: { team: TeamRow; onDeleted: () => void }) {
  const [arming, setArming] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  const matches = typed.trim().toUpperCase() === team.team_code;

  const remove = async () => {
    setBusy(true);
    const res = await apiCall(
      `/api/admin/teams?id=${team.id}&confirm=${encodeURIComponent(typed.trim().toUpperCase())}`,
      { method: 'DELETE' },
    );
    setBusy(false);

    if (!res.ok) return toast.error(res.message);

    toast.success(`${team.team_code} deleted`);
    onDeleted();
  };

  if (!arming) {
    return (
      <Btn small variant="danger" onClick={() => setArming(true)} style={{ marginTop: 10 }}>
        <Trash2 size={13} /> Delete team
      </Btn>
    );
  }

  return (
    <div
      style={{
        marginTop: 10,
        padding: 12,
        border: '1px solid var(--accent-danger)',
        background: 'rgb(from var(--accent-danger) r g b / 12%)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <AlertTriangle size={16} style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 2 }} />
        <div className="n-panel-sub" style={{ color: 'var(--text-onDark)' }}>
          This removes <strong>{team.team_name}</strong>, its {team.members?.length ?? 0} member
          {(team.members?.length ?? 0) === 1 ? '' : 's'}, the payment record, attendance and all
          scores. It cannot be undone.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <input
          className="n-input"
          style={{ flex: '1 1 180px' }}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={`Type ${team.team_code} to confirm`}
          aria-label={`Type ${team.team_code} to confirm deletion`}
          onKeyDown={(e) => { if (e.key === 'Enter' && matches) void remove(); }}
        />
        <Btn small variant="danger" disabled={!matches || busy} onClick={remove}>
          {busy ? 'Deleting…' : 'Delete permanently'}
        </Btn>
        <Btn small variant="ghost" disabled={busy} onClick={() => { setTyped(''); setArming(false); }}>
          Cancel
        </Btn>
      </div>
    </div>
  );
}

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
                                style={{ padding: '8px 10px', border: '1px solid rgb(from var(--accent-muted) r g b / 22%)', background: 'var(--bg-panel)' }}
                              >
                                <div style={{ fontSize: 12.5 }}>{m.name}</div>
                                <div className="n-panel-sub n-mono" style={{ marginTop: 3 }}>{m.email}</div>
                                {m.phone && <div className="n-panel-sub n-mono">{m.phone}</div>}
                              </div>
                            ))}
                          </div>
                        )}

                        {(team.members?.length ?? 0) < MAX_TEAM_SIZE ? (
                          <AddMemberForm teamId={team.id} onAdded={load} />
                        ) : (
                          <div className="n-panel-sub" style={{ marginTop: 10 }}>
                            Team is full — {MAX_TEAM_SIZE} of {MAX_TEAM_SIZE} slots used.
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

                        <DeleteTeam
                          team={team}
                          onDeleted={() => { setExpanded(null); void load(); }}
                        />
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
