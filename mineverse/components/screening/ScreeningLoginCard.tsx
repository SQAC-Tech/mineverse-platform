'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Lock, Moon } from 'lucide-react';

interface Status {
  state: 'before' | 'open' | 'closed' | 'unset';
  starts_at: string | null;
  ends_at: string | null;
  duration_minutes: number;
  question_count: number;
  team?: { attempt_status: string | null };
}

/**
 * The screening card on the login screen.
 *
 * Renders logged out, which is the whole point — a team arriving on the 22nd
 * should see the round is live before they have typed a team code, not after.
 * The login form below is unchanged; picking a card only chooses where the
 * session lands afterwards.
 */
export function ScreeningLoginCard({
  destination,
  onChoose,
  mc,
}: {
  destination: 'screening' | 'dashboard';
  onChoose: (destination: 'screening' | 'dashboard') => void;
  mc: React.CSSProperties;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    fetch('/api/screening/status', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => { if (json.success) setStatus(json.data); })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, []);

  if (!status || status.state === 'unset') return null;

  const opensIn = status.starts_at ? new Date(status.starts_at).getTime() - now : 0;
  const played = Boolean(status.team?.attempt_status);

  const live = status.state === 'open' && !played;

  const badge = played
    ? { text: 'SUBMITTED', color: '#5aba3c', Icon: CheckCircle2 }
    : status.state === 'open'
      ? { text: 'LIVE NOW', color: '#5aba3c', Icon: Moon }
      : status.state === 'before'
        ? { text: countdown(opensIn), color: '#fca311', Icon: Clock }
        : { text: 'CLOSED', color: '#888', Icon: Lock };

  const card = (
    key: 'screening' | 'dashboard',
    title: string,
    sub: string,
    right: React.ReactNode,
    enabled: boolean,
  ) => (
    <button
      type="button"
      onClick={() => enabled && onChoose(key)}
      disabled={!enabled}
      style={{
        ...mc,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        textAlign: 'left',
        padding: '12px 14px',
        background: destination === key ? '#1f4a15' : '#1a110a',
        borderTop: `3px solid ${destination === key ? '#5aba3c' : '#332316'}`,
        borderLeft: `3px solid ${destination === key ? '#5aba3c' : '#332316'}`,
        borderBottom: `3px solid ${destination === key ? '#12300d' : '#0f0a06'}`,
        borderRight: `3px solid ${destination === key ? '#12300d' : '#0f0a06'}`,
        cursor: enabled ? 'var(--mv-cursor-pickaxe)' : 'var(--mv-cursor-barrier)',
        opacity: enabled ? 1 : 0.55,
      }}
      className={enabled ? 'hover:brightness-125 transition-all' : ''}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fde047', fontSize: '0.72rem', textShadow: '1px 1px 0 #000' }}>{title}</div>
        <div style={{ color: '#9a9a9a', fontSize: '0.6rem', marginTop: 4, lineHeight: 1.5 }}>{sub}</div>
      </div>
      {right}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
      <div style={{ ...mc, color: '#fca311', fontSize: '0.62rem', textShadow: '1px 1px 0 #000' }}>
        &gt; WHERE TO?
      </div>

      {card(
        'screening',
        'SCREENING ROUND',
        played
          ? 'Your team has already sat it'
          : status.state === 'open'
            ? `${status.question_count} questions · ${status.duration_minutes} min · one attempt`
            : status.state === 'before'
              ? `Opens ${istDate(status.starts_at)} IST`
              : 'The window has closed',
        <span
          style={{
            ...mc,
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: '0.55rem', color: badge.color, whiteSpace: 'nowrap',
            border: `2px solid ${badge.color}`, padding: '4px 7px',
          }}
        >
          <badge.Icon size={11} aria-hidden="true" />
          {badge.text}
        </span>,
        live,
      )}

      {card('dashboard', 'TEAM DASHBOARD', 'Your team, payment and event details', null, true)}
    </div>
  );
}

function istDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

/** "OPENS IN 2D 4H" reads better than a timestamp when the date is still away. */
function countdown(ms: number) {
  if (ms <= 0) return 'OPENING';
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `IN ${days}D ${hours}H`;
  if (hours > 0) return `IN ${hours}H ${minutes % 60}M`;
  return `IN ${minutes}M`;
}
