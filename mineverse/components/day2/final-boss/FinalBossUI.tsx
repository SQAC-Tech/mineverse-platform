'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  Flame,
  Lock,
  RotateCcw,
  Shield,
  ShieldAlert,
  Sparkles,
  Sword,
  Swords,
  Timer,
  Trophy,
} from 'lucide-react';
import { promptBlocks } from '@/components/game/custom-round-ui/round-presentation';
import { startPoll } from '@/lib/client/poll';

import '@/app/theme-kit.css';
import '@/app/(game)/biome.css';
import '@/components/game/custom-round-ui/round-ui.css';
import './final-boss.css';

interface QuestionPayload {
  id: string;
  prompt: string;
  content: any;
  order_index?: number;
  language_options?: string[];
  /** The four choices, as the screening pack stores them. */
  options?: string[];
  type?: string;
  title?: string;
}

interface FinalBossAttempt {
  id: string;
  team_id: string;
  status: 'active' | 'won' | 'lost';
  question_payload: {
    questions: QuestionPayload[];
  };
  started_at: string;
  completed_at?: string | null;
  cooldown_until?: string | null;
  score_evidence?: any;
}

interface Day2Status {
  success: boolean;
  team_id?: string;
  portal: {
    state: string;
    has_fragment: boolean;
    is_repaired: boolean;
    diamond_count: number;
    nether_core_count: number;
  };
  final_boss: {
    last_attempt: FinalBossAttempt | null;
  };
}

interface CraftRecipeItem {
  item: string;
  label: string;
  crafted: boolean;
}

const TOTAL_COOLDOWN_SECONDS = 3 * 60;

