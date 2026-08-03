'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Users, CheckCircle2, Clock, Coins, Zap, Swords, AlertTriangle } from 'lucide-react';
import { Panel, StatTile, Pill, statusTone, Grid, Loading, PageTitle, apiCall, Empty } from '@/components/admin/nether-ui';

type TeamRow = { id: string; team_size: number; is_payment_verified: boolean; status: string };
type RoundRow = { id: number; name: string; day: number; sequence: number; status: string; ends_at: string | null };
type EventRow = { id: string; event_key: string; label: string; status: string; is_expired: boolean; round_id: number };
type MatchRow = { id: string; status: string; winner_team_id: string | null };

export default function AdminOverviewPage() {
  const [teams, setTeams] = useState<TeamRow[] | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [t, r, e, m] = await Promise.all([
      apiCall<TeamRow[]>('/api/admin/teams'),
      apiCall<RoundRow[]>('/api/admin/rounds'),
      apiCall<{ events: EventRow[] }>('/api/admin/events'),
      apiCall<{ matches: MatchRow[] }>('/api/admin/pvp/matches'),
    ]);

    if (t.ok) setTeams(t.data); else setError(t.message);
    if (r.ok) setRounds(r.data ?? []);
    if (e.ok) setEvents(e.data.events ?? []);
    if (m.ok) setMatches(m.data.matches ?? []);
  }, []);

  useEffect(() => {
    void load();
    // Event day moves fast; keep the console close to live without hammering.
    const poll = window.setInterval(load, 15000);
    return () => window.clearInterval(poll);
  }, [load]);

  if (error && !teams) {
    return (
      <>
        <PageTitle title="Overview" />
        <Panel><div className="n-empty">{error}</div></Panel>
      </>
    );
  }
  if (!teams) {
    return (
      <>
        <PageTitle title="Overview" />
        <Panel><Loading label="Reading event state" /></Panel>
      </>
    );
  }

  const verified = teams.filter((t) => t.is_payment_verified).length;
  const pending = teams.length - verified;
  const participants = teams.reduce((sum, t) => sum + (t.team_size ?? 0), 0);
  const activeRound = rounds.find((r) => r.status === 'active') ?? null;
  const activeEvents = events.filter((e) => e.status === 'active' && !e.is_expired);
  const liveMatches = matches.filter((m) => m.status === 'live' || m.status === 'draft');
  const resolvedMatches = matches.filter((m) => m.status === 'resolved');

  return (
    <>
      <PageTitle
        title="Overview"
        subtitle="Live event state · refreshes every 15s"
        actions={
          activeRound ? (
            <Pill tone="live"><Clock size={11} /> {activeRound.name} live</Pill>
          ) : (
            <Pill tone="idle">No round running</Pill>
          )
        }
      />

      <Grid min={190}>
        <StatTile label="Teams" value={teams.length} icon={<Users size={14} style={{ color: 'var(--text-portal)' }} />} hint={`${participants} participants`} />
        <StatTile label="Payments verified" value={verified} icon={<CheckCircle2 size={14} style={{ color: 'var(--ok)' }} />} hint={pending > 0 ? `${pending} pending` : 'All clear'} />
        <StatTile label="Active world events" value={activeEvents.length} icon={<Zap size={14} style={{ color: 'var(--accent-primary)' }} />} hint={activeEvents.map((e) => e.label).join(', ') || 'None running'} />
        <StatTile label="PvP resolved" value={resolvedMatches.length} icon={<Swords size={14} style={{ color: 'var(--text-portal)' }} />} hint={liveMatches.length > 0 ? `${liveMatches.length} in progress` : 'None in progress'} />
      </Grid>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginTop: 12 }}>
        <Panel
          title="Rounds"
          subtitle="Phase 1 round control drives every gameplay lock"
          actions={<Link href="/admin/rounds" className="n-btn n-btn-ghost n-btn-sm">Manage</Link>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rounds.length === 0 && <Empty>No rounds configured</Empty>}
            {rounds.map((round) => (
              <div
                key={round.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 11px',
                  background: 'var(--bg-void)',
                  border: '1px solid rgb(150 35 14 / 22%)',
                }}
              >
                <div>
                  <div style={{ fontSize: 11 }}>{round.name}</div>
                  <div className="n-panel-sub">Day {round.day} · Round {round.sequence}</div>
                </div>
                <Pill tone={statusTone(round.status)}>{round.status}</Pill>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Needs attention" subtitle="Anything blocking the next step">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Attention show={pending > 0} href="/admin/payments" label={`${pending} payment${pending === 1 ? '' : 's'} awaiting verification`} />
            <Attention show={!activeRound} href="/admin/rounds" label="No round is active — teams cannot play" />
            <Attention show={liveMatches.length > 0} href="/admin/pvp" label={`${liveMatches.length} PvP match${liveMatches.length === 1 ? '' : 'es'} open`} />
            <Attention show={activeEvents.length > 0} href="/admin/events" label={`${activeEvents.length} world event${activeEvents.length === 1 ? '' : 's'} still active`} />
            {pending === 0 && activeRound && liveMatches.length === 0 && activeEvents.length === 0 && (
              <Empty>Nothing needs attention</Empty>
            )}
          </div>
        </Panel>
      </div>

      <div style={{ marginTop: 12 }}>
        <Panel title="Quick actions">
          <Grid min={168} gap={8}>
            <QuickLink href="/admin/grading" icon={<CheckCircle2 size={13} />} label="Run grading" />
            <QuickLink href="/admin/events" icon={<Zap size={13} />} label="Trigger event" />
            <QuickLink href="/admin/offline" icon={<Coins size={13} />} label="Offline result" />
            <QuickLink href="/admin/pvp" icon={<Swords size={13} />} label="Start PvP" />
            <QuickLink href="/admin/resources" icon={<Coins size={13} />} label="Adjust resources" />
            <QuickLink href="/admin/qualification" icon={<Users size={13} />} label="Qualification" />
          </Grid>
        </Panel>
      </div>
    </>
  );
}

function Attention({ show, href, label }: { show: boolean; href: string; label: string }) {
  if (!show) return null;
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '9px 11px',
        background: 'rgb(235 71 4 / 10%)',
        border: '1px solid rgb(235 71 4 / 45%)',
        fontSize: 10.5,
        color: 'var(--text-onDark)',
      }}
    >
      <AlertTriangle size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
      {label}
    </Link>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="n-btn n-btn-secondary" style={{ justifyContent: 'flex-start' }}>
      {icon}
      {label}
    </Link>
  );
}
