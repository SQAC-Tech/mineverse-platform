'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert, Swords, Timer, Trophy } from 'lucide-react';
import type { GuardianName } from '@/lib/gameplay/guardians/service';

interface GuardianArenaProps {
  guardianName: GuardianName;
  roundId: number;
  /** Artwork shown while the guardian is idle, won or on cooldown. */
  art: string;
  reward: string;
  penalty: string;
  onResolved?: () => void;
}

interface GuardianQuestion {
  id: string;
  order_index: number;
  type: string;
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

export function GuardianArena({ guardianName, roundId, art, reward, penalty, onResolved }: GuardianArenaProps) {
  const [state, setState] = useState<GuardianState | null>(null);
  const [questions, setQuestions] = useState<GuardianQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const label = LABELS[guardianName] ?? guardianName;

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/team/guardian/status?guardian_name=${guardianName}&round_id=${roundId}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setState(json.data ?? null);
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

  return (
    <section className="round-ui__panel gd">
      <header className="gd__head">
        <div>
          <p className="round-ui__panel-title"><Swords size={14} aria-hidden="true" /> {label}</p>
          <p className="gd__sub">Rapid fire · every answer must be correct</p>
        </div>
        <span className={`gd__badge gd__badge--${state?.status ?? 'idle'}`}>
          {state?.status === 'won' ? 'Defeated'
            : state?.status === 'started' ? 'In battle'
            : state?.status === 'lost' ? 'Beat you'
            : 'Not attempted'}
        </span>
      </header>

      <div className="gd__body">
        {error && (
          <p className="gd__error"><AlertTriangle size={14} aria-hidden="true" /> {error}</p>
        )}

        {loading ? (
          <p className="gd__note">Checking the guardian…</p>
        ) : state?.status === 'won' ? (
          <div className="gd__result">
            <Trophy size={30} aria-hidden="true" />
            <p className="gd__result-title">{label} defeated</p>
            <p className="gd__note">Reward claimed. A guardian can only be beaten once.</p>
          </div>
        ) : inBattle ? (
          <div className="gd__battle">
            <div className="gd__battle-bar">
              <span>Attempt #{state.attempt_number}</span>
              <span>{answeredCount} / {questions.length} answered</span>
              {deadlineLeft !== null && (
                <strong className={deadlineLeft < 30 ? 'gd__timer gd__timer--low' : 'gd__timer'}>
                  <Timer size={13} aria-hidden="true" /> {clock(deadlineLeft)}
                </strong>
              )}
            </div>

            {questions.length === 0 ? (
              <p className="gd__note">
                This battle is already running but its questions are not on this device. Resolve it to close the
                attempt, then retry.
              </p>
            ) : questions.map((question) => (
              <div key={question.id} className="gd__question">
                <label htmlFor={`gd-${question.id}`}>
                  <b>Q{question.order_index}</b> {question.prompt}
                </label>
                <input
                  id={`gd-${question.id}`}
                  className="gd__input"
                  value={answers[question.id] ?? ''}
                  onChange={(event) => setAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))}
                  placeholder="Your answer"
                  disabled={deadlineLeft === 0}
                  autoComplete="off"
                />
              </div>
            ))}

            {deadlineLeft === 0 && <p className="gd__error">Time is up — submitting now counts as a loss.</p>}

            <button type="button" className="round-ui__cta" disabled={busy} onClick={() => void submit()}>
              {busy ? 'Resolving…' : 'Submit answers'}
            </button>
            <p className="gd__note">Win: {reward}. Loss: {penalty} and a 3-minute cooldown.</p>
          </div>
        ) : (
          <div className="gd__idle">
            <div className="round-ui__art gd__art"><img src={art} alt="" /></div>

            {state?.status === 'lost' && (
              <p className="gd__error">
                <ShieldAlert size={14} aria-hidden="true" />
                Attempt #{state.attempt_number} failed
                {state.correct_count != null && state.total_questions != null
                  ? ` — ${state.correct_count} of ${state.total_questions} correct.`
                  : '.'}
              </p>
            )}

            <dl className="gd__stakes">
              <div><dt>Win</dt><dd className="gd__win">{reward}</dd></div>
              <div><dt>Loss</dt><dd className="gd__loss">{penalty}</dd></div>
            </dl>

            {cooldownLeft > 0 ? (
              <>
                <button type="button" className="round-ui__cta" disabled>
                  <Timer size={15} aria-hidden="true" /> Cooldown {clock(cooldownLeft)}
                </button>
                <p className="gd__note">A Guardian Retry Token from the marketplace skips this cooldown.</p>
              </>
            ) : (
              <>
                <button type="button" className="round-ui__cta" disabled={busy} onClick={() => void start()}>
                  <Swords size={15} aria-hidden="true" /> {busy ? 'Starting…' : state ? 'Retry challenge' : 'Challenge guardian'}
                </button>
                <p className="gd__note">Optional · the round timer keeps running during a battle.</p>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
