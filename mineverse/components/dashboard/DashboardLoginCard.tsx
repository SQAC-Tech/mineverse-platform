'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, LogIn } from 'lucide-react';

/**
 * The card above the login form.
 *
 * It replaced the screening card, which offered a choice of destination —
 * screening or dashboard — because the qualifier is over and there is only one
 * destination left. Keeping a two-way chooser with one live option is how a
 * team ends up clicking a dead round on event morning.
 *
 * When a session already exists this is a button that goes straight in. The
 * session cookie is httpOnly, so whether one exists has to be asked of the
 * server; until that answer arrives the card renders its signed-out face rather
 * than flashing a button that may not apply.
 */
export function DashboardLoginCard({ mc }: { mc: React.CSSProperties }) {
  const router = useRouter();
  const [teamCode, setTeamCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json?.data?.signed_in) setTeamCode(json.data.team_code);
      })
      // A failed check is not an error worth showing: the login form below
      // still works, and that is the fallback either way.
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const signedIn = Boolean(teamCode);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
      <div style={{ ...mc, color: '#fca311', fontSize: '0.62rem', textShadow: '1px 1px 0 #000' }}>
        &gt; WHERE TO?
      </div>

      <button
        type="button"
        onClick={() => router.push('/dashboard')}
        disabled={!signedIn}
        style={{
          ...mc,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          textAlign: 'left',
          padding: '12px 14px',
          background: signedIn ? '#1f4a15' : '#1a110a',
          borderTop: `3px solid ${signedIn ? '#5aba3c' : '#332316'}`,
          borderLeft: `3px solid ${signedIn ? '#5aba3c' : '#332316'}`,
          borderBottom: `3px solid ${signedIn ? '#12300d' : '#0f0a06'}`,
          borderRight: `3px solid ${signedIn ? '#12300d' : '#0f0a06'}`,
          cursor: signedIn ? 'pointer' : 'not-allowed',
          opacity: signedIn ? 1 : 0.75,
        }}
        className={signedIn ? 'hover:brightness-125 transition-all' : ''}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fde047', fontSize: '0.72rem', textShadow: '1px 1px 0 #000' }}>
            ENTER DASHBOARD
          </div>
          <div style={{ color: '#9a9a9a', fontSize: '0.6rem', marginTop: 4, lineHeight: 1.5 }}>
            {signedIn
              ? `Signed in as ${teamCode} • Your rounds, resources and team QR`
              : 'Log in below to reach your rounds, resources and team QR'}
          </div>
        </div>
        <span
          style={{
            ...mc,
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: '0.55rem', whiteSpace: 'nowrap', padding: '4px 7px',
            color: signedIn ? '#5aba3c' : '#888',
            border: `2px solid ${signedIn ? '#5aba3c' : '#888'}`,
          }}
        >
          {signedIn
            ? <><LayoutDashboard size={11} aria-hidden="true" /> GO</>
            : <><LogIn size={11} aria-hidden="true" /> SIGN IN</>}
        </span>
      </button>
    </div>
  );
}
