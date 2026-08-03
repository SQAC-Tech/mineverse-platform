'use client';

import { useState, useEffect, useCallback } from 'react';
import { Swords, ShieldAlert, Trophy, Timer, AlertTriangle } from 'lucide-react';
import { GuardianName } from '@/lib/gameplay/guardians/service';
import { Panel, Btn, Pill, Loading, Field } from '@/components/admin/nether-ui';

interface GuardianBattleProps {
  guardianName: GuardianName;
  roundId: number;
  mandatory?: boolean;
  onResolved?: () => void;
  refreshToken?: number;
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

export function GuardianBattle({ guardianName, roundId, mandatory, onResolved, refreshToken }: GuardianBattleProps) {
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
      const res = await fetch(
        `/api/team/guardian/status?guardian_name=${guardianName}&round_id=${roundId}`,
        { cache: 'no-store' },
      );
      const json = await res.json();
      if (json.success) setState(json.data ?? null);
    } catch {
      // Status is advisory; the panel still renders its last known state.
    } finally {
      setLoading(false);
    }
  }, [guardianName, roundId]);

  useEffect(() => { void fetchStatus(); }, [fetchStatus, refreshToken]);

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

      if (json.success) {
        setState(json.data);
        setQuestions(json.data.questions ?? []);
        setAnswers({});
      } else {
        setError(json.error?.message ?? startErrorCopy(json.error?.code));
      }
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
          answers: questions.map((q) => ({ question_id: q.id, answer_text: answers[q.id] ?? '' })),
        }),
      });
      const json = await res.json();

      if (json.success) {
        setState(json.data);
        setQuestions([]);
        onResolved?.();
      } else {
        setError(json.error?.message ?? 'Could not resolve the battle.');
      }
    } catch {
      setError('Could not reach the server. Your attempt was not submitted.');
    } finally {
      setBusy(false);
    }
  };

  const inBattle = state?.status === 'started';
  const answeredAll = questions.length > 0 && questions.every((q) => (answers[q.id] ?? '').trim().length > 0);

  return (
    <Panel
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Swords size={13} /> {label}</span>}
      subtitle={mandatory ? 'Mandatory — required before PvP' : 'Optional challenge'}
      actions={
        state?.status === 'won' ? <Pill tone="ok"><Trophy size={10} /> defeated</Pill>
          : inBattle ? <Pill tone="live">in battle</Pill>
          : state?.status === 'lost' ? <Pill tone="danger">defeated you</Pill>
          : <Pill tone="idle">not attempted</Pill>
      }
    >
      {loading ? (
        <Loading label="Checking guardian" />
      ) : (
        <>
          {error && (
            <div
              style={{
                display: 'flex', gap: 8, alignItems: 'flex-start',
                padding: 10, marginBottom: 12, fontSize: 10.5,
                background: 'rgb(from var(--accent-danger) r g b / 45%)',
                border: '1px solid #a3324a', color: '#ff9db0',
              }}
            >
              <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
            </div>
          )}

          {/* Won — terminal state, reward already claimed. */}
          {state?.status === 'won' && (
            <div style={{ textAlign: 'center', padding: '14px 8px' }}>
              <Trophy size={26} style={{ color: 'var(--ok)' }} />
              <p style={{ fontSize: 12, marginTop: 8 }}>{label} defeated</p>
              <p className="n-panel-sub" style={{ marginTop: 4 }}>
                Reward claimed. A guardian can only be beaten once.
              </p>
            </div>
          )}

          {/* Active battle — questions are only visible here. */}
          {inBattle && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="n-panel-sub">Attempt #{state.attempt_number}</span>
                {deadlineLeft !== null && (
                  <Pill tone={deadlineLeft < 30 ? 'danger' : 'live'}>
                    <Timer size={10} /> {Math.floor(deadlineLeft / 60)}:{String(deadlineLeft % 60).padStart(2, '0')}
                  </Pill>
                )}
              </div>

              {questions.length === 0 ? (
                <p className="n-panel-sub">
                  This battle is already in progress but its questions are not on this device.
                  Resolve it to close the attempt, then retry.
                </p>
              ) : (
                questions.map((q) => (
                  <Field key={q.id} label={`Q${q.order_index}`}>
                    <p style={{ fontSize: 11, marginBottom: 6 }}>{q.prompt}</p>
                    <input
                      className="n-input"
                      value={answers[q.id] ?? ''}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder="Your answer"
                      disabled={deadlineLeft === 0}
                    />
                  </Field>
                ))
              )}

              {deadlineLeft === 0 && (
                <p className="n-panel-sub" style={{ color: '#ff9db0' }}>
                  Time is up — submitting now counts as a loss.
                </p>
              )}

              <Btn variant="primary" disabled={busy} onClick={submit}>
                {busy ? 'Resolving…' : questions.length > 0 && !answeredAll ? 'Submit anyway' : 'Submit answers'}
              </Btn>
              <p className="n-panel-sub">
                Every answer must be correct to win. A wrong set costs the defeat penalty and starts a 3-minute cooldown.
              </p>
            </div>
          )}

          {/* Never attempted, or lost and free to retry. */}
          {!inBattle && state?.status !== 'won' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {state?.status === 'lost' && (
                <div
                  style={{
                    padding: 10, fontSize: 10.5,
                    background: 'rgb(from var(--accent-danger) r g b / 35%)',
                    border: '1px solid rgb(163 50 74 / 60%)',
                  }}
                >
                  <ShieldAlert size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                  Attempt #{state.attempt_number} failed
                  {state.correct_count != null && state.total_questions != null &&
                    ` — ${state.correct_count} of ${state.total_questions} correct`}
                  .
                </div>
              )}

              {!state && (
                <p className="n-panel-sub">
                  {mandatory
                    ? 'You must defeat this guardian before you can enter the PvP duel.'
                    : 'Beating this guardian awards bonus resources. Losing costs a penalty.'}
                </p>
              )}

              {cooldownLeft > 0 ? (
                <>
                  <Btn disabled>
                    <Timer size={12} /> Cooldown {Math.floor(cooldownLeft / 60)}:{String(cooldownLeft % 60).padStart(2, '0')}
                  </Btn>
                  <p className="n-panel-sub">
                    A Guardian Retry Token from the marketplace skips this cooldown.
                  </p>
                </>
              ) : (
                <Btn variant="primary" disabled={busy} onClick={start}>
                  <Swords size={12} /> {busy ? 'Starting…' : state ? 'Retry challenge' : 'Challenge guardian'}
                </Btn>
              )}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

function startErrorCopy(code?: string) {
  switch (code) {
    case 'NO_QUESTIONS':
      return 'This guardian has no approved question pack yet — ask an organizer.';
    case 'ALREADY_WON':
      return 'You have already defeated this guardian.';
    case 'IN_PROGRESS':
      return 'A battle is already running.';
    case 'COOLDOWN':
      return 'Cooldown is still active.';
    default:
      return 'Could not start the battle.';
  }
}