function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function FinalBossUI() {
  const router = useRouter();
  const [status, setStatus] = useState<Day2Status | null>(null);
  const [recipes, setRecipes] = useState<CraftRecipeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [attempting, setAttempting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState<QuestionPayload[] | null>(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  // The chosen option's index, per question. Never the option text: the
  // server marks against `correct_index` and an index is what it compares.
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const [statusRes, craftRes] = await Promise.all([
        fetch('/api/team/day2/status', { cache: 'no-store' }),
        fetch('/api/team/craft/recipes', { cache: 'no-store' }).catch(() => null),
      ]);

      if (statusRes.ok) {
        const data: Day2Status = await statusRes.json();
        if (data.success) {
          setStatus(data);

          const attempt = data.final_boss?.last_attempt;
          if (attempt?.status === 'active') {
            setQuestions(attempt.question_payload?.questions || []);
          } else if (attempt?.status === 'lost' && attempt.cooldown_until) {
            const cooldownMs = new Date(attempt.cooldown_until).getTime() - Date.now();
            if (cooldownMs > 0) {
              setTimeLeft(Math.ceil(cooldownMs / 1000));
            } else {
              setTimeLeft(0);
            }
          }
        }
      }

      if (craftRes && craftRes.ok) {
        const craftData = await craftRes.json();
        if (craftData.success && Array.isArray(craftData.data)) {
          setRecipes(craftData.data);
        }
      }
    } catch (e) {
      console.error('Failed to load final boss status:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    // Poll status regularly to keep cooldown and state in sync
    return startPoll(() => void fetchStatus(), 12_000);
  }, [fetchStatus]);

  // Local 1-second countdown clock for cooldown
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          void fetchStatus();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, fetchStatus]);

  const handleStartAttempt = async () => {
    setAttempting(true);
    setError('');
    try {
      const res = await fetch('/api/team/final-boss/attempts', { method: 'POST' });
      const data = await res.json();

      if (res.status === 503 || data.error === 'NOT_AVAILABLE') {
        setError('Final Boss challenges are being prepared by the organizers. Please stand by.');
      } else if (data.success && data.payload?.questions) {
        setQuestions(data.payload.questions);
        setActiveQuestionIndex(0);
        setAnswers({});
        setTimeLeft(0);
      } else {
        if (data.error === 'PORTAL_NOT_REPAIRED') {
          setError('Access Denied: The Ancient Nether Portal has not been repaired.');
        } else if (data.error === 'MISSING_DIAMOND_PICKAXE') {
          setError('Access Denied: You must craft the Diamond Pickaxe before facing the Ender Dragon.');
        } else if (data.error === 'ON_COOLDOWN') {
          setError('The dragon is invulnerable. You are currently on cooldown.');
          if (data.cooldown_until) {
            setTimeLeft(Math.max(0, Math.ceil((new Date(data.cooldown_until).getTime() - Date.now()) / 1000)));
          }
        } else {
          setError(data.error || 'Failed to start boss challenge.');
        }
      }
    } catch {
      setError('Could not connect to the game server. Please try again.');
    } finally {
      setAttempting(false);
    }
  };

  const handleSubmit = async () => {
    if (!questions || questions.length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const answersList = questions.map((q) => ({
        question_id: q.id,
        selected_index: answers[q.id] ?? null,
      }));

      const res = await fetch('/api/team/final-boss/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersList }),
      });
      const data = await res.json();

      if (data.success) {
        if (data.result === 'won') {
          // Re-fetch to transition to legendary victory screen
          await fetchStatus();
        } else {
          setQuestions(null);
          setAnswers({});
          if (data.cooldown_until) {
            const cd = Math.ceil((new Date(data.cooldown_until).getTime() - Date.now()) / 1000);
            setTimeLeft(Math.max(0, cd));
          } else {
            setTimeLeft(TOTAL_COOLDOWN_SECONDS);
          }
          await fetchStatus();
        }
      } else {
        setError(data.error || 'Failed to submit battle attack.');
      }
    } catch {
      setError('Network communication failed during attack submission.');
    } finally {
      setSubmitting(false);
    }
  };

  const portalRepaired = status?.portal?.is_repaired ?? false;
  const diamondPickaxeCrafted = recipes.find((r) => r.item === 'diamond_pickaxe')?.crafted ?? false;
  const isGated = !portalRepaired || (!diamondPickaxeCrafted && recipes.length > 0);
  const isWon = status?.final_boss?.last_attempt?.status === 'won';
  const inBattle = Boolean(questions && questions.length > 0);

  const totalQuestions = questions?.length || 7;
  const answeredCount = questions
    ? questions.filter((q) => answers[q.id] !== undefined).length
    : 0;
  const dragonHealthPercent = inBattle
    ? Math.max(5, Math.round(((totalQuestions - answeredCount) / totalQuestions) * 100))
    : 100;

  const currentQuestion = questions ? questions[activeQuestionIndex] : null;
  // The pack is multiple choice, so there is no language to pick and no
  // per-language wording of the prompt to look up.
  const activePrompt = currentQuestion?.prompt ?? '';

  const cooldownPercent = timeLeft > 0 ? (timeLeft / TOTAL_COOLDOWN_SECONDS) * 100 : 0;
  const radius = 58;
  const circumference = 2 * Math.PI * radius;

  return (
    <main className="fb-page round-ui--end">
      {/* Background and Atmospheric FX */}
      <div className="fb-backdrop" aria-hidden="true" />
      <div className="fb-shade" aria-hidden="true" />
      <div className="fb-scrim" aria-hidden="true" />
      <div className="fb-motes" aria-hidden="true">
        <span className="fb-mote" />
        <span className="fb-mote" />
        <span className="fb-mote" />
        <span className="fb-mote" />
        <span className="fb-mote" />
        <span className="fb-mote" />
      </div>

      {/* Top Header Bar */}
      <header className="fb-topbar">
        <Link href="/round5" className="fb-back-btn">
          <ArrowLeft size={14} /> BACK TO THE END
        </Link>
        <div className="fb-round-badge">
          <Sparkles size={14} /> ROUND 5 · FINAL BOSS
        </div>
      </header>

      {/* Minecraft Ender Dragon Boss Bar (Visible in all battle states) */}
      <div className="fb-bossbar">
        <div className="fb-bossbar__head">
          <h1 className="fb-bossbar__title">
            <Swords size={18} /> ENDER DRAGON <Swords size={18} />
          </h1>
        </div>
        <div className="fb-bossbar__meter" role="progressbar" aria-valuenow={dragonHealthPercent} aria-valuemin={0} aria-valuemax={100}>
          <div className="fb-bossbar__fill" style={{ width: `${dragonHealthPercent}%` }} />
          <div className="fb-bossbar__notches" aria-hidden="true">
            <span className="fb-bossbar__notch" />
            <span className="fb-bossbar__notch" />
            <span className="fb-bossbar__notch" />
            <span className="fb-bossbar__notch" />
            <span className="fb-bossbar__notch" />
            <span className="fb-bossbar__notch" />
          </div>
        </div>
        <p className="fb-bossbar__sub">
          {isWon
            ? '⚔️ BOSS DEFEATED · PROVISIONAL CHAMPIONS'
            : inBattle
              ? `SEALS INTACT: ${totalQuestions - answeredCount} OF ${totalQuestions} · ONE STRIKE, NO SECOND CHANCE`
              : timeLeft > 0
                ? `REGENERATING DEFENSES · COOLDOWN ACTIVE (${formatClock(timeLeft)})`
                : 'ANCIENT GUARDIAN OF THE VOID'}
        </p>
      </div>

      {/* Error Alert Display */}
      {error && (
        <div className="fb-error-banner" role="alert" style={{ maxWidth: '880px', margin: '0 auto' }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ── STATE 1: LOADING ── */}
      {loading ? (
        <div className="fb-card fb-gated-box">
          <p style={{ fontFamily: 'var(--fb-font-display)', fontSize: '13px', color: '#c489f5' }}>
            CONNECTING TO THE END DIMENSION…
          </p>
        </div>
      ) : isWon ? (
        /* ── STATE 2: VICTORY SCREEN ── */
        <div className="fb-card fb-victory-card">
          <div className="fb-victory-egg">
            <Trophy size={42} style={{ color: '#ffd700' }} />
          </div>
          <h2 className="fb-victory-title">ENDER DRAGON DEFEATED!</h2>
          <p className="fb-victory-sub">✦ PROVISIONAL VICTORY TRANSMITTED ✦</p>

          <div className="fb-cert-box">
            <p style={{ margin: '0 0 8px', fontFamily: 'var(--fb-font-display)', fontSize: '11px', color: '#ffd700' }}>
              OFFICIAL CERTIFICATION IN PROGRESS
            </p>
            <p style={{ margin: 0, fontSize: '13.5px', color: '#e2d9eb', lineHeight: 1.6 }}>
              Your team has successfully slain the Ender Dragon! The completion timestamp has been locked into the
              Mineverse ledger. Organizers will review and certify the official champions.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', marginTop: '24px', flexWrap: 'wrap' }}>
            <Link href="/round5" className="fb-btn fb-btn--secondary">
              <ArrowLeft size={16} /> RETURN TO ROUND 5
            </Link>
            <Link href="/dashboard" className="fb-btn fb-btn--strike">
              <Trophy size={16} /> DASHBOARD & RESULTS
            </Link>
          </div>
        </div>
      ) : isGated ? (
        /* ── STATE 3: PREREQUISITES GATED SCREEN ── */
        <div className="fb-card fb-gated-box">
          <div style={{ marginBottom: '14px', color: 'var(--fb-bad)' }}>
            <Lock size={44} style={{ margin: '0 auto' }} />
          </div>
          <h2 className="fb-gated-title">ACCESS DENIED</h2>
          <p style={{ fontSize: '14px', color: '#c5b8d2', lineHeight: 1.5, margin: '0 0 20px' }}>
            The Ender Dragon lair is sealed. Your team must fulfill all requirements before entering the final arena.
          </p>

          <ul className="fb-req-list">
            <li className="fb-req-item" data-met={String(portalRepaired)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {portalRepaired ? <Check size={18} style={{ color: '#6cdc8a' }} /> : <Lock size={18} style={{ color: '#ff6b6b' }} />}
                <span style={{ fontSize: '13.5px', fontWeight: 600 }}>Ancient Nether Portal Repaired</span>
              </span>
              {!portalRepaired && (
                <Link href="/portal" className="fb-btn fb-btn--secondary" style={{ padding: '6px 12px', fontSize: '9px' }}>
                  GO TO PORTAL
                </Link>
              )}
            </li>

            <li className="fb-req-item" data-met={String(diamondPickaxeCrafted)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {diamondPickaxeCrafted ? <Check size={18} style={{ color: '#6cdc8a' }} /> : <Lock size={18} style={{ color: '#ff6b6b' }} />}
                <span style={{ fontSize: '13.5px', fontWeight: 600 }}>Diamond Pickaxe Crafted (Round 5)</span>
              </span>
              {!diamondPickaxeCrafted && (
                <Link href="/round5" className="fb-btn fb-btn--secondary" style={{ padding: '6px 12px', fontSize: '9px' }}>
                  CRAFT IN ROUND 5
                </Link>
              )}
            </li>
          </ul>

          <Link href="/round5" className="fb-btn fb-btn--secondary" style={{ marginTop: '12px' }}>
            <ArrowLeft size={16} /> RETURN TO ROUND 5
          </Link>
        </div>
      ) : timeLeft > 0 && !inBattle ? (
        /* ── STATE 4: COOLDOWN COUNTDOWN SCREEN ── */
        <div className="fb-card fb-cooldown-card">
          <div style={{ color: 'var(--fb-bad)' }}>
            <ShieldAlert size={44} />
          </div>
          <h2 style={{ fontFamily: 'var(--fb-font-display)', fontSize: '22px', color: '#ff8e8e', margin: 0 }}>
            ATTACK DEFLECTED — ON COOLDOWN
          </h2>
          <p style={{ fontSize: '13.5px', color: '#d8cfe0', margin: 0, maxWidth: '480px' }}>
            The Ender Dragon was not defeated. Your team must regroup while the void energy stabilizes.
          </p>

          <div className="fb-timer-circle">
            <svg viewBox="0 0 140 140">
              <circle className="fb-timer-circle__track" cx="70" cy="70" r={radius} />
              <circle
                className="fb-timer-circle__val"
                cx="70"
                cy="70"
                r={radius}
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - cooldownPercent / 100)}
              />
            </svg>
            <div className="fb-timer-circle__center">
              <span className="fb-timer-time">{formatClock(timeLeft)}</span>
              <span className="fb-timer-label">COOLDOWN</span>
            </div>
          </div>

          <p style={{ fontSize: '12px', color: '#a89cb5', margin: 0 }}>
            The arena unlocks automatically once the timer expires.
          </p>

          <Link href="/round5" className="fb-btn fb-btn--secondary" style={{ marginTop: '8px' }}>
            <ArrowLeft size={16} /> RETURN TO ROUND 5
          </Link>
        </div>
      ) : !inBattle ? (
        /* ── STATE 5: IDLE READY TO CHALLENGE ── */
        <div className="fb-intro-layout">
          {/* Dragon Banner */}
          <div className="fb-dragon-banner">
            <img
              src="/round5/guardian-ender-dragon.jpg"
              alt="Ender Dragon"
              className="fb-dragon-banner__img"
            />
            <div className="fb-dragon-banner__scrim" />
            <div className="fb-dragon-banner__overlay">
              <div className="fb-dragon-banner__tag">
                <Flame size={13} style={{ display: 'inline', marginRight: '6px' }} /> THE CLIMAX OF MINEVERSE
              </div>
              <h2 className="fb-dragon-banner__name">FACE THE ENDER DRAGON</h2>
            </div>
          </div>

          {/* Battle Rules & Briefing */}
          <div className="fb-rules-grid">
            <div className="fb-rule-box">
              <h3 className="fb-rule-box__title">
                <Code2 size={15} /> 25 SEALED QUESTIONS
              </h3>
              <p className="fb-rule-box__desc">
                Twenty-five multiple-choice questions, drawn from the pack that decided the screening. Every one you
                answer correctly is a crystal shattered.
              </p>
            </div>

            <div className="fb-rule-box">
              <h3 className="fb-rule-box__title">
                <Shield size={15} /> ONE ATTEMPT
              </h3>
              <p className="fb-rule-box__desc">
                You get one attempt at the dragon. Every question you leave blank is marked wrong, so answer all of them before you strike.
              </p>
            </div>

            <div className="fb-rule-box">
              <h3 className="fb-rule-box__title">
                <Trophy size={15} /> FIRST TO SLAY WINS
              </h3>
              <p className="fb-rule-box__desc">
                Round 5 is ranked on the dragon and the seven questions together, with nothing weighted. Level on the
                count, the earlier finish here takes it.
              </p>
            </div>
          </div>

          {/* Challenge Action */}
          <button
            type="button"
            className="fb-btn fb-btn--boss-challenge"
            onClick={handleStartAttempt}
            disabled={attempting}
          >
            <Swords size={20} />
            {attempting ? 'ENTERING THE ARENA…' : '⚔️ CHALLENGE THE ENDER DRAGON'}
          </button>
        </div>
      ) : (
        /* ── STATE 6: ACTIVE BOSS BATTLE WORKSPACE ── */
        <div className="fb-battle-layout">
          {/* Main Question Column */}
          <div className="fb-card">
            {/* Question Selector Strip */}
            <div className="fb-q-tabs" role="tablist">
              {questions?.map((q, idx) => {
                const isFilled = answers[q.id] !== undefined;
                const isActive = idx === activeQuestionIndex;
                return (
                  <button
                    key={q.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`fb-q-tab ${isActive ? 'fb-q-tab--active' : ''}`}
                    data-filled={String(isFilled)}
                    onClick={() => setActiveQuestionIndex(idx)}
                  >
                    <span className="fb-q-tab__pip" />
                    Challenge #{idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Current Question View */}
            {currentQuestion && (
              <div>
                <div className="fb-q-head">
                  <div>
                    <h2 className="fb-q-title">
                      Challenge {activeQuestionIndex + 1} of {questions?.length}
                    </h2>
                    <span style={{ fontSize: '12px', color: '#a89bb8' }}>
                      {currentQuestion.title || `Problem Statement #${activeQuestionIndex + 1}`}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="fb-q-type-badge">MULTIPLE CHOICE</span>
                  </div>
                </div>

                {/* Formatted Prompt Blocks */}
                <div className="fb-prompt-container">
                  {promptBlocks(activePrompt).map((block, i) =>
                    block.kind === 'code' ? (
                      <pre key={i} className="fb-prompt-code">
                        <code>{block.body}</code>
                      </pre>
                    ) : (
                      <p key={i} className="fb-prompt-text">
                        {block.body}
                      </p>
                    )
                  )}
                </div>

                {/* The four choices. Centred, and the whole card is the target. */}
                <div className="fb-editor-wrap fb-choices">
                  <div className="fb-editor-label">
                    <span>
                      <Code2 size={13} style={{ display: 'inline', marginRight: '6px' }} /> CHOOSE ONE
                    </span>
                    <span style={{ fontSize: '9.5px', color: '#a498b3' }}>
                      {answers[currentQuestion.id] !== undefined ? 'ANSWERED' : 'UNANSWERED'}
                    </span>
                  </div>

                  <div className="fb-choice-list">
                    {(currentQuestion.options ?? []).map((option, optionIndex) => {
                      const chosen = answers[currentQuestion.id] === optionIndex;
                      return (
                        <button
                          key={optionIndex}
                          type="button"
                          className={`fb-choice${chosen ? ' fb-choice--on' : ''}`}
                          aria-pressed={chosen}
                          onClick={() =>
                            setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionIndex }))
                          }
                        >
                          <span className="fb-choice-key">{String.fromCharCode(65 + optionIndex)}</span>
                          <span className="fb-choice-text">{option}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Question Navigation Buttons */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '20px',
                    paddingTop: '16px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <button
                    type="button"
                    className="fb-btn fb-btn--secondary"
                    style={{ padding: '8px 16px', fontSize: '10px' }}
                    disabled={activeQuestionIndex === 0}
                    onClick={() => setActiveQuestionIndex((prev) => Math.max(0, prev - 1))}
                  >
                    <ChevronLeft size={14} /> PREVIOUS
                  </button>

                  <button
                    type="button"
                    className="fb-btn fb-btn--secondary"
                    style={{ padding: '8px 16px', fontSize: '10px' }}
                    disabled={activeQuestionIndex === (questions?.length || 1) - 1}
                    onClick={() =>
                      setActiveQuestionIndex((prev) => Math.min((questions?.length || 1) - 1, prev + 1))
                    }
                  >
                    NEXT <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar HUD */}
          <aside className="fb-sidebar">
            <div className="fb-card fb-sidecard">
              <h3 className="fb-sidecard__title">
                <Swords size={14} /> BATTLE PROGRESS
              </h3>

              <div className="fb-sidecard__pips">
                {questions?.map((q, idx) => {
                  const isFilled = answers[q.id] !== undefined;
                  const isActive = idx === activeQuestionIndex;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      className="fb-sidepip"
                      data-active={String(isActive)}
                      data-filled={String(isFilled)}
                      onClick={() => setActiveQuestionIndex(idx)}
                      title={`Go to Challenge #${idx + 1}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#c7bed1' }}>
                <strong style={{ color: '#6cdc8a' }}>{answeredCount}</strong> of{' '}
                <strong>{totalQuestions}</strong> challenges answered.
              </p>

              <div
                style={{
                  padding: '10px 12px',
                  background: 'rgba(255, 107, 107, 0.1)',
                  border: '1px solid rgba(255, 107, 107, 0.3)',
                  borderRadius: '2px',
                  fontSize: '11.5px',
                  color: '#ff9e9e',
                  lineHeight: 1.45,
                  marginBottom: '16px',
                }}
              >
                ⚠️ <strong>WARNING:</strong> One attempt only. Submitting ends the fight for good — you cannot come back to it.
              </div>

              <button
                type="button"
                className="fb-btn fb-btn--strike"
                style={{ width: '100%' }}
                onClick={handleSubmit}
                disabled={submitting || answeredCount === 0}
              >
                <Swords size={16} />
                {submitting ? 'STRIKING DRAGON…' : 'SUBMIT ATTACK'}
              </button>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
