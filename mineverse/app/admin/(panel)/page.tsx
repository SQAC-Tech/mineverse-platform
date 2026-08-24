'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Users, CheckCircle2, Clock, Coins, Zap, Swords, AlertTriangle, DoorOpen, DoorClosed, KeyRound, Lock } from 'lucide-react';
import { Panel, StatTile, Pill, statusTone, Grid, Loading, PageTitle, apiCall, Empty, Btn } from '@/components/admin/nether-ui';
import { startPoll } from '@/lib/client/poll';

type TeamRow = { id: string; team_size: number; is_payment_verified: boolean; status: string };
type RoundRow = { id: number; name: string; day: number; sequence: number; status: string; ends_at: string | null };
type EventRow = { id: string; event_key: string; label: string; status: string; is_expired: boolean; round_id: number };
type MatchRow = { id: string; status: string; winner_team_id: string | null };
type RegistrationState = { open: boolean; source: 'database' | 'environment'; env_default: boolean };
type LoginState = {
  open: boolean;
  source: 'database' | 'schedule';
  scheduled: boolean;
  event_date: string | null;
  screening_date: string | null;
};

export default function AdminOverviewPage() {
  const [teams, setTeams] = useState<TeamRow[] | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [registration, setRegistration] = useState<RegistrationState | null>(null);
  const [login, setLogin] = useState<LoginState | null>(null);
  const [confirmReg, setConfirmReg] = useState(false);
  const [confirmLogin, setConfirmLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [t, r, e, m, s] = await Promise.all([
      // Summary: this page renders a count, a verified count and a participant
      // total. It has no use for the members or attendance rows the full shape
      // embeds, and polls every thirty seconds.
      apiCall<TeamRow[]>('/api/admin/teams?view=summary'),
      apiCall<RoundRow[]>('/api/admin/rounds'),
      apiCall<{ events: EventRow[] }>('/api/admin/events'),
      apiCall<{ matches: MatchRow[] }>('/api/admin/pvp/matches'),
      apiCall<{ registration: RegistrationState; login: LoginState }>('/api/admin/settings'),
    ]);

    if (t.ok) setTeams(t.data); else setError(t.message);
    if (r.ok) setRounds(r.data ?? []);
    if (e.ok) setEvents(e.data.events ?? []);
    if (m.ok) setMatches(m.data.matches ?? []);
    if (s.ok) {
      setRegistration(s.data.registration);
      setLogin(s.data.login);
    }
  }, []);

  useEffect(() => {
    void load();
    // Event day moves fast; keep the console close to live without hammering.
    return startPoll(() => void load(), 30_000);
  }, [load]);

  const setRegistrationOpen = async (open: boolean) => {
    setBusy(true);
    const res = await apiCall<RegistrationState>('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify({ action: 'set_registration_open', open }),
    });
    setBusy(false);
    setConfirmReg(false);
    if (!res.ok) return toast.error(res.message);
    setRegistration((current) => (current ? { ...current, ...res.data } : current));
    toast.success(open ? 'Registration is open.' : 'Registration is closed.');
  };

  const revertToEnvDefault = async () => {
    setBusy(true);
    const res = await apiCall<RegistrationState>('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify({ action: 'clear_registration_override' }),
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.message);
    setRegistration((current) => (current ? { ...current, ...res.data } : current));
    toast.success('Back to the deployment default.');
  };

  const setLoginOpen = async (open: boolean) => {
    setBusy(true);
    const res = await apiCall<{ login: LoginState }>('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify({ action: 'set_login_open', open }),
    });
    setBusy(false);
    setConfirmLogin(false);
    if (!res.ok) return toast.error(res.message);
    setLogin(res.data.login);
    toast.success(open ? 'Teams can log in.' : 'Team login is closed.');
  };

  const revertToSchedule = async () => {
    setBusy(true);
    const res = await apiCall<{ login: LoginState }>('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify({ action: 'clear_login_override' }),
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.message);
    setLogin(res.data.login);
    toast.success('Back to the scheduled dates.');
  };

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

      {registration && (
        <Panel
          title="Registration"
          subtitle={
            registration.source === 'database'
              ? 'Set from this panel. Takes effect within about five seconds — no redeploy.'
              : `Following the deployment default (NEXT_PUBLIC_REGISTRATION_OPEN=${registration.env_default}).`
          }
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Pill tone={registration.open ? 'live' : 'idle'}>
              {registration.open ? <DoorOpen size={11} /> : <DoorClosed size={11} />}{' '}
              {registration.open ? 'open' : 'closed'}
            </Pill>

            {registration.open ? (
              <Btn variant="danger" small disabled={busy} onClick={() => setConfirmReg(true)}>
                <DoorClosed size={11} /> Close registration
              </Btn>
            ) : (
              <Btn variant="primary" small disabled={busy} onClick={() => void setRegistrationOpen(true)}>
                <DoorOpen size={11} /> Open registration
              </Btn>
            )}

            {registration.source === 'database' && (
              <Btn small disabled={busy} onClick={() => void revertToEnvDefault()}>
                Use deployment default
              </Btn>
            )}
          </div>

          <p className="n-panel-sub" style={{ marginTop: 10, lineHeight: 1.6 }}>
            Closing hides the sign-up call to action and refuses{' '}
            <code>POST /api/register</code>, so a saved link to the form no longer works either.
            Teams already registered are unaffected — this only stops new ones.
          </p>
        </Panel>
      )}

      {login && (
        <Panel
          title="Team login"
          subtitle={
            login.source === 'database'
              ? 'Overridden from this panel. The scheduled dates are ignored until you hand it back.'
              : `Open on the scheduled days only: ${[login.screening_date, login.event_date].filter(Boolean).join(' and ') || 'none set'}.`
          }
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Pill tone={login.open ? 'live' : 'idle'}>
              {login.open ? <KeyRound size={11} /> : <Lock size={11} />}{' '}
              {login.open ? 'teams can log in' : 'login closed'}
            </Pill>

            {login.open ? (
              <Btn variant="danger" small disabled={busy} onClick={() => setConfirmLogin(true)}>
                <Lock size={11} /> Close login
              </Btn>
            ) : (
              <Btn variant="primary" small disabled={busy} onClick={() => void setLoginOpen(true)}>
                <KeyRound size={11} /> Open login now
              </Btn>
            )}

            {login.source === 'database' && (
              <Btn small disabled={busy} onClick={() => void revertToSchedule()}>
                Back to the schedule
              </Btn>
            )}
          </div>

          <p className="n-panel-sub" style={{ marginTop: 10, lineHeight: 1.6 }}>
            Teams can only request an OTP while this is open, and the screening evening is not
            event day — if the dates in the deployment are wrong, open it here rather than waiting
            on a redeploy. Demo teams are never gated.
            {login.source === 'database' && login.open !== login.scheduled && (
              <> The schedule alone would say <strong>{login.scheduled ? 'open' : 'closed'}</strong> right now.</>
            )}
          </p>
        </Panel>
      )}

      {confirmLogin && (
        <div
          role="alertdialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center',
            padding: 20, background: 'rgba(0,0,0,0.72)',
          }}
        >
          <div className="n-panel" style={{ maxWidth: 440, width: '100%', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="n-panel-title">Close team login?</div>
            <p style={{ fontSize: 12, lineHeight: 1.6 }}>
              No team will be able to request an OTP, including teams part-way through a round —
              anyone already logged in keeps their session, but a dropped connection becomes a
              locked-out team. Only do this between rounds.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={() => setConfirmLogin(false)} disabled={busy}>Cancel</Btn>
              <Btn variant="danger" disabled={busy} onClick={() => void setLoginOpen(false)}>
                {busy ? 'Closing…' : 'Yes, close it'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {confirmReg && (
        <div
          role="alertdialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center',
            padding: 20, background: 'rgba(0,0,0,0.72)',
          }}
        >
          <div className="n-panel" style={{ maxWidth: 440, width: '100%', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="n-panel-title">Close registration?</div>
            <p style={{ fontSize: 12, lineHeight: 1.6 }}>
              New teams will not be able to sign up, by the form or by the link. The{' '}
              {teams.length} team{teams.length === 1 ? '' : 's'} already registered keep everything.
              You can reopen it from this screen at any time.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={() => setConfirmReg(false)} disabled={busy}>Cancel</Btn>
              <Btn variant="danger" disabled={busy} onClick={() => void setRegistrationOpen(false)}>
                {busy ? 'Closing…' : 'Yes, close it'}
              </Btn>
            </div>
          </div>
        </div>
      )}

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
                  border: '1px solid rgb(from var(--accent-muted) r g b / 22%)',
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5 }}>{round.name}</div>
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
            <QuickLink href="/admin/resources" icon={<Coins size={13} />} label="Grant resources" />
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
        background: 'rgb(from var(--accent-primary) r g b / 10%)',
        border: '1px solid rgb(from var(--accent-primary) r g b / 45%)',
        fontSize: 12.5,
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
