'use client';

import { readDraft, writeDraft, purgeForeignDrafts } from '@/lib/client/answer-drafts';
import { runtimesFor } from '@/lib/gameplay/code/runtimes';
import { useAnswerAutosave } from '@/hooks/useAnswerAutosave';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Brain,
  ChevronLeft,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  Clock3,
  CloudRain,
  Flag,
  Hammer,
  Home,
  LockKeyhole,
  Pickaxe,
  Save,
  ScrollText,
  Shield,
  ShoppingBag,
  Sparkles,
  Swords,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useProctorSession } from '@/components/game/proctor/ProctorProvider';
import { CraftingPanel } from '@/components/game/crafting/CraftingPanel';
import { MarketplaceStore } from '@/components/game/marketplace/MarketplaceStore';
import { Hotbar } from '@/components/game/inventory/Hotbar';
import { ConsumableInventory } from '@/components/game/marketplace/ConsumableInventory';
import { ChoicePanel } from '@/components/game/choices/ChoicePanel';
import { GuardianArena } from './GuardianArena';
import { NotificationTray, type LedgerEntry } from './NotificationTray';
import { WorldEvent } from './WorldEvent';
import { payoutList, promptBlocks, questionTypeLabel, roundGuardian } from './round-presentation';
import './round-ui.css';

type CaveTab = 'aptitudes' | 'debugging' | 'completion' | 'output';
type ResourceKey = 'wood' | 'stone' | 'iron' | 'gold' | 'diamond' | 'emerald' | 'obsidian';
type ModalName = 'guardian' | 'crafting' | 'marketplace' | 'shrine' | null;

interface Question {
  id: string;
  type: string;
  title?: string;
  prompt: string;
  content: unknown;
  order_index: number;
  submission_status: string | null;
  language_options?: string[];
  /** What a correct answer pays, straight from the question row. */
  pays?: Record<string, number>;
}

interface ResourcesData {
  balance: Record<ResourceKey, number>;
  active_modifiers: Array<{
    event_key?: string;
    label?: string;
    modifier?: Record<string, number>;
    expires_at?: string | null;
  }>;
  pending_grading: boolean;
}

interface TeamInfo {
  team_name: string | null;
  team_code: string | null;
  team_size: number | null;
}

/** This shell is Round 2 only — see app/(game)/round2/page.tsx. */
const ROUND_ID = 2;

const resources: Array<{ key: ResourceKey; label: string; icon: string }> = [
  { key: 'wood', label: 'Wood', icon: '/wood.svg' },
  { key: 'stone', label: 'Stone', icon: '/stone.svg' },
  { key: 'iron', label: 'Iron', icon: '/iron.svg' },
  { key: 'gold', label: 'Gold', icon: '/gold.svg' },
  { key: 'diamond', label: 'Diamond', icon: '/diamond.svg' },
  { key: 'emerald', label: 'Emerald', icon: '/emerald.svg' },
  { key: 'obsidian', label: 'Obsidian', icon: '/obsidian.svg' },
];

const tabs: Array<{ id: CaveTab; label: string; Icon: typeof Brain }> = [
  { id: 'aptitudes', label: 'Aptitudes', Icon: Brain },
  { id: 'debugging', label: 'Debugging', Icon: Shield },
  { id: 'completion', label: 'Code completion', Icon: ScrollText },
  { id: 'output', label: 'Output prediction', Icon: Pickaxe },
];

/** Statuses the server will no longer accept a revision for. */
const FINAL_STATUSES = ['locked', 'graded', 'manual_review'];


function timeParts(seconds: number) {
  const value = Math.max(0, seconds);
  return {
    hours: String(Math.floor(value / 3600)).padStart(2, '0'),
    minutes: String(Math.floor((value % 3600) / 60)).padStart(2, '0'),
    seconds: String(value % 60).padStart(2, '0'),
  };
}

function tabFor(question: Question): CaveTab {
  if (question.type === 'debugging') return 'debugging';
  if (question.type === 'code_completion') return 'completion';
  if (question.type === 'output_prediction' || question.type === 'output' || question.type === 'coding') return 'output';
  return 'aptitudes';
}

