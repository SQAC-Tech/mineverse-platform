'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Clock, WifiOff, Target, Flag } from 'lucide-react';
import { ResourcesBar } from '@/components/game/resources/ResourcesBar';
import { CraftingPanel } from '@/components/game/crafting/CraftingPanel';
import { PvpPanel } from '@/components/game/pvp/PvpPanel';
import { QuestionList } from '@/components/game/questions/QuestionList';
import { MarketplaceStore } from '@/components/game/marketplace/MarketplaceStore';
import { ConsumableInventory } from '@/components/game/marketplace/ConsumableInventory';
import { ChoicePanel } from '@/components/game/choices/ChoicePanel';
import { getRoundConfig } from '@/lib/gameplay/round-config';
import { Panel, Btn, Pill, Loading } from '@/components/admin/nether-ui';
import { useProctorSession } from '@/components/game/proctor/ProctorProvider';
import { roundChrome } from '@/components/game/custom-round-ui/round-presentation';
import '@/components/game/custom-round-ui/round-ui.css';

interface RoundShellProps { roundId: number }

interface RoundQuestion {
  id: string;
  type: string;
  title?: string;
  prompt: string;
  content: unknown;
  order_index: number;
  language_options: string[];
  time_limit_seconds: number | null;
  submission_status: string | null;
  submission_revision: number | null;
  /** What a correct answer pays, straight from the question row. */
  pays?: Record<string, number>;
}

