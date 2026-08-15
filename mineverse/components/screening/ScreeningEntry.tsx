'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, CheckCircle2, ClipboardList, Clock, Loader2, ListChecks, ShieldCheck, Zap,
} from 'lucide-react';
import { ProctorProvider } from '@/components/game/proctor/ProctorProvider';
import { ScreeningPaper } from './ScreeningPaper';
import './screening-ui.css';

interface Status {
  state: 'before' | 'open' | 'closed' | 'unset';
  starts_at: string | null;
  ends_at: string | null;
  duration_minutes: number;
  question_count: number;
  late_start: boolean;
  team?: {
    attempt_status: string | null;
    submitted_at: string | null;
    payment_verified: boolean;
  };
}

interface Attempt {
  attempt_id: string;
  deadline_at: string;
  seconds_remaining: number;
  questions: Array<{ id: string; number: number; prompt: string; options: string[]; selected_slot: number | null }>;
  status: 'in_progress' | 'submitted' | 'expired';
  submitted_at: string | null;
}

const IST = { timeZone: 'Asia/Kolkata' } as const;

function istTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    ...IST, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

/**
 * The screen between logging in and the paper.
 *
 * It states every rule that is enforced and no rule that is not. Deliberately
 * absent: the per-difficulty weights, the first-year bonus and the tiebreak.
 * A team that knows the five hard questions pay double will farm those and skip
 * twenty; a team that hears about the bonus reads it as a quota.
 */