function statusLabel(status: string | null) {
  if (!status) return 'Not started';
  if (status === 'submitted') return 'Saved';
  return status.replace(/_/g, ' ');
}

/** `content` carries the question body, but only a string is safe to render. */
function questionBody(question: Question) {
  return typeof question.content === 'string' && question.content.trim() ? question.content : question.prompt;
}

/** Prose stays prose; code goes into a real code block. */
function QuestionPrompt({ question }: { question: Question }) {
  return (
    <div className="round-ui__prompt-blocks">
      {promptBlocks(questionBody(question)).map((block, index) =>
        block.kind === 'code' ? (
          <pre key={index} className="round-ui__code"><code>{block.body}</code></pre>
        ) : (
          <p key={index} className="round-ui__prompt">{block.body}</p>
        ),
      )}
    </div>
  );
}

function initials(name: string | null | undefined) {
  if (!name) return 'MV';
  const words = name.trim().split(/\s+/).slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase() ?? '').join('') || 'MV';
}

const caveGuardian = roundGuardian(2);

export function CaveRoundShell() {
  const router = useRouter();
  // Null when the proctor is switched off, or when this shell is rendered
  // outside a ProctorProvider — the round still works either way.
  const proctor = useProctorSession();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [resourceData, setResourceData] = useState<ResourcesData | null>(null);
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const teamCode = team?.team_code ?? null;
  const [history, setHistory] = useState<LedgerEntry[]>([]);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CaveTab>('aptitudes');
  const [activeIndexes, setActiveIndexes] = useState<Record<CaveTab, number>>({ aptitudes: 0, debugging: 0, completion: 0, output: 0 });
  const [languages, setLanguages] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [lockingSection, setLockingSection] = useState(false);
  const [confirmSection, setConfirmSection] = useState<CaveTab | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [modal, setModal] = useState<ModalName>(null);
  const [railOpen, setRailOpen] = useState(true);
  const [slot, setSlot] = useState(1);
  const [now, setNow] = useState(() => Date.now());
  const [offline, setOffline] = useState(false);
  const [roundStatus, setRoundStatus] = useState<string | null>(null);
  const [guardianUnlocked, setGuardianUnlocked] = useState(false);

  const refresh = useCallback(async () => {
    const [round, resourceResult, teamResult, historyResult] = await Promise.allSettled([
      fetch('/api/rounds/2/questions', { cache: 'no-store' }).then((res) => res.json()),
      fetch('/api/team/resources', { cache: 'no-store' }).then((res) => res.json()),
      fetch('/api/dashboard/data', { cache: 'no-store' }).then((res) => res.json()),
      fetch('/api/team/resources/history?limit=12', { cache: 'no-store' }).then((res) => res.json()),
    ]);
    let requestFailed = false;
    if (round.status === 'fulfilled' && round.value.success) {
      setQuestions(round.value.data.questions ?? []);
      setEndsAt(round.value.data.ends_at ?? null);
      setRoundStatus(round.value.data.status ?? null);
      setGuardianUnlocked(round.value.data.guardian_unlocked ?? false);
    } else {
      // An organizer closing the round mid-play is not a network failure, and
      // showing "offline" for it leaves the team staring at a paper the server
      // has already stopped accepting. Same handling as the other biome rounds.
      if (round.status === 'fulfilled' && !round.value.success) {
        const code = round.value.error?.code;
        if (code === 'ROUND_NOT_ACTIVE' || code === 'ROUND_LOCKED') {
          toast.error('This round has been closed by an administrator.');
          await proctor?.finish();
          router.push('/dashboard');
          return;
        }
      }
      requestFailed = true;
    }
    if (resourceResult.status === 'fulfilled' && resourceResult.value.success) setResourceData(resourceResult.value.data);
    else requestFailed = true;
    if (teamResult.status === 'fulfilled' && teamResult.value.success) setTeam(teamResult.value.team ?? null);
    if (historyResult.status === 'fulfilled' && historyResult.value.success) setHistory(historyResult.value.data.entries ?? []);
    setOffline(requestFailed);
    // `proctor` and `router` are deliberately not dependencies. `useProctor`
    // returns a fresh object every render, so listing it would give `refresh` a
    // new identity each time and the 10s poll below — keyed on `refresh` — would
    // be torn down and rebuilt before it ever fired. Both are only touched on
    // the redirect path, where a render-old closure does the same thing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(poll);
  }, [refresh]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const selectSlot = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const number = Number(event.key);
      if (number >= 1 && number <= 9) setSlot(number);
    };
    window.addEventListener('keydown', selectSlot);
    return () => window.removeEventListener('keydown', selectSlot);
  }, []);

  useEffect(() => {
    // Clears anything left by a previous team on this machine before reading.
    purgeForeignDrafts(teamCode);
    const localDrafts: Record<string, string> = {};
    for (const question of questions) localDrafts[question.id] = readDraft(teamCode, ROUND_ID, question.id);
    setDrafts(localDrafts);
  }, [questions, teamCode]);

  const grouped = useMemo(() => {
    const result: Record<CaveTab, Question[]> = { aptitudes: [], debugging: [], completion: [], output: [] };
    for (const question of questions) result[tabFor(question)].push(question);
    for (const list of Object.values(result)) list.sort((a, b) => a.order_index - b.order_index);
    return result;
  }, [questions]);

  const activeQuestions = grouped[activeTab];
  const currentIndex = Math.min(activeIndexes[activeTab], Math.max(0, activeQuestions.length - 1));
  const question = activeQuestions[currentIndex];
  
  let activePrompt = question?.prompt ?? '';
  const currentLanguage = question ? (languages[question.id] ?? runtimesFor(question.language_options?.length ? question.language_options : ['python', 'cpp', 'java', 'javascript', 'c'])[0]?.id ?? 'python') : 'python';
  const contentObj = question?.content as any;
  if (contentObj && typeof contentObj === 'object' && contentObj.language_prompts) {
    if (typeof contentObj.language_prompts[currentLanguage] === 'string') {
      activePrompt = contentObj.language_prompts[currentLanguage];
    }
  }

  const timeLeft = endsAt ? Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000)) : 0;
  const timer = timeParts(timeLeft);
  // Closed by the clock or closed by an organizer; either way nothing more can
  // be written, and the autosave below reads this to stop trying.
  const roundLocked =
    (Boolean(endsAt) && timeLeft === 0) || roundStatus === 'completed' || roundStatus === 'locked';
  const activeEvent = resourceData?.active_modifiers?.[0];
  const eventRemaining = activeEvent?.expires_at
    ? Math.max(0, Math.floor((new Date(activeEvent.expires_at).getTime() - now) / 1000))
    : null;
  const eventLive = Boolean(activeEvent) && (eventRemaining === null || eventRemaining > 0);

  const sectionLocked = activeQuestions.length > 0
    && activeQuestions.every((item) => FINAL_STATUSES.includes(item.submission_status ?? ''));
  const answeredInSection = activeQuestions.filter((item) => Boolean(item.submission_status)).length;
  const sectionReady = activeQuestions.length > 0 && answeredInSection === activeQuestions.length;
  const currentIsFinal = FINAL_STATUSES.includes(question?.submission_status ?? '');
  const readOnly = roundLocked || currentIsFinal;

  /**
   * Nothing typed survives only on the device. Same reasoning as
   * `CustomRoundShell` — see `useAnswerAutosave`.
   */
  const autosave = useAnswerAutosave({
    drafts,
    enabled: !roundLocked,
    resolve: (questionId, text) => {
      const target = questions.find((entry) => entry.id === questionId);
      if (!target || FINAL_STATUSES.includes(target.submission_status ?? '')) return null;
      const isCode = target.type === 'coding' || target.type === 'code_completion';
      return isCode
        ? {
            question_id: questionId,
            code: text,
            language: runtimesFor(target.language_options)[0]?.id ?? null,
          }
        : { question_id: questionId, answer_text: text };
    },
  });

  // Moving off a question is the moment its answer is most likely finished.
  useEffect(() => {
    if (!question) return;
    return () => { void autosave.flush(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id]);

  const updateDraft = (questionId: string, value: string) => {
    setDrafts((current) => ({ ...current, [questionId]: value }));
    writeDraft(teamCode, ROUND_ID, questionId, value);
  };

  const saveAnswer = async (target: Question) => {
    const answer = drafts[target.id]?.trim() ?? '';
    if (!answer) {
      toast.error('Type an answer before saving.');
      return false;
    }
    setSaving(true);
    try {
      const codeQuestion = target.type === 'coding' || target.type === 'code_completion';
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(codeQuestion
          ? { question_id: target.id, code: answer, language: runtimesFor(target.language_options)[0]?.id ?? null }
          : { question_id: target.id, answer_text: answer }),
      });
      const data = await response.json();
      if (!data.success) {
        toast.error(data.error?.message ?? 'Could not save your answer.');
        return false;
      }
      autosave.markSynced(target.id, answer);
      toast.success('Answer saved. You can still revise it until you submit the section.');
      await refresh();
      return true;
    } catch {
      toast.error('Could not reach the server. Your draft is saved on this device.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveAndNext = async () => {
    if (!question) return;
    const saved = await saveAnswer(question);
    if (saved && currentIndex < activeQuestions.length - 1) {
      setActiveIndexes((state) => ({ ...state, [activeTab]: currentIndex + 1 }));
    }
  };

  const answeredIds = questions.filter((question) => Boolean(question.submission_status)).map((question) => question.id);
  const unansweredCount = questions.length - answeredIds.length;

  /** The answered set as the server sees it right now, not as of this render. */
  const answeredIdsFromServer = async (): Promise<string[]> => {
    try {
      const json = await fetch(`/api/rounds/${ROUND_ID}/questions`, { cache: 'no-store' }).then((res) => res.json());
      if (!json?.success) return answeredIds;
      return (json.data.questions ?? [])
        .filter((item: Question) => Boolean(item.submission_status))
        .map((item: Question) => item.id);
    } catch {
      return answeredIds;
    }
  };

  /**
   * Ends the round for this team: locks every answer they saved, then drops them
   * back on the dashboard. Only answered questions are sent — the section endpoint
   * rejects a list containing an unanswered one, and a team that ran out of time
   * still needs a way to hand in what they did finish.
   */
  const finishRound = async () => {
    setFinishing(true);
    try {
      // Anything typed and not yet saved goes up before the round is locked, or
      // finishing would be the one action that discards work.
      await autosave.flush();
      const ids = await answeredIdsFromServer();
      await refresh();
      if (ids.length > 0) {
        const response = await fetch('/api/submissions/section', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ round_id: ROUND_ID, question_ids: ids }),
        });
        const json = await response.json();
        if (!json.success) {
          toast.error(json.error?.message ?? 'Could not submit the round.');
          return;
        }
      }
      toast.success('Round submitted — your answers are final.');
      setConfirmFinish(false);
      // Closes the proctor session and leaves fullscreen before navigating, so
      // the dashboard is not stuck behind a fullscreen scrim.
      await proctor?.finish();
      router.push('/dashboard');
    } catch {
      toast.error('Could not reach the server. Nothing was submitted.');
    } finally {
      setFinishing(false);
    }
  };

  const submitSection = async (tab: CaveTab) => {
    setLockingSection(true);
    try {
      const response = await fetch('/api/submissions/section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round_id: 2, question_ids: grouped[tab].map((item) => item.id) }),
      });
      const data = await response.json();
      if (!data.success) {
        toast.error(data.error?.message ?? 'Could not submit this section.');
        return;
      }
      toast.success(`${tabs.find((meta) => meta.id === tab)?.label} submitted — these answers are final.`);
      setConfirmSection(null);
      await refresh();
    } catch {
      toast.error('Could not reach the server. The section was not submitted.');
    } finally {
      setLockingSection(false);
    }
  };

  return (
    <main className="round-ui round-ui--cave">
      <div className="round-ui__backdrop" aria-hidden="true" />
      <div className="round-ui__shade" aria-hidden="true" />

      <div className="round-ui__page">
        <header className="round-ui__header">
          <div className="round-ui__panel round-ui__panel--glass round-ui__brand">
            <img src="/logo.svg" alt="" />
            <div>
              <p className="round-ui__brand-name">MINEVERSE</p>
              <p className="round-ui__brand-tag">CODE. CRAFT. CONQUER.</p>
            </div>
          </div>

          <div className="round-ui__panel round-ui__panel--glass round-ui__biome">
            <Pickaxe size={26} aria-hidden="true" />
            <div className="round-ui__biome-text">
              <p className="round-ui__eyebrow">ROUND 2</p>
              <p className="round-ui__biome-name">Cave Biome</p>
              <p className="round-ui__biome-meta">Day 1 <i>•</i> Online</p>
            </div>
          </div>

          <div className="round-ui__panel round-ui__panel--glass round-ui__team">
            <span className="round-ui__team-crest" aria-hidden="true">{initials(team?.team_name)}</span>
            <div className="round-ui__team-text">
              <p className="round-ui__team-name">{team?.team_name ?? 'Your team'}</p>
              <p className="round-ui__team-code">{team?.team_code ?? '—'}</p>
            </div>
          </div>

          <div className="round-ui__panel round-ui__panel--glass round-ui__timer" aria-live="polite">
            <Clock3 size={24} aria-hidden="true" />
            <div>
              <p className="round-ui__timer-label">ROUND ENDS IN</p>
              <div className="round-ui__clock">
                <span className="round-ui__clock-unit"><b>{timer.hours}</b><small>HR</small></span>
                <span className="round-ui__clock-sep">:</span>
                <span className="round-ui__clock-unit"><b>{timer.minutes}</b><small>MIN</small></span>
                <span className="round-ui__clock-sep">:</span>
                <span className="round-ui__clock-unit"><b>{timer.seconds}</b><small>SEC</small></span>
              </div>
            </div>
          </div>

          <div className="round-ui__tools">
            <NotificationTray
              entries={history}
              pendingGrading={Boolean(resourceData?.pending_grading)}
              storageKey="mineverse:round:2:notifications:seen"
            />
            <button
              className="round-ui__panel round-ui__panel--glass round-ui__icon-btn"
              type="button"
              aria-label={railOpen ? 'Hide sidebar' : 'Show sidebar'}
              aria-expanded={railOpen}
              onClick={() => setRailOpen((open) => !open)}
            >
              {railOpen ? <PanelRightClose size={22} aria-hidden="true" /> : <PanelRightOpen size={22} aria-hidden="true" />}
            </button>
          </div>
        </header>

        <nav className="round-ui__tabs" aria-label="Round 2 question categories">
          {tabs.map(({ id, label, Icon }) => {
            const locked = grouped[id].length > 0
              && grouped[id].every((item) => FINAL_STATUSES.includes(item.submission_status ?? ''));
            return (
              <button
                key={id}
                type="button"
                className={activeTab === id ? 'round-ui__tab round-ui__tab--active' : 'round-ui__tab'}
                onClick={() => { setActiveTab(id); setActiveIndexes((current) => ({ ...current, [id]: 0 })); }}
              >
                {locked ? <LockKeyhole size={15} aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}
                {label}
                <span className="round-ui__tab-count">{grouped[id].length}</span>
              </button>
            );
          })}
        </nav>

        <div className={railOpen ? 'round-ui__main' : 'round-ui__main round-ui__main--railclosed'}>
          <section className="round-ui__board">
            <div className="round-ui__board-head">
              <div>
                <h1>{tabs.find((tab) => tab.id === activeTab)?.label}</h1>
                <p>Mine deep, solve smart, and collect cave resources.</p>
              </div>
              <div className="round-ui__pager">
                <span>{activeQuestions.length ? currentIndex + 1 : 0} / {activeQuestions.length}</span>
                <button
                  type="button"
                  aria-label="Previous question"
                  disabled={currentIndex === 0}
                  onClick={() => setActiveIndexes((state) => ({ ...state, [activeTab]: Math.max(0, currentIndex - 1) }))}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  aria-label="Next question"
                  disabled={currentIndex >= activeQuestions.length - 1}
                  onClick={() => setActiveIndexes((state) => ({ ...state, [activeTab]: Math.min(activeQuestions.length - 1, currentIndex + 1) }))}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            <div className="round-ui__board-grid">
              <aside className="round-ui__tile round-ui__qlist" aria-label="Questions in this category">
                <p className="round-ui__tile-title">Questions</p>
                {activeQuestions.length ? activeQuestions.map((item, index) => {
                  const itemLocked = FINAL_STATUSES.includes(item.submission_status ?? '');
                  const stateClass = itemLocked
                    ? 'round-ui__qitem-state round-ui__qitem-state--done'
                    : item.submission_status
                      ? 'round-ui__qitem-state round-ui__qitem-state--sent'
                      : 'round-ui__qitem-state';
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={currentIndex === index ? 'round-ui__qitem round-ui__qitem--active' : 'round-ui__qitem'}
                      onClick={() => setActiveIndexes((state) => ({ ...state, [activeTab]: index }))}
                    >
                      <b className="round-ui__qitem-no">{index + 1}</b>
                      <span className="round-ui__qitem-text">
                        <strong>{item.title || `Question ${index + 1}`}</strong>
                        <small>{statusLabel(item.submission_status)}</small>
                      </span>
                      {itemLocked
                        ? <LockKeyhole className="round-ui__qitem-lock" size={14} aria-label="Final answer" />
                        : <i className={stateClass} aria-hidden="true" />}
                    </button>
                  );
                }) : <p className="round-ui__empty">Questions appear here when organizers release them.</p>}
              </aside>

              <section className="round-ui__tile round-ui__answer">
                {question ? (
                  <>
                    <p className="round-ui__tile-title">
                      Question {currentIndex + 1}
                      <span className="round-ui__type-badge">{questionTypeLabel(question.type)}</span>
                    </p>
                    {question.title && <p className="round-ui__question-title">{question.title}</p>}
                    
                    {['coding', 'code_completion', 'debugging', 'debug_output', 'output'].includes(question.type) && (
                      <div style={{ marginBottom: '16px' }}>
                        <select
                          style={{ width: 'auto', padding: '6px 12px', fontSize: '13px', display: 'inline-block', backgroundColor: 'rgba(0, 0, 0, 0.6)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '4px', cursor: 'pointer', appearance: 'auto', minHeight: 'auto', fontFamily: 'var(--rd-font-mono)' }}
                          value={currentLanguage}
                          onChange={(e) => setLanguages((prev) => ({ ...prev, [question.id]: e.target.value }))}
                          disabled={readOnly}
                        >
                          {runtimesFor(question.language_options?.length ? question.language_options : ['python', 'cpp', 'java', 'javascript', 'c']).map((rt) => (
                            <option key={rt.id} value={rt.id}>{rt.label}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="round-ui__prompt-blocks">
                      {promptBlocks(activePrompt).map((block, index) =>
                        block.kind === 'code' ? (
                          <pre key={index} className="round-ui__code"><code>{block.body}</code></pre>
                        ) : (
                          <p key={index} className="round-ui__prompt">{block.body}</p>
                        ),
                      )}
                    </div>
                    
                    <label className="round-ui__field-label" htmlFor={`cave-answer-${question.id}`}>Your answer</label>
                    <textarea
                      id={`cave-answer-${question.id}`}
                      className="round-ui__field"
                      value={drafts[question.id] ?? ''}
                      onChange={(event) => updateDraft(question.id, event.target.value)}
                      disabled={readOnly}
                      rows={question.type === 'code_completion' ? 6 : 4}
                      placeholder={roundLocked ? 'The round has ended.' : currentIsFinal ? 'This answer is final.' : 'Type your answer here…'}
                    />
                    {currentIsFinal ? (
                      <p className="round-ui__locked-note">
                        <LockKeyhole size={14} aria-hidden="true" /> This answer is final and can no longer be changed.
                      </p>
                    ) : (
                      <div className="round-ui__actions">
                        <button
                          type="button"
                          className="round-ui__btn round-ui__btn--ghost"
                          onClick={() => void saveAnswer(question)}
                          disabled={saving || readOnly}
                        >
                          <Save size={14} /> {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          className="round-ui__btn round-ui__btn--go"
                          onClick={() => void saveAndNext()}
                          disabled={saving || readOnly}
                        >
                          Save &amp; next <ChevronRight size={14} />
                        </button>
                        <span
                          className="round-ui__autosave"
                          aria-live="polite"
                          title="Answers are sent to the server on their own — you do not have to press Save for your work to be kept."
                        >
                          {autosave.pending > 0
                            ? `${autosave.pending} not sent yet…`
                            : 'All answers saved'}
                        </span>
                      </div>
                    )}
                  </>
                ) : <p className="round-ui__empty">No questions are currently available in this category.</p>}
              </section>

              <aside className="round-ui__tile round-ui__rewards-tile">
                <p className="round-ui__tile-title">Rewards</p>
                {question && payoutList(question.pays).length > 0 ? (
                  <div className="round-ui__rewards">
                    {payoutList(question.pays).map(({ key, icon, label, amount }) => (
                      <div key={key} className="round-ui__reward">
                        <img src={icon} alt="" />
                        <b>+{amount}</b>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="round-ui__empty">Question rewards appear here.</p>}
                <p className="round-ui__reward-note">Awarded by the server once your answer is graded.</p>
              </aside>
            </div>

            <div className="round-ui__section-bar">
              <span className="round-ui__section-state">
                {offline ? 'Connection interrupted — showing last known progress.'
                  : sectionLocked ? <><LockKeyhole size={13} /> This section is submitted and final.</>
                  : roundLocked ? 'Round closed — answers are read-only.'
                  : <><b>{answeredInSection}</b> of <b>{activeQuestions.length}</b> saved in this section</>}
              </span>
              <div className="round-ui__section-actions">
                {!sectionLocked && !roundLocked && (
                  <button
                    type="button"
                    className="round-ui__btn round-ui__btn--lock"
                    disabled={!sectionReady || lockingSection}
                    onClick={() => setConfirmSection(activeTab)}
                    title={sectionReady ? 'Submit this section' : 'Save every answer in this section first'}
                  >
                    <LockKeyhole size={14} /> Submit section
                  </button>
                )}
                <button
                  type="button"
                  className="round-ui__btn round-ui__btn--finish"
                  disabled={finishing}
                  onClick={() => setConfirmFinish(true)}
                  title="Submit the whole round and go back to the dashboard"
                >
                  <Flag size={14} /> {finishing ? 'Submitting…' : 'Finish round'}
                </button>
              </div>
            </div>
          </section>

          {railOpen ? (
            <aside className="round-ui__rail">
              <WorldEvent
                event={activeEvent}
                remaining={eventRemaining}
                art="/round2/event-fertile-marsh.webp"
                idleText="The cave is quiet. Organizers announce world events."
              />

              {/* The boss is off until an organizer unlocks the round's toggle.
                  `startGuardianBattle` refuses a locked boss on the server too,
                  so this is the matching half rather than the whole gate. */}
              {guardianUnlocked && (
              <section className="round-ui__panel round-ui__card">
                <p className="round-ui__panel-title">Skeleton archer</p>
                <div className="round-ui__art">
                  <img src="/round2/guardian-skeleton-archer.webp" alt="Skeleton Archer" />
                </div>
                <p className="round-ui__card-text">Five questions in five minutes. Win all five for +20 Iron, +15 Stone, +3 Emerald.</p>
                <button type="button" className="round-ui__cta" onClick={() => setModal('guardian')}>
                  <Swords size={16} /> Challenge
                </button>
              </section>
              )}

            </aside>
          ) : (
            <button
              type="button"
              className="round-ui__handle"
              onClick={() => setRailOpen(true)}
              aria-label="Show sidebar"
              title="Show sidebar"
            >
              <PanelRightOpen size={18} />
              <span className="round-ui__handle-label">Sidebar</span>
              <span className="round-ui__handle-icons">
                <span className={eventLive ? 'round-ui__handle-icon round-ui__handle-icon--live' : 'round-ui__handle-icon'}>
                  <CloudRain size={17} />
                </span>
                <span className="round-ui__handle-icon"><Swords size={17} /></span>
                <span className="round-ui__handle-icon"><Home size={17} /></span>
              </span>
            </button>
          )}
        </div>

        <div className="round-ui__foot">
          <section className="round-ui__panel round-ui__inventory">
            <div className="round-ui__inventory-main">
              <div className="round-ui__inventory-head">
                <b>YOUR INVENTORY</b>
                <span>{resourceData?.pending_grading ? 'Rewards pending grading' : 'Live resource balance'}</span>
              </div>
              <Hotbar balance={resourceData?.balance} activeSlot={slot} onSelect={setSlot} />
            </div>
            <div className="round-ui__inventory-actions">
              <button
                type="button"
                className="mc-crafting-toggle-btn"
                onClick={() => setModal('crafting')}
                title="Open Crafting Table"
              >
                <img src="/crafting.svg" alt="Crafting Table" />
              </button>
              <button type="button" className="round-ui__craft round-ui__craft--alt" onClick={() => setModal('marketplace')}>
                <ShoppingBag size={15} /> Marketplace
              </button>
              <button type="button" className="round-ui__craft round-ui__craft--alt" onClick={() => setModal('shrine')}>
                <Sparkles size={15} /> Ancient shrine
              </button>
            </div>
          </section>

          <aside className="round-ui__panel round-ui__companion" aria-hidden="true">
            <video src="/stevevid.mp4" autoPlay loop muted playsInline />
          </aside>
        </div>
      </div>

      {confirmSection && (
        <div className="round-ui__modal" role="dialog" aria-modal="true" aria-label="Confirm section submit">
          <div className="round-ui__panel round-ui__confirm">
            <h2>Submit {tabs.find((meta) => meta.id === confirmSection)?.label}?</h2>
            <p>
              All {grouped[confirmSection].length} answers in this section are sent for grading and can no longer be
              changed. Other sections stay open.
            </p>
            <div className="round-ui__confirm-actions">
              <button type="button" className="round-ui__btn round-ui__btn--ghost" onClick={() => setConfirmSection(null)} disabled={lockingSection}>
                Cancel
              </button>
              <button type="button" className="round-ui__btn round-ui__btn--lock" onClick={() => void submitSection(confirmSection)} disabled={lockingSection}>
                {lockingSection ? 'Submitting…' : 'Submit and lock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmFinish && (
        <div className="round-ui__modal" role="dialog" aria-modal="true" aria-label="Confirm finish round">
          <div className="round-ui__panel round-ui__confirm">
            <h2>Finish Cave Biome?</h2>
            <p>
              Your {answeredIds.length} saved {answeredIds.length === 1 ? 'answer' : 'answers'} are sent for grading and
              can no longer be changed.
              {unansweredCount > 0 && ` ${unansweredCount} question${unansweredCount === 1 ? '' : 's'} left unanswered will score nothing.`}
              {' '}You will be taken back to the dashboard.
            </p>
            <div className="round-ui__confirm-actions">
              <button type="button" className="round-ui__btn round-ui__btn--ghost" onClick={() => setConfirmFinish(false)} disabled={finishing}>
                Keep playing
              </button>
              <button type="button" className="round-ui__btn round-ui__btn--finish" onClick={() => void finishRound()} disabled={finishing}>
                {finishing ? 'Submitting…' : 'Submit and leave'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="round-ui__modal" role="dialog" aria-modal="true">
          <div className="round-ui__modal-card biome">
            <button type="button" className="round-ui__modal-close" aria-label="Close" onClick={() => setModal(null)}>
              <X size={18} />
            </button>
            {modal === 'guardian' && (
              <GuardianArena
                guardianName="skeleton_archer"
                roundId={2}
                art="/round2/guardian-skeleton-archer.webp"
                // Straight from the guardian catalog the server pays from, so the
                // numbers here cannot drift out of step with the reward it applies.
                reward={caveGuardian?.reward ?? {}}
                penalty={caveGuardian?.penalty ?? {}}
                mandatory={caveGuardian?.mandatory}
                timeLimitSeconds={caveGuardian?.timeLimitSeconds}
                onResolved={() => { void refresh(); }}
              />
            )}
            {modal === 'crafting' && <CraftingPanel refreshToken={0} onCrafted={() => { void refresh(); }} />}
            {modal === 'marketplace' && (
              <>
                <MarketplaceStore refreshToken={0} onPurchased={() => { void refresh(); }} />
                <ConsumableInventory refreshToken={0} onUsed={() => { void refresh(); }} />
              </>
            )}
            {modal === 'shrine' && <ChoicePanel choiceKey="ancient_shrine" refreshToken={0} onDecided={() => { void refresh(); }} />}
          </div>
        </div>
      )}
    </main>
  );
}