interface RoundData {
  round_id: number;
  round_name: string;
  /** This team's own code, used to namespace local answer drafts. */
  team_code: string | null;
  ends_at: string | null;
  server_time: string;
  questions: RoundQuestion[];
}

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function RoundShell({ roundId }: RoundShellProps) {
  const router = useRouter();
  // Null when the proctor is switched off, or when this shell is rendered
  // outside a ProctorProvider — the round still works either way.
  const proctor = useProctorSession();
  const config = getRoundConfig(roundId);

  const [round, setRound] = useState<RoundData | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  /**
   * Bumped after any successful mutation anywhere in the round. Every child
   * panel takes it as a prop and refetches, so a craft updates the resource bar
   * and a guardian win updates crafting eligibility without a manual reload.
   */
  const [refreshToken, setRefreshToken] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const refreshAll = useCallback(() => setRefreshToken((v) => v + 1), []);

  const fetchRound = useCallback(async () => {
    try {
      const res = await fetch(`/api/rounds/${roundId}/questions`, { cache: 'no-store' });
      const json = await res.json();
      setOffline(false);

      if (!json.success) {
        setError({ code: json.error?.code ?? 'UNAVAILABLE', message: json.error?.message ?? 'Round unavailable' });
        return;
      }

      setRound(json.data);
      setError(null);
    } catch {
      // A dropped connection must not wipe a round already on screen.
      setOffline(true);
      if (!round) setError({ code: 'NETWORK', message: 'Cannot reach the server.' });
    } finally {
      setLoading(false);
    }
  }, [roundId, round]);

  useEffect(() => {
    void fetchRound();
    const poll = window.setInterval(fetchRound, 10000);
    return () => window.clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const answeredIds = (round?.questions ?? []).filter((q) => Boolean(q.submission_status)).map((q) => q.id);
  const unansweredCount = (round?.questions.length ?? 0) - answeredIds.length;

  /**
   * Ends the round for this team: locks every answer they saved, then returns them
   * to the dashboard. Only answered questions are sent — the section endpoint
   * rejects a list containing an unanswered one, and a team that ran out of time
   * still needs a way to hand in what they did finish.
   */
  const finishRound = useCallback(async () => {
    setFinishing(true);
    try {
      if (answeredIds.length > 0) {
        const res = await fetch('/api/submissions/section', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ round_id: roundId, question_ids: answeredIds }),
        });
        const json = await res.json();
        if (!json.success) {
          setError({ code: json.error?.code ?? 'SUBMIT_FAILED', message: json.error?.message ?? 'Could not submit the round.' });
          return;
        }
      }
      // Closes the proctor session and leaves fullscreen before navigating, so
      // the dashboard is not stuck behind a fullscreen scrim.
      await proctor?.finish();
      router.push('/dashboard');
    } catch {
      setError({ code: 'NETWORK', message: 'Could not reach the server. Nothing was submitted.' });
    } finally {
      setFinishing(false);
    }
  }, [answeredIds, roundId, router, proctor]);

  const remaining = useMemo(() => {
    if (!round?.ends_at) return null;
    return formatRemaining(new Date(round.ends_at).getTime() - now);
  }, [round?.ends_at, now]);

  const timeUp = round?.ends_at ? new Date(round.ends_at).getTime() <= now : false;

  if (!config) {
    return (
      <Shell biome="nether" roundId={roundId} title="Unknown round">
        <Panel>
          <div className="n-empty">Round {roundId} does not exist.</div>
          <div style={{ textAlign: 'center' }}>
            <Link href="/dashboard" className="n-btn n-btn-secondary">Back to dashboard</Link>
          </div>
        </Panel>
      </Shell>
    );
  }

  return (
    <Shell
      biome={config.biome}
      roundId={roundId}
      title={round?.round_name ?? config.name}
      tagline={config.tagline}
      header={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {offline && <Pill tone="danger"><WifiOff size={11} /> Offline — retrying</Pill>}
          <div
            style={{
              padding: '7px 14px',
              background: 'var(--bg-void)',
              border: `1px solid ${timeUp ? '#a3324a' : 'rgb(from var(--accent-muted) r g b / 45%)'}`,
              textAlign: 'center',
              minWidth: 96,
            }}
          >
            <div className="n-stat-label"><Clock size={9} style={{ verticalAlign: 'middle' }} /> Time left</div>
            <div
              className="n-mono"
              style={{
                fontSize: 19,
                marginTop: 2,
                color: timeUp ? '#ff9db0' : 'var(--accent-primary)',
                textShadow: '0 0 8px rgb(from var(--accent-primary) r g b / 40%)',
              }}
            >
              {remaining ?? '--:--'}
            </div>
          </div>
          <Btn onClick={() => { void fetchRound(); refreshAll(); }} aria-label="Refresh round">
            <RefreshCw size={12} /> Refresh
          </Btn>
        </div>
      }
    >
      {loading ? (
        <Panel><Loading label="Entering the biome" /></Panel>
      ) : error ? (
        <Panel title="Round unavailable">
          <p style={{ fontSize: 11.5, marginBottom: 6 }}>{lockCopy(error.code)}</p>
          <p className="n-panel-sub" style={{ marginBottom: 14 }}>{error.message}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn variant="primary" onClick={fetchRound}><RefreshCw size={12} /> Try again</Btn>
            <Link href="/dashboard" className="n-btn n-btn-secondary">Back to dashboard</Link>
          </div>
        </Panel>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <ResourcesBar refreshToken={refreshToken} />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 9,
              padding: '10px 12px',
              marginBottom: 12,
              background: 'var(--bg-panel)',
              border: '1px solid rgb(from var(--accent-primary) r g b / 35%)',
              fontSize: 11,
            }}
          >
            <Target size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: 1 }} />
            <span>{config.objective}</span>
          </div>

          {timeUp && (
            <div style={{ marginBottom: 12 }}>
              <Panel>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 11 }}>
                  <Clock size={14} style={{ color: '#ff9db0' }} />
                  The round timer has run out. Answers can no longer be revised — wait for the organizers to grade.
                </div>
              </Panel>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 340px)', gap: 12, alignItems: 'start' }} className="round-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
              <QuestionList
                roundId={roundId}
                teamCode={round?.team_code ?? null}
                questions={round?.questions ?? []}
                onSubmitted={() => { void fetchRound(); refreshAll(); }}
                locked={timeUp}
              />

              {/* No guardian panel here on purpose. This shell only serves Round 5,
                  which has no guardian, and the second guardian component that used
                  to sit here was never rendered — so it never got the fixes the real
                  one did. Rounds 1-3 use GuardianArena in the custom round shells.
                  If a guardian is ever needed here, render GuardianArena inside a
                  `.round-ui .round-ui--end` wrapper so its palette tokens resolve. */}

              {config.pvp && <PvpPanel />}

              <Panel title="Finish the round">
                <p style={{ fontSize: 11.5, marginBottom: 10 }}>
                  Hand in your {answeredIds.length} saved {answeredIds.length === 1 ? 'answer' : 'answers'} and return
                  to the dashboard. Submitted answers are final.
                  {unansweredCount > 0 && ` ${unansweredCount} question${unansweredCount === 1 ? '' : 's'} left unanswered will score nothing.`}
                </p>
                {confirmFinish ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn onClick={() => setConfirmFinish(false)} disabled={finishing}>Keep playing</Btn>
                    <Btn variant="primary" onClick={() => void finishRound()} disabled={finishing}>
                      <Flag size={12} /> {finishing ? 'Submitting…' : 'Submit and leave'}
                    </Btn>
                  </div>
                ) : (
                  <Btn variant="primary" onClick={() => setConfirmFinish(true)}>
                    <Flag size={12} /> Finish round
                  </Btn>
                )}
              </Panel>
            </div>

            <aside style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
              {config.craft && <CraftingPanel onCrafted={refreshAll} refreshToken={refreshToken} />}

              {/*
                ChoicePanel reads the Day 1 CHOICES catalog, which has no
                end_merchant entry — rendering it for Round 5 produced an empty
                panel. The End Merchant has its own Day 2 route and still needs
                a surface of its own.
              */}
              {config.choice && config.choice !== 'end_merchant' && (
                <ChoicePanel choiceKey={config.choice} onDecided={refreshAll} refreshToken={refreshToken} />
              )}

              {config.marketplace && (
                <>
                  <MarketplaceStore onPurchased={refreshAll} refreshToken={refreshToken} />
                  <ConsumableInventory refreshToken={refreshToken} onUsed={refreshAll} />
                </>
              )}
            </aside>
          </div>
        </>
      )}

      <style>{`
        @media (max-width: 1000px) {
          .round-grid { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
    </Shell>
  );
}

/** Turns an API error code into something a competing team can act on. */
function lockCopy(code: string) {
  switch (code) {
    case 'ROUND_NOT_ACTIVE':
      return 'This round has not been started by the organizers yet.';
    case 'ROUND_LOCKED':
      return 'This round has closed and is no longer accepting answers.';
    case 'TEAM_NOT_AUTHORIZED_FOR_ROUND':
      return 'Your team has not unlocked this round yet — finish the previous round’s craft first.';
    case 'ROUND_NOT_FOUND':
      return 'That round does not exist.';
    case 'UNAUTHORIZED':
      return 'Your session expired. Sign in again to continue.';
    case 'NETWORK':
      return 'We cannot reach the server right now.';
    default:
      return 'This round is not available for your team.';
  }
}

function Shell({
  biome, roundId, title, tagline, header, children,
}: {
  biome: string;
  roundId: number;
  title: string;
  tagline?: string;
  header?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Only the palette is borrowed from the biome shells, not their layout — this
  // shell scrolls. Without it Round 5 rendered on the bare admin theme, because
  // `.biome-end` has never existed in any stylesheet.
  const { themeClass } = roundChrome(roundId);

  return (
    <main className={`biome biome-${biome} round-ui-scene ${themeClass}`} style={{ minHeight: '100vh' }}>
      <div className="round-ui-scene__backdrop" aria-hidden="true" />
      <div className="round-ui-scene__shade" aria-hidden="true" />
      <div className="round-ui-scene__scrim" aria-hidden="true" />
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '20px 16px 40px' }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/dashboard" className="n-btn n-btn-ghost" aria-label="Back to dashboard" style={{ padding: 9 }}>
              <ArrowLeft size={14} />
            </Link>
            <div>
              <div className="n-stat-label">Round {roundId}</div>
              <h1
                style={{
                  fontSize: 20,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  color: 'var(--text-onDark)',
                  textShadow: '0 0 12px rgb(from var(--accent-primary) r g b / 35%)',
                }}
              >
                {title}
              </h1>
              {tagline && <div className="n-panel-sub" style={{ marginTop: 2 }}>{tagline}</div>}
            </div>
          </div>
          {header}
        </header>

        <div style={{ marginBottom: 16 }}><hr className="n-lava-divider" /></div>

        {children}
      </div>
    </main>
  );
}
