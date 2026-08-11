'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Brain,
  ChevronLeft,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  Clock3,
  Code2,
  CloudRain,
  LockKeyhole,
  Save,
  Swords,
  TreePine,
  Trophy,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { GuardianArena } from './GuardianArena';
import { NotificationTray, type LedgerEntry } from './NotificationTray';
import { WorldEvent } from './WorldEvent';
import './round-ui.css';

type TabType = 'crosswords' | 'aptitudes' | 'output';
type ResourceKey = 'wood' | 'stone' | 'iron' | 'gold' | 'diamond' | 'emerald' | 'obsidian';

interface CustomRoundShellProps {
  roundId: number;
}

interface Question {
  id: string;
  type: string;
  prompt: string;
  content: unknown;
  order_index: number;
  submission_status: string | null;
  submission_revision: number | null;
  language_options?: string[];
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

const resourceMeta: Array<{ key: ResourceKey; label: string; icon: string }> = [
  { key: 'wood', label: 'Wood', icon: '/wood.svg' },
  { key: 'stone', label: 'Stone', icon: '/stone.svg' },
  { key: 'iron', label: 'Iron', icon: '/iron.svg' },
  { key: 'gold', label: 'Gold', icon: '/gold.svg' },
  { key: 'diamond', label: 'Diamond', icon: '/diamond.svg' },
  { key: 'emerald', label: 'Emerald', icon: '/emerald.svg' },
  { key: 'obsidian', label: 'Obsidian', icon: '/obsidian.svg' },
];

const tabMeta: Array<{ id: TabType; label: string; Icon: typeof BookOpen }> = [
  { id: 'crosswords', label: 'Crosswords', Icon: BookOpen },
  { id: 'aptitudes', label: 'Aptitudes', Icon: Brain },
  { id: 'output', label: 'Output prediction', Icon: Code2 },
];

/** Statuses the server will no longer accept a revision for. */
const FINAL_STATUSES = ['locked', 'graded', 'manual_review'];

function draftKey(roundId: number, questionId: string) {
  return `mineverse:round:${roundId}:question:${questionId}:draft`;
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  return {
    hours: String(Math.floor(safeSeconds / 3600)).padStart(2, '0'),
    minutes: String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, '0'),
    seconds: String(safeSeconds % 60).padStart(2, '0'),
  };
}

function questionTab(question: Question): TabType {
  if (question.type === 'crossword') return 'crosswords';
  if (question.type === 'coding' || question.type === 'code_completion' || question.type === 'output_prediction' || question.type === 'output') return 'output';
  return 'aptitudes';
}

function rewardFor(question: Question): Array<{ resource: ResourceKey; amount: number }> {
  if (questionTab(question) === 'crosswords') return [{ resource: 'wood', amount: 10 }];
  if (questionTab(question) === 'output') return [{ resource: 'wood', amount: 6 }, { resource: 'emerald', amount: 1 }];
  return [{ resource: 'wood', amount: 8 }, { resource: 'stone', amount: 5 }];
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

function initials(name: string | null | undefined) {
  if (!name) return 'MV';
  const words = name.trim().split(/\s+/).slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase() ?? '').join('') || 'MV';
}

