'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ShieldAlert, Swords, Timer, Trophy } from 'lucide-react';
import type { GuardianName } from '@/lib/gameplay/guardians/config';
import { deltaList, promptBlocks } from './round-presentation';

interface GuardianArenaProps {
  guardianName: GuardianName;
  roundId: number;
  /** Artwork for the banner. Rounds without their own art render without it. */
  art?: string;
  /** Resource deltas, so the stakes can be shown as icons rather than a sentence. */
  reward: Record<string, number>;
  penalty: Record<string, number>;
  mandatory?: boolean;
  timeLimitSeconds?: number | null;
  onResolved?: () => void;
}

interface GuardianQuestion {
  id: string;
  order_index: number;
  type: string;
  title?: string;
  prompt: string;
  content: unknown;
  time_limit_seconds: number | null;
}

interface GuardianState {
  id: string;
  status: 'started' | 'won' | 'lost';
  attempt_number: number;
  retry_after: string | null;
  deadline_at: string | null;
  correct_count: number | null;
  total_questions: number | null;
  questions?: GuardianQuestion[];
}

const LABELS: Record<GuardianName, string> = {
  forest_guardian: 'Forest Guardian',
  skeleton_archer: 'Skeleton Archer',
  blaze_guardian: 'Blaze Guardian',
};

const COOLDOWN_SECONDS = 3 * 60;

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function startErrorCopy(code?: string) {
  switch (code) {
    case 'NO_QUESTIONS': return 'This guardian has no question pack yet — ask an organizer.';
    case 'ALREADY_WON': return 'You have already defeated this guardian.';
    case 'IN_PROGRESS': return 'A battle is already running.';
    case 'COOLDOWN': return 'The cooldown is still running.';
    default: return 'Could not start the battle.';
  }
}

function StakeChips({ delta, tone }: { delta: Record<string, number>; tone: 'win' | 'loss' }) {
  const entries = deltaList(delta);
  if (entries.length === 0) return <span className="gd__note">Nothing</span>;

  return (
    <div className="gd__chips">
      {entries.map(({ key, icon, label, amount }) => (
        <span key={key} className={`gd__chip gd__chip--${tone}`} title={label}>
          <img src={icon} alt="" />
          {amount > 0 ? '+' : '−'}{Math.abs(amount)}
        </span>
      ))}
    </div>
  );
}