export function ScreeningEntry() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [statusRes, attemptRes] = await Promise.allSettled([
      fetch('/api/screening/status', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/screening/attempt', { cache: 'no-store' }).then((r) => r.json()),
    ]);

    if (statusRes.status === 'fulfilled' && statusRes.value.success) setStatus(statusRes.value.data);
    if (attemptRes.status === 'fulfilled' && attemptRes.value.success) {
      const data = attemptRes.value.data as Attempt;
      // A reload mid-paper drops straight back in, with the server's remaining
      // time rather than a fresh 30 minutes.
      if (data.status === 'in_progress') setAttempt(data);
      else router.replace('/screening/done');
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch('/api/screening/start', { method: 'POST' });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? 'Could not start the round. Tell an organizer.');
        return;
      }
      setAttempt(json.data);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setStarting(false);
    }
  };

  // Live paper: hand off to the proctor and the paper itself.
  if (attempt) {
    return (
      <ProctorProvider roundId={0} themeClass="round-ui--night" roundName="Screening Round" eyebrow="SCREENING">
        <ScreeningPaper initial={attempt} />
      </ProctorProvider>
    );
  }

  if (!status) {
    return (
      <div className="round-ui--night scr scr__done">
        <div className="scr__done-card">
          <Loader2 size={24} className="animate-spin" aria-hidden="true" />
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  const played = Boolean(status.team?.attempt_status);
  const blocked =
    played
      ? 'Your team has already sat the screening round. Results are emailed after the window closes.'
      : status.state === 'before'
        ? `The screening round opens on ${istTime(status.starts_at)} IST.`
        : status.state === 'closed'
          ? 'The screening round has closed.'
          : status.team && !status.team.payment_verified
            ? 'Your registration payment has not been verified yet. Contact an organizer before the window closes.'
            : null;

  return (
    <div className="round-ui--night scr">
      <div className="scr__backdrop" aria-hidden="true" />
      <div className="scr__shade" aria-hidden="true" />

      <div className="scr__inner" style={{ maxWidth: 720, paddingTop: 26 }}>
        <section className="scr__panel">
          <div className="scr__panel-head">Screening Round · Qualifier</div>

          <div className="scr__prompt" style={{ paddingBottom: 4 }}>
            <p style={{ fontSize: 15, lineHeight: 1.6 }}>
              {status.question_count} questions, {status.duration_minutes} minutes, one attempt for your
              team. Read this before you start — the clock begins the moment you do.
            </p>
          </div>

          <div style={{ padding: '0 16px 4px', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { Icon: ListChecks, title: `${status.question_count} multiple-choice questions`, body: 'Four options each, exactly one correct. No code to write.' },
              { Icon: Clock, title: `${status.duration_minutes} minutes, timed by the server`, body: 'Closing the tab does not pause it. When the time is up your paper is handed in as it stands.' },
              { Icon: CheckCircle2, title: 'No negative marking', body: 'A wrong answer costs nothing beyond the time you spent on it. Answer everything you can.' },
              { Icon: Zap, title: 'One attempt per team', body: 'You cannot restart, and only one member should sit it. Answers save as you pick them, so a reload is safe.' },
              { Icon: ShieldCheck, title: 'Proctored', body: 'Fullscreen is required. Tab switches, copy, paste, right-click and developer shortcuts are blocked and recorded.' },
              { Icon: ClipboardList, title: 'How teams are picked', body: 'Answer correctly and submit early. Both matter.' },
            ].map(({ Icon, title, body }) => (
              <div
                key={title}
                style={{
                  display: 'grid', gridTemplateColumns: '22px 1fr', gap: 12, alignItems: 'start',
                  padding: '12px 0', borderBottom: '1px solid var(--rd-edge)',
                }}
              >
                <Icon size={16} style={{ color: 'var(--rd-accent)', marginTop: 2 }} aria-hidden="true" />
                <div>
                  <div style={{ fontWeight: 650, fontSize: 14.5 }}>{title}</div>
                  <div style={{ color: 'var(--rd-ink-dim)', fontSize: 13.5, lineHeight: 1.5 }}>{body}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Starting at 23:50 still buys the full half hour. Saying so is the
              difference between a team trusting the clock and not starting. */}
          {status.late_start && !blocked && (
            <div style={{ margin: '14px 16px 0', padding: '11px 13px', border: '1px solid var(--rd-gold)', borderLeft: '3px solid var(--rd-gold)', background: 'rgba(242,193,78,0.1)', fontSize: 13.5, lineHeight: 1.5 }}>
              The window closes at {istTime(status.ends_at)} IST, but starting now still gives you the
              full {status.duration_minutes} minutes. You will not be cut off part-way.
            </div>
          )}

          {blocked ? (
            <div style={{ margin: '14px 16px 0', padding: '12px 14px', border: '1px solid var(--rd-bad)', borderLeft: '3px solid var(--rd-bad)', background: 'rgba(224,91,75,0.1)', display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, lineHeight: 1.5 }}>
              <AlertTriangle size={16} style={{ color: 'var(--rd-bad)', flex: 'none', marginTop: 2 }} aria-hidden="true" />
              <span>{blocked}</span>
            </div>
          ) : (
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '16px 16px 0', cursor: 'pointer', fontSize: 14, lineHeight: 1.5 }}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                style={{ marginTop: 3, width: 16, height: 16, accentColor: 'var(--rd-accent)' }}
              />
              {/* The gate exists because starting by accident burns the team's
                  only attempt — there is no reset a player can reach. */}
              <span>I have read the above, my team is ready, and I understand the {status.duration_minutes}-minute clock starts now.</span>
            </label>
          )}

          {error && (
            <div style={{ margin: '12px 16px 0', color: 'var(--rd-bad)', fontSize: 13.5 }}>{error}</div>
          )}

          <div className="scr__actions" style={{ marginTop: 14 }}>
            <span className="scr__saving">
              {status.state === 'open' ? `Closes ${istTime(status.ends_at)} IST` : ''}
            </span>
            <button type="button" className="scr__btn" onClick={() => router.push('/dashboard')}>
              Back to dashboard
            </button>
            <button
              type="button"
              className="scr__btn scr__btn--submit"
              onClick={() => void start()}
              disabled={Boolean(blocked) || !agreed || starting}
            >
              {starting ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Starting…</> : 'Start the screening'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