export function CustomRoundShell({ roundId }: CustomRoundShellProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [resources, setResources] = useState<ResourcesData | null>(null);
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [history, setHistory] = useState<LedgerEntry[]>([]);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('crosswords');
  const [questionIndex, setQuestionIndex] = useState<Record<TabType, number>>({ crosswords: 0, aptitudes: 0, output: 0 });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [lockingSection, setLockingSection] = useState(false);
  const [confirmSection, setConfirmSection] = useState<TabType | null>(null);
  const [crafting, setCrafting] = useState(false);
  const [guardianOpen, setGuardianOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [activeSlot, setActiveSlot] = useState(1);
  const [now, setNow] = useState(() => Date.now());
  const [stale, setStale] = useState(false);

  const refresh = useCallback(async () => {
    const [roundResult, resourcesResult, teamResult, historyResult] = await Promise.allSettled([
      fetch(`/api/rounds/${roundId}/questions`, { cache: 'no-store' }).then((res) => res.json()),
      fetch('/api/team/resources', { cache: 'no-store' }).then((res) => res.json()),
      fetch('/api/dashboard/data', { cache: 'no-store' }).then((res) => res.json()),
      fetch('/api/team/resources/history?limit=12', { cache: 'no-store' }).then((res) => res.json()),
    ]);

    let failed = false;
    if (roundResult.status === 'fulfilled' && roundResult.value.success) {
      setQuestions(roundResult.value.data.questions ?? []);
      setEndsAt(roundResult.value.data.ends_at ?? null);
    } else {
      failed = true;
    }
    if (resourcesResult.status === 'fulfilled' && resourcesResult.value.success) {
      setResources(resourcesResult.value.data);
    } else {
      failed = true;
    }
    if (teamResult.status === 'fulfilled' && teamResult.value.success) {
      setTeam(teamResult.value.team ?? null);
    }
    if (historyResult.status === 'fulfilled' && historyResult.value.success) {
      setHistory(historyResult.value.data.entries ?? []);
    }
    setStale(failed);
  }, [roundId]);

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
    const selectHotbarSlot = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const slot = Number(event.key);
      if (slot >= 1 && slot <= 9) setActiveSlot(slot);
    };
    window.addEventListener('keydown', selectHotbarSlot);
    return () => window.removeEventListener('keydown', selectHotbarSlot);
  }, []);

  useEffect(() => {
    const loaded: Record<string, string> = {};
    for (const question of questions) {
      loaded[question.id] = window.localStorage.getItem(draftKey(roundId, question.id)) ?? '';
    }
    setDrafts(loaded);
  }, [questions, roundId]);

  const groupedQuestions = useMemo(() => {
    const groups: Record<TabType, Question[]> = { crosswords: [], aptitudes: [], output: [] };
    for (const question of questions) groups[questionTab(question)].push(question);
    for (const group of Object.values(groups)) group.sort((a, b) => a.order_index - b.order_index);
    return groups;
  }, [questions]);

  const activeQuestions = groupedQuestions[activeTab];
  const currentIndex = Math.min(questionIndex[activeTab], Math.max(0, activeQuestions.length - 1));
  const currentQuestion = activeQuestions[currentIndex];
  const remainingSeconds = endsAt ? Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000)) : 0;
  const timer = formatDuration(remainingSeconds);
  const activeEvent = resources?.active_modifiers?.[0];
  const eventRemaining = activeEvent?.expires_at
    ? Math.max(0, Math.floor((new Date(activeEvent.expires_at).getTime() - now) / 1000))
    : null;
  const eventLive = Boolean(activeEvent) && (eventRemaining === null || eventRemaining > 0);
  const isRoundLocked = remainingSeconds === 0 && Boolean(endsAt);
  const woodenRecipe = { item: 'wooden_pickaxe', label: 'Wooden Pickaxe', wood: 60 };
  const woodBalance = resources?.balance?.wood ?? 0;
  const enoughWood = woodBalance >= woodenRecipe.wood;

  // A section is sealed once every question in it is past revising.
  const sectionLocked = activeQuestions.length > 0
    && activeQuestions.every((question) => FINAL_STATUSES.includes(question.submission_status ?? ''));
  const answeredInSection = activeQuestions.filter((question) => Boolean(question.submission_status)).length;
  const sectionReady = activeQuestions.length > 0 && answeredInSection === activeQuestions.length;
  const currentIsFinal = FINAL_STATUSES.includes(currentQuestion?.submission_status ?? '');
  const readOnly = isRoundLocked || currentIsFinal;

  const changeDraft = (questionId: string, value: string) => {
    setDrafts((current) => ({ ...current, [questionId]: value }));
    window.localStorage.setItem(draftKey(roundId, questionId), value);
  };

  const saveAnswer = async (question: Question) => {
    const answer = drafts[question.id]?.trim() ?? '';
    if (!answer) {
      toast.error('Type an answer before saving.');
      return false;
    }

    setSaving(true);
    try {
      const isCode = question.type === 'coding' || question.type === 'code_completion';
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isCode
            ? { question_id: question.id, code: answer, language: question.language_options?.[0] ?? null }
            : { question_id: question.id, answer_text: answer },
        ),
      });
      const json = await response.json();
      if (!json.success) {
        toast.error(json.error?.message ?? 'Could not save. Your draft is still on this device.');
        return false;
      }
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
    if (!currentQuestion) return;
    const saved = await saveAnswer(currentQuestion);
    if (saved && currentIndex < activeQuestions.length - 1) {
      setQuestionIndex((value) => ({ ...value, [activeTab]: currentIndex + 1 }));
    }
  };

  const submitSection = async (tab: TabType) => {
    const sectionQuestions = groupedQuestions[tab];
    setLockingSection(true);
    try {
      const response = await fetch('/api/submissions/section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round_id: roundId, question_ids: sectionQuestions.map((question) => question.id) }),
      });
      const json = await response.json();
      if (!json.success) {
        toast.error(json.error?.message ?? 'Could not submit this section.');
        return;
      }
      toast.success(`${tabMeta.find((meta) => meta.id === tab)?.label} submitted — these answers are final.`);
      setConfirmSection(null);
      await refresh();
    } catch {
      toast.error('Could not reach the server. The section was not submitted.');
    } finally {
      setLockingSection(false);
    }
  };

  const craftWoodenPickaxe = async () => {
    setCrafting(true);
    try {
      const response = await fetch('/api/team/craft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ item: woodenRecipe.item }),
      });
      const json = await response.json();
      if (!json.success) {
        toast.error(json.error?.message ?? 'Unable to craft the Wooden Pickaxe.');
        return;
      }
      toast.success('Wooden Pickaxe crafted — Round 2 is unlocked.');
      await refresh();
    } catch {
      toast.error('Could not reach the server. Please try crafting again.');
    } finally {
      setCrafting(false);
    }
  };

  const setTab = (tab: TabType) => {
    setActiveTab(tab);
    setQuestionIndex((current) => ({ ...current, [tab]: 0 }));
  };

  return (
    <main className="round-ui round-ui--forest">
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
            <TreePine size={26} aria-hidden="true" />
            <div className="round-ui__biome-text">
              <p className="round-ui__eyebrow">ROUND {roundId}</p>
              <p className="round-ui__biome-name">Forest &amp; Grasslands</p>
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
              pendingGrading={Boolean(resources?.pending_grading)}
              storageKey={`mineverse:round:${roundId}:notifications:seen`}
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

        <div className="round-ui__tabs" role="tablist" aria-label="Question categories">
          {tabMeta.map(({ id, label, Icon }) => {
            const locked = groupedQuestions[id].length > 0
              && groupedQuestions[id].every((question) => FINAL_STATUSES.includes(question.submission_status ?? ''));
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                className={activeTab === id ? 'round-ui__tab round-ui__tab--active' : 'round-ui__tab'}
                onClick={() => setTab(id)}
              >
                {locked ? <LockKeyhole size={15} aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}
                {label}
                <span className="round-ui__tab-count">{groupedQuestions[id].length}</span>
              </button>
            );
          })}
        </div>

        <div className={railOpen ? 'round-ui__main' : 'round-ui__main round-ui__main--railclosed'}>
          <section className="round-ui__board">
            <div className="round-ui__board-head">
              <div>
                <h1>{tabMeta.find((tab) => tab.id === activeTab)?.label}</h1>
                <p>Solve the puzzle and earn resources.</p>
              </div>
              <div className="round-ui__pager">
                <span>{activeQuestions.length ? currentIndex + 1 : 0} / {activeQuestions.length}</span>
                <button
                  type="button"
                  aria-label="Previous question"
                  disabled={currentIndex === 0}
                  onClick={() => setQuestionIndex((value) => ({ ...value, [activeTab]: Math.max(0, currentIndex - 1) }))}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  aria-label="Next question"
                  disabled={currentIndex >= activeQuestions.length - 1}
                  onClick={() => setQuestionIndex((value) => ({ ...value, [activeTab]: Math.min(activeQuestions.length - 1, currentIndex + 1) }))}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            <div className="round-ui__board-grid">
              <aside className="round-ui__tile round-ui__qlist" aria-label="Questions in this category">
                <p className="round-ui__tile-title">Questions</p>
                {activeQuestions.length === 0 ? (
                  <p className="round-ui__empty">Questions appear here when they are released.</p>
                ) : activeQuestions.map((question, index) => {
                  const selected = index === currentIndex;
                  const locked = FINAL_STATUSES.includes(question.submission_status ?? '');
                  const stateClass = locked
                    ? 'round-ui__qitem-state round-ui__qitem-state--done'
                    : question.submission_status
                      ? 'round-ui__qitem-state round-ui__qitem-state--sent'
                      : 'round-ui__qitem-state';
                  return (
                    <button
                      key={question.id}
                      type="button"
                      onClick={() => setQuestionIndex((value) => ({ ...value, [activeTab]: index }))}
                      className={selected ? 'round-ui__qitem round-ui__qitem--active' : 'round-ui__qitem'}
                    >
                      <b className="round-ui__qitem-no">{index + 1}</b>
                      <span className="round-ui__qitem-text">
                        <strong>{question.prompt || `Question ${index + 1}`}</strong>
                        <small>{statusLabel(question.submission_status)}</small>
                      </span>
                      {locked
                        ? <LockKeyhole className="round-ui__qitem-lock" size={14} aria-label="Final answer" />
                        : <i className={stateClass} aria-hidden="true" />}
                    </button>
                  );
                })}
              </aside>

              <div className="round-ui__tile round-ui__answer">
                {currentQuestion ? (
                  <>
                    <p className="round-ui__tile-title">Question {currentIndex + 1}</p>
                    <p className="round-ui__prompt">{questionBody(currentQuestion)}</p>
                    <label className="round-ui__field-label" htmlFor={`answer-${currentQuestion.id}`}>Your answer</label>
                    <textarea
                      id={`answer-${currentQuestion.id}`}
                      className="round-ui__field"
                      rows={currentQuestion.type === 'coding' || currentQuestion.type === 'code_completion' ? 7 : 4}
                      value={drafts[currentQuestion.id] ?? ''}
                      disabled={readOnly}
                      onChange={(event) => changeDraft(currentQuestion.id, event.target.value)}
                      placeholder={isRoundLocked ? 'The round has ended.' : currentIsFinal ? 'This answer is final.' : 'Type your answer here…'}
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
                          onClick={() => void saveAnswer(currentQuestion)}
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
                      </div>
                    )}
                  </>
                ) : (
                  <p className="round-ui__empty">No questions are currently available in this category.</p>
                )}
              </div>

              <aside className="round-ui__tile round-ui__rewards-tile">
                <p className="round-ui__tile-title">Rewards</p>
                {currentQuestion ? (
                  <div className="round-ui__rewards">
                    {rewardFor(currentQuestion).map(({ resource, amount }) => {
                      const meta = resourceMeta.find((item) => item.key === resource)!;
                      return (
                        <div key={resource} className="round-ui__reward">
                          <img src={meta.icon} alt="" />
                          <b>+{amount}</b>
                          <span>{meta.label}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="round-ui__empty">Question rewards appear here.</p>}
                <p className="round-ui__reward-note">Awarded by the server once your answer is graded.</p>
              </aside>
            </div>

            <div className="round-ui__section-bar">
              <span className="round-ui__section-state">
                {stale ? 'Connection interrupted — showing last known progress.'
                  : sectionLocked ? <><LockKeyhole size={13} /> This section is submitted and final.</>
                  : isRoundLocked ? 'Round closed — answers are read-only.'
                  : <><b>{answeredInSection}</b> of <b>{activeQuestions.length}</b> saved in this section</>}
              </span>
              {!sectionLocked && !isRoundLocked && (
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
            </div>
          </section>

          {railOpen ? (
            <aside className="round-ui__rail">
              <WorldEvent
                event={activeEvent}
                remaining={eventRemaining}
                art="/round1/event-heavy-rain.webp"
                idleText="The forest is calm. Organizers announce world events."
              />

              <section className="round-ui__panel round-ui__card">
                <p className="round-ui__panel-title">Forest guardian</p>
                <div className="round-ui__art">
                  <img src="/round1/guardian-forest.webp" alt="Forest Guardian" />
                </div>
                <p className="round-ui__card-text">Win for +25 Wood, +10 Stone and +3 Emerald.</p>
                <button type="button" className="round-ui__cta" onClick={() => setGuardianOpen(true)}>
                  <Swords size={16} /> Challenge
                </button>
              </section>
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
              </span>
            </button>
          )}
        </div>

        <div className="round-ui__foot">
          <section className="round-ui__panel round-ui__inventory">
            <div className="round-ui__inventory-main">
              <div className="round-ui__inventory-head">
                <b>YOUR INVENTORY</b>
                <span>{resources?.pending_grading ? 'Rewards pending grading' : 'Live resource balance'}</span>
              </div>
              <div className="round-ui__hotbar" aria-label="Inventory hotbar">
                {Array.from({ length: 9 }).map((_, index) => {
                  const slot = index + 1;
                  const item = resourceMeta[index];
                  return (
                    <button
                      key={item?.key ?? `empty-${slot}`}
                      type="button"
                      title={item?.label ?? 'Empty slot'}
                      aria-label={item ? `${item.label}: ${resources?.balance?.[item.key] ?? 0}` : 'Empty inventory slot'}
                      className={activeSlot === slot ? 'round-ui__slot round-ui__slot--active' : 'round-ui__slot'}
                      onClick={() => setActiveSlot(slot)}
                    >
                      {item && <><img src={item.icon} alt="" /><b>{resources?.balance?.[item.key] ?? 0}</b></>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="round-ui__inventory-actions">
              <button type="button" className="round-ui__craft" disabled={!enoughWood || crafting} onClick={() => void craftWoodenPickaxe()}>
                <Trophy size={15} />
                {crafting ? 'Crafting…' : enoughWood ? 'Craft wooden pickaxe' : `Need ${woodenRecipe.wood - woodBalance} more wood`}
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
            <h2>Submit {tabMeta.find((meta) => meta.id === confirmSection)?.label}?</h2>
            <p>
              All {groupedQuestions[confirmSection].length} answers in this section are sent for grading and can no
              longer be changed. Other sections stay open.
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

      {guardianOpen && (
        <div className="round-ui__modal" role="dialog" aria-modal="true" aria-label="Forest Guardian challenge">
          <div className="round-ui__modal-card">
            <button type="button" className="round-ui__modal-close" aria-label="Close guardian challenge" onClick={() => setGuardianOpen(false)}>
              <X size={18} />
            </button>
            <GuardianArena
              guardianName="forest_guardian"
              roundId={roundId}
              art="/round1/guardian-forest.webp"
              reward="+25 Wood, +10 Stone, +3 Emerald"
              penalty="−8 Wood, −3 Stone"
              onResolved={() => { void refresh(); }}
            />
          </div>
        </div>
      )}
    </main>
  );
}