export function GuardianArena({
  guardianName, roundId, art, reward, penalty, mandatory, timeLimitSeconds, onResolved,
}: GuardianArenaProps) {
  const [state, setState] = useState<GuardianState | null>(null);
  const [questions, setQuestions] = useState<GuardianQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [packSize, setPackSize] = useState<number | null>(null);
  const firstInput = useRef<HTMLInputElement | null>(null);

  const label = LABELS[guardianName] ?? guardianName;

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/team/guardian/status?guardian_name=${guardianName}&round_id=${roundId}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setState(json.data ?? null);
        if (typeof json.pack_size === 'number') setPackSize(json.pack_size);
        // A battle already in progress ships its pack with the status, so a reload
        // or a dropped connection drops back into the same questions.
        if (json.data?.status === 'started' && json.data.questions?.length) {
          setQuestions(json.data.questions);
        }
      }
    } catch {
      // Status is advisory — the arena keeps showing its last known state.
    } finally {
      setLoading(false);
    }
  }, [guardianName, roundId]);

  useEffect(() => { void fetchStatus(); }, [fetchStatus]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const cooldownLeft = state?.retry_after
    ? Math.max(0, Math.ceil((new Date(state.retry_after).getTime() - now) / 1000))
    : 0;
  const deadlineLeft = state?.deadline_at
    ? Math.max(0, Math.ceil((new Date(state.deadline_at).getTime() - now) / 1000))
    : null;
  const inBattle = state?.status === 'started';
  const answeredCount = questions.filter((question) => (answers[question.id] ?? '').trim().length > 0).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;
  const outOfTime = deadlineLeft === 0;
  const urgent = deadlineLeft !== null && deadlineLeft > 0 && deadlineLeft <= 30;

  // The timer ring reads as "how much of the window is left", so it needs the
  // window's full length — the deadline alone cannot give that.
  const windowSeconds = timeLimitSeconds ?? null;
  const timeFraction = windowSeconds && deadlineLeft !== null
    ? Math.max(0, Math.min(1, deadlineLeft / windowSeconds))
    : null;

  const start = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/team/guardian/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guardian_name: guardianName, round_id: roundId }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? startErrorCopy(json.error?.code));
        return;
      }
      setState(json.data);
      setQuestions(json.data.questions ?? []);
      setAnswers({});
      // The clock is already running server-side, so put the cursor in question 1.
      window.setTimeout(() => firstInput.current?.focus(), 60);
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/team/guardian/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          guardian_name: guardianName,
          round_id: roundId,
          answers: questions.map((question) => ({ question_id: question.id, answer_text: answers[question.id] ?? '' })),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? 'Could not resolve the battle.');
        return;
      }
      setState(json.data);
      setQuestions([]);
      onResolved?.();
    } catch {
      setError('Could not reach the server. Your attempt was not submitted.');
    } finally {
      setBusy(false);
    }
  };

  const status = state?.status ?? 'idle';
  const questionCount = questions.length || state?.total_questions || packSize || null;

  return (
    <section className={`round-ui__panel gd gd--${status}`}>
      <header className={art ? 'gd__banner gd__banner--art' : 'gd__banner'}>
        {art && <img className="gd__banner-art" src={art} alt="" aria-hidden="true" />}
        <div className="gd__banner-scrim" aria-hidden="true" />
        <div className="gd__banner-text">
          <p className="gd__eyebrow">
            <Swords size={12} aria-hidden="true" /> Guardian battle
            {mandatory && <span className="gd__req">Required</span>}
          </p>
          <h2 className="gd__name">{label}</h2>
          <p className="gd__rules">
            {questionCount ? `${questionCount} questions` : 'Sealed pack'}
            <i>·</i>
            {windowSeconds ? clock(windowSeconds) : 'Round timer'}
            <i>·</i>
            every answer must be right
          </p>
        </div>
        <span className={`gd__badge gd__badge--${status}`}>
          {status === 'won' ? 'Defeated'
            : status === 'started' ? 'In battle'
            : status === 'lost' ? 'Beat you'
            : 'Not attempted'}
        </span>
      </header>

      <div className="gd__body">
        {error && (
          <p className="gd__error" role="alert"><AlertTriangle size={14} aria-hidden="true" /> {error}</p>
        )}

        {loading ? (
          <p className="gd__note">Checking the guardian…</p>
        ) : status === 'won' ? (
          <div className="gd__victory">
            <span className="gd__victory-medal" aria-hidden="true"><Trophy size={34} /></span>
            <p className="gd__victory-title">{label} defeated</p>
            <StakeChips delta={reward} tone="win" />
            <p className="gd__note">Reward claimed and banked. A guardian can only be beaten once.</p>
          </div>
        ) : inBattle ? (
          <div className="gd__battle">
            <div className="gd__hud">
              <div className="gd__hud-left">
                <span className="gd__attempt">Attempt #{state.attempt_number}</span>
                <div className="gd__pips" aria-label={`${answeredCount} of ${questions.length} answered`}>
                  {questions.map((question) => (
                    <i
                      key={question.id}
                      className={(answers[question.id] ?? '').trim() ? 'gd__pip gd__pip--on' : 'gd__pip'}
                      aria-hidden="true"
                    />
                  ))}
                </div>
              </div>

              {deadlineLeft !== null && (
                <div
                  className={`gd__clock${urgent ? ' gd__clock--urgent' : ''}${outOfTime ? ' gd__clock--out' : ''}`}
                  style={timeFraction !== null ? { ['--gd-time' as string]: `${timeFraction * 100}%` } : undefined}
                  role="timer"
                  aria-live="off"
                >
                  <Timer size={14} aria-hidden="true" />
                  <b>{clock(deadlineLeft)}</b>
                  {timeFraction !== null && <i className="gd__clock-fill" aria-hidden="true" />}
                </div>
              )}
            </div>

            {questions.length === 0 ? (
              <p className="gd__note">
                This battle is already running but its questions are not on this device. Resolve it to close the
                attempt, then retry.
              </p>
            ) : questions.map((question, index) => {
              const filled = (answers[question.id] ?? '').trim().length > 0;
              return (
                <div key={question.id} className={filled ? 'gd__question gd__question--done' : 'gd__question'}>
                  <div className="gd__q-head">
                    <span className="gd__q-no" aria-hidden="true">{index + 1}</span>
                    <label htmlFor={`gd-${question.id}`}>{question.title ?? `Question ${index + 1}`}</label>
                    {filled && <Check className="gd__q-check" size={15} aria-label="Answered" />}
                  </div>

                  {/* A label collapses whitespace, so a code listing inside one lost
                      its indentation entirely. Prose and code are split instead. */}
                  <div className="round-ui__prompt-blocks">
                    {promptBlocks(question.prompt).map((block, blockIndex) =>
                      block.kind === 'code' ? (
                        <pre key={blockIndex} className="round-ui__code"><code>{block.body}</code></pre>
                      ) : (
                        <p key={blockIndex} className="round-ui__prompt">{block.body}</p>
                      ),
                    )}
                  </div>

                  <input
                    id={`gd-${question.id}`}
                    ref={index === 0 ? firstInput : undefined}
                    className="gd__input"
                    value={answers[question.id] ?? ''}
                    onChange={(event) => setAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))}
                    placeholder="Your answer"
                    disabled={outOfTime}
                    autoComplete="off"
                  />
                </div>
              );
            })}

            {outOfTime && (
              <p className="gd__error"><AlertTriangle size={14} aria-hidden="true" /> Time is up — submitting now counts as a loss.</p>
            )}

            {/* Stays reachable while the questions scroll past it. */}
            <div className="gd__footer">
              <span className="gd__footer-note">
                {allAnswered ? 'All answered — every one must be right to win.' : `${questions.length - answeredCount} left unanswered`}
              </span>
              <button type="button" className="round-ui__cta" disabled={busy} onClick={() => void submit()}>
                <Swords size={15} aria-hidden="true" /> {busy ? 'Resolving…' : 'Submit answers'}
              </button>
            </div>
          </div>
        ) : (
          <div className="gd__idle">
            {status === 'lost' && (
              <div className="gd__defeat" role="status">
                <ShieldAlert size={16} aria-hidden="true" />
                <div>
                  <b>Attempt #{state?.attempt_number} failed</b>
                  {state?.correct_count != null && state?.total_questions != null && (
                    <span className="gd__score">{state.correct_count} of {state.total_questions} correct</span>
                  )}
                </div>
              </div>
            )}

            <dl className="gd__stakes">
              <div className="gd__stake gd__stake--win">
                <dt>Win</dt>
                <dd><StakeChips delta={reward} tone="win" /></dd>
              </div>
              <div className="gd__stake gd__stake--loss">
                <dt>Loss</dt>
                <dd><StakeChips delta={penalty} tone="loss" /></dd>
              </div>
            </dl>

            {cooldownLeft > 0 ? (
              <div className="gd__cooldown">
                <div className="gd__cooldown-head">
                  <span><Timer size={13} aria-hidden="true" /> Cooldown</span>
                  <b>{clock(cooldownLeft)}</b>
                </div>
                <div className="gd__cooldown-track">
                  <i
                    className="gd__cooldown-fill"
                    style={{ width: `${Math.max(0, 100 - (cooldownLeft / COOLDOWN_SECONDS) * 100)}%` }}
                    aria-hidden="true"
                  />
                </div>
                <p className="gd__note">A Guardian Retry Token from the marketplace skips this wait.</p>
              </div>
            ) : (
              <>
                <button type="button" className="round-ui__cta gd__go" disabled={busy} onClick={() => void start()}>
                  <Swords size={15} aria-hidden="true" /> {busy ? 'Starting…' : state ? 'Retry challenge' : 'Challenge guardian'}
                </button>
                <p className="gd__note">
                  {mandatory
                    ? 'Required before the PvP duel · the round timer keeps running during a battle.'
                    : 'Optional · the round timer keeps running during a battle.'}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
