'use client';

import { readDraft, writeDraft, readLanguage, writeLanguage, purgeForeignDrafts } from '@/lib/client/answer-drafts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  CloudRain,
  Code2,
  Flag,
  LockKeyhole,
  PanelRightClose,
  PanelRightOpen,
  Save,
  Swords,
  Trophy,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useProctorSession } from '@/components/game/proctor/ProctorProvider';
import { GuardianArena } from './GuardianArena';
import { NotificationTray, type LedgerEntry } from './NotificationTray';
import { WorldEvent } from './WorldEvent';
import { PvpPanel } from '../pvp/PvpPanel';
import { EndRail } from '@/components/day2/end-round/EndRail';
import { CodeWorkspace } from '@/components/game/code/CodeWorkspace';
import { defaultLanguageFor, offeredRuntimes, offersLanguage } from '@/lib/gameplay/code/runtimes';
import { useAnswerAutosave } from '@/hooks/useAnswerAutosave';
import type { CraftedItem, DashboardProgress } from '@/features/dashboard/types';
import { RESOURCE_META, buildQuestionTabs, languagePrompts, payoutList, promptBlocks, questionTypeLabel, roundChoice, roundChrome, roundCraft, roundGuardian, roundObjective, roundPvp, type ResourceKey, type ShellQuestion } from './round-presentation';
import './round-ui.css';
import { Hotbar } from '@/components/game/inventory/Hotbar';
import { MinecraftCraftingTable } from './MinecraftCraftingTable';

interface CustomRoundShellProps {
  roundId: number;
}

type Question = ShellQuestion;

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

const resourceMeta = RESOURCE_META;

/** Statuses the server will no longer accept a revision for. */
const FINAL_STATUSES = ['locked', 'graded', 'manual_review'];

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  return {
    hours: String(Math.floor(safeSeconds / 3600)).padStart(2, '0'),
    minutes: String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, '0'),
    seconds: String(safeSeconds % 60).padStart(2, '0'),
  };
}

function statusLabel(status: string | null) {
  if (!status) return 'Not started';
  if (status === 'submitted') return 'Saved';
  return status.replace(/_/g, ' ');
}

/** `content` carries the question body, but only a string is safe to render. */
function questionBody(question: Question, language: string | null) {
  const prompts = languagePrompts(question);
  if (prompts) {
    // Falls back to any language's body before the generic prompt: for a coding
    // question, another runtime's starter code still reads as the question,
    // where the generic prompt may not. Kept as this shell had it — every live
    // question carries all five runtimes, so it does not fire today.
    if (language && prompts[language]) return prompts[language];
    const first = Object.values(prompts)[0];
    if (first) return first;
  }
  return typeof question.content === 'string' && question.content.trim() ? question.content : question.prompt;
}

/** Prose stays prose; code goes into a real code block instead of one flat wall. */
function QuestionPrompt({ question, language }: { question: Question; language: string | null }) {
  return (
    <div className="round-ui__prompt-blocks">
      {promptBlocks(questionBody(question, language)).map((block, index) =>
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

export function CustomRoundShell({ roundId }: CustomRoundShellProps) {
  const router = useRouter();
  // Null when the proctor is switched off, or when this shell is rendered
  // outside a ProctorProvider — the round still works either way.
  const proctor = useProctorSession();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [resources, setResources] = useState<ResourcesData | null>(null);
  const [team, setTeam] = useState<TeamInfo | null>(null);
  // Round 5 needs to know what the team has crafted and how far Day 2 has got.
  // The dashboard snapshot already carries both, so no extra request.
  const [progress, setProgress] = useState<DashboardProgress | null>(null);
  // Which language the team picked, per question. This used to be assumed to be
  // the first option, so a team writing C++ was graded as Python.
  const [languages, setLanguages] = useState<Record<string, string>>({});
  /** The coding question currently open in the full-window editor. */
  const [codingId, setCodingId] = useState<string | null>(null);
  const [crafted, setCrafted] = useState<CraftedItem[]>([]);
  // Drafts are stored per team, so nothing is read or written until this lands.
  const teamCode = team?.team_code ?? null;
  const [history, setHistory] = useState<LedgerEntry[]>([]);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [roundStatus, setRoundStatus] = useState<string | null>(null);
  const [guardianUnlocked, setGuardianUnlocked] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState<Record<string, number>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [lockingSection, setLockingSection] = useState(false);
  const [confirmSection, setConfirmSection] = useState<string | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [crafting, setCrafting] = useState(false);
  const [craftingOpen, setCraftingOpen] = useState(false);
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
      setRoundStatus(roundResult.value.data.status ?? null);
      setGuardianUnlocked(roundResult.value.data.guardian_unlocked ?? false);
    } else {
      if (roundResult.status === 'fulfilled' && !roundResult.value.success) {
        const code = roundResult.value.error?.code;
        if (code === 'ROUND_NOT_ACTIVE' || code === 'ROUND_LOCKED') {
          toast.error('This round has been closed by an administrator.');
          await proctor?.finish();
          router.push('/dashboard');
          return;
        }
      }
      failed = true;
    }
    if (resourcesResult.status === 'fulfilled' && resourcesResult.value.success) {
      setResources(resourcesResult.value.data);
    } else {
      failed = true;
    }
    if (teamResult.status === 'fulfilled' && teamResult.value.success) {
      setTeam(teamResult.value.team ?? null);
      setProgress(teamResult.value.progress ?? null);
      setCrafted(teamResult.value.crafted ?? []);
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

  /**
   * Restore what this team had typed and picked — once, not on every poll.
   *
   * `refresh` runs every ten seconds and hands back a fresh `questions` array,
   * so depending on that array meant this effect re-ran on every tick and
   * *replaced* both pieces of state wholesale. Two things followed from that,
   * and both were reported as the round losing work:
   *
   *  - the language reset to the default every ten seconds, because the stored
   *    choice was checked against `language_options`, which is empty for most of
   *    the bank, so it never survived the check;
   *  - the drafts were overwritten from localStorage, which is empty whenever
   *    `teamCode` is null — and it was null for everyone while the dashboard was
   *    returning 403, so every answer typed was wiped on the next tick.
   *
   * Hydrating once per team and round fixes the clobber at its source. The ref
   * is the guard rather than a dependency list because `questions` legitimately
   * changes identity on every poll and we want exactly the first one.
   */
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!teamCode || questions.length === 0) return;

    const key = `${teamCode}:${roundId}`;
    if (hydratedFor.current === key) return;
    hydratedFor.current = key;

    // Clears anything left by a previous team on this machine before reading.
    purgeForeignDrafts(teamCode);

    const loaded: Record<string, string> = {};
    const loadedLanguages: Record<string, string> = {};
    for (const question of questions) {
      loaded[question.id] = readDraft(teamCode, roundId, question.id);
      const saved = readLanguage(teamCode, roundId, question.id);
      if (offersLanguage(question.language_options, saved)) loadedLanguages[question.id] = saved!;
    }

    setDrafts(loaded);
    setLanguages(loadedLanguages);
  }, [questions, roundId, teamCode]);

  // One tab per question type this round actually has, so Round 3's Debugging
  // questions stop being filed under "Aptitudes".
  const tabs = useMemo(() => buildQuestionTabs(questions), [questions]);
  const chrome = roundChrome(roundId);
  /**
   * Only a whole program gets the full-window editor. `code_completion` asks for
   * one expression to drop into a blank, and a judge UI around a single line is
   * more in the way than the field it replaces.
   */
  const usesEditor = (question: { type: string }) => question.type === 'coding';

  const codingQuestion = questions.find((question) => question.id === codingId) ?? null;

  const objective = roundObjective(roundId);
  const guardian = roundGuardian(roundId);
  const craft = roundCraft(roundId);
  const isPvp = roundPvp(roundId);
  const choice = roundChoice(roundId);

  // The tab set only exists once questions load, so the selection follows it.
  useEffect(() => {
    setActiveTab((current) => (current && tabs.some((tab) => tab.id === current) ? current : tabs[0]?.id ?? null));
  }, [tabs]);

  const activeTabEntry = tabs.find((tab) => tab.id === activeTab) ?? tabs[0] ?? null;
  const activeQuestions = activeTabEntry?.questions ?? [];
  const currentIndex = Math.min(questionIndex[activeTabEntry?.id ?? ''] ?? 0, Math.max(0, activeQuestions.length - 1));
  const currentQuestion = activeQuestions[currentIndex];
  const remainingSeconds = endsAt ? Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000)) : 0;
  const timer = formatDuration(remainingSeconds);
  const activeEvent = resources?.active_modifiers?.[0];
  const eventRemaining = activeEvent?.expires_at
    ? Math.max(0, Math.floor((new Date(activeEvent.expires_at).getTime() - now) / 1000))
    : null;
  const eventLive = Boolean(activeEvent) && (eventRemaining === null || eventRemaining > 0);
  const isRoundLocked = (remainingSeconds === 0 && Boolean(endsAt)) || roundStatus === 'completed' || roundStatus === 'locked';

  // What the round's own recipe costs, against what the team is holding.
  const craftShortfall = craft
    ? Object.entries(craft.cost)
        .map(([key, need]) => ({ key, short: need - (resources?.balance?.[key as ResourceKey] ?? 0) }))
        .filter((entry) => entry.short > 0)
    : [];
  const canCraft = Boolean(craft) && craftShortfall.length === 0;

  // A section is sealed once every question in it is past revising.
  const sectionLocked = activeQuestions.length > 0
    && activeQuestions.every((question) => FINAL_STATUSES.includes(question.submission_status ?? ''));
  const answeredInSection = activeQuestions.filter((question) => Boolean(question.submission_status)).length;
  const sectionReady = activeQuestions.length > 0 && answeredInSection === activeQuestions.length;
  const currentIsFinal = FINAL_STATUSES.includes(currentQuestion?.submission_status ?? '');
  const readOnly = isRoundLocked || currentIsFinal;

  /**
   * Nothing typed survives only on the device.
   *
   * Answers used to reach the server only when a team pressed Save, so a dead
   * battery or a clock that ran out took everything unsaved with it — and once
   * `ends_at` passes the submission endpoints refuse the round, so there is no
   * recovering it afterwards.
   */
  const autosave = useAnswerAutosave({
    drafts,
    enabled: !isRoundLocked,
    resolve: (questionId, text) => {
      const question = questions.find((entry) => entry.id === questionId);
      // A question already locked or graded cannot be revised, and a question
      // this round no longer serves is not ours to write.
      if (!question || FINAL_STATUSES.includes(question.submission_status ?? '')) return null;
      const isCode = question.type === 'coding' || question.type === 'code_completion';
      return isCode
        ? {
            question_id: questionId,
            code: text,
            language: languages[questionId] ?? defaultLanguageFor(question.language_options),
          }
        : { question_id: questionId, answer_text: text };
    },
  });

  // Moving off a question is the moment its answer is most likely finished, and
  // the moment a team stops looking at whether it saved.
  useEffect(() => {
    if (!currentQuestion) return;
    return () => { void autosave.flush(); };
    // Only the identity of the open question should trigger this, not the
    // flush closure, which changes on every draft edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id]);

  const changeDraft = (questionId: string, value: string) => {
    setDrafts((current) => ({ ...current, [questionId]: value }));
    writeDraft(teamCode, roundId, questionId, value);
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
      // The team's actual choice, falling back to the question's first option
      // only when it never made one.
      const chosen = languages[question.id] ?? defaultLanguageFor(question.language_options);
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isCode
            ? { question_id: question.id, code: answer, language: chosen }
            : { question_id: question.id, answer_text: answer },
        ),
      });
      const json = await response.json();
      if (!json.success) {
        toast.error(json.error?.message ?? 'Could not save. Your draft is still on this device.');
        return false;
      }
      autosave.markSynced(question.id, answer);
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
    if (!currentQuestion || !activeTabEntry) return;
    const saved = await saveAnswer(currentQuestion);
    if (saved && currentIndex < activeQuestions.length - 1) {
      setQuestionIndex((value) => ({ ...value, [activeTabEntry.id]: currentIndex + 1 }));
    }
  };

  const submitSection = async (tabId: string) => {
    const tab = tabs.find((entry) => entry.id === tabId);
    if (!tab) return;
    setLockingSection(true);
    try {
      const response = await fetch('/api/submissions/section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round_id: roundId, question_ids: tab.questions.map((question) => question.id) }),
      });
      const json = await response.json();
      if (!json.success) {
        toast.error(json.error?.message ?? 'Could not submit this section.');
        return;
      }
      toast.success(`${tab.label} submitted — these answers are final.`);
      setConfirmSection(null);
      await refresh();
    } catch {
      toast.error('Could not reach the server. The section was not submitted.');
    } finally {
      setLockingSection(false);
    }
  };

  const answeredIds = questions.filter((question) => Boolean(question.submission_status)).map((question) => question.id);
  const unansweredCount = questions.length - answeredIds.length;

  /** The answered set as the server sees it right now, not as of this render. */
  const answeredIdsFromServer = async (): Promise<string[]> => {
    try {
      const json = await fetch(`/api/rounds/${roundId}/questions`, { cache: 'no-store' }).then((res) => res.json());
      if (!json?.success) return answeredIds;
      return (json.data.questions ?? [])
        .filter((question: Question) => Boolean(question.submission_status))
        .map((question: Question) => question.id);
    } catch {
      return answeredIds;
    }
  };

  /**
   * Ends the round for this team: locks every answer they saved, then drops them
   * back on the main screen. Only answered questions are sent — the section endpoint
   * rejects a list containing an unanswered one, and a team that ran out of time
   * still needs a way to hand in what they did finish.
   */
  const finishRound = async () => {
    setFinishing(true);
    try {
      // Anything typed and not yet saved goes up before the section is locked,
      // or finishing would be the one action that discards work.
      await autosave.flush();
      // Re-read rather than trusting `answeredIds` from this render: the flush
      // above may have just created the submissions that make a question
      // answerable, and `refresh` cannot write into a closure already running.
      const ids = await answeredIdsFromServer();
      await refresh();
      if (ids.length > 0) {
        const response = await fetch('/api/submissions/section', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ round_id: roundId, question_ids: ids }),
        });
        const json = await response.json();
        if (!json.success) {
          toast.error(json.error?.message ?? 'Could not submit the round.');
          return;
        }
      }
      toast.success('Your final answers have been recorded.');
      setConfirmFinish(false);
      // Closes the proctor session and leaves fullscreen before navigating, so
      // the dashboard is not stuck behind a fullscreen scrim. Every way out of
      // a round lands there — it is where the next round is opened from.
      await proctor?.finish();
      router.push('/dashboard');
    } catch {
      toast.error('Could not reach the server. Nothing was submitted.');
    } finally {
      setFinishing(false);
    }
  };

  useEffect(() => {
    if (proctor?.flagged) {
      toast.error('You have been disqualified for violating proctor rules.');
      void finishRound();
    }
  }, [proctor?.flagged]);

  const craftRoundItem = async () => {
    if (!craft) return;
    setCrafting(true);
    try {
      const response = await fetch('/api/team/craft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ item: craft.item }),
      });
      const json = await response.json();
      if (!json.success) {
        toast.error(json.error?.message ?? `Unable to craft the ${craft.label}.`);
        return;
      }
      toast.success(
        craft.unlockRoundId
          ? `${craft.label} crafted — Round ${craft.unlockRoundId} is unlocked.`
          : `${craft.label} crafted.`,
      );
      await refresh();
    } catch {
      toast.error('Could not reach the server. Please try crafting again.');
    } finally {
      setCrafting(false);
    }
  };

  const setTab = (tab: string) => {
    setActiveTab(tab);
    setQuestionIndex((current) => ({ ...current, [tab]: 0 }));
  };

  return (
    <main className={`round-ui ${chrome.themeClass}`}>
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
            <chrome.Icon size={26} aria-hidden="true" />
            <div className="round-ui__biome-text">
              <p className="round-ui__eyebrow">{chrome.eyebrow}</p>
              <p className="round-ui__biome-name">{chrome.name}</p>
              <p className="round-ui__biome-meta">{chrome.day} <i>•</i> {chrome.mode}</p>
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

        {tabs.length > 0 && (
          <div className="round-ui__tabs" role="tablist" aria-label="Question categories">
            {tabs.map(({ id, label, Icon, questions: tabQuestions }) => {
              const locked = tabQuestions.every((question) => FINAL_STATUSES.includes(question.submission_status ?? ''));
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={activeTabEntry?.id === id}
                  className={activeTabEntry?.id === id ? 'round-ui__tab round-ui__tab--active' : 'round-ui__tab'}
                  onClick={() => setTab(id)}
                >
                  {locked ? <LockKeyhole size={15} aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}
                  {label}
                  <span className="round-ui__tab-count">{tabQuestions.length}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className={railOpen ? 'round-ui__main' : 'round-ui__main round-ui__main--railclosed'}>
          <section className="round-ui__board">
            <div className="round-ui__board-head">
              <div>
                <h1>{activeTabEntry?.label ?? chrome.name}</h1>
                <p>{objective ?? 'Solve the puzzle and earn resources.'}</p>
              </div>
              <div className="round-ui__pager">
                <span>{activeQuestions.length ? currentIndex + 1 : 0} / {activeQuestions.length}</span>
                <button
                  type="button"
                  aria-label="Previous question"
                  disabled={currentIndex === 0}
                  onClick={() => setQuestionIndex((value) => ({ ...value, [activeTabEntry!.id]: Math.max(0, currentIndex - 1) }))}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  aria-label="Next question"
                  disabled={currentIndex >= activeQuestions.length - 1}
                  onClick={() => setQuestionIndex((value) => ({ ...value, [activeTabEntry!.id]: Math.min(activeQuestions.length - 1, currentIndex + 1) }))}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            {/* Round 4 has no platform questions at all — its hour is the portal
                repair plus games run by volunteers in the hall. Saying so beats
                three empty tabs and a blank board. */}
            {tabs.length === 0 && (
              <div className="round-ui__tile round-ui__notice">
                <p className="round-ui__tile-title">No questions in this round</p>
                <p className="round-ui__notice-text">
                  {roundId === 4
                    ? 'This round is played in the hall. Volunteers run the games and an organizer credits whatever you earn — it shows up in your inventory below. Once you hold the Nether Core, a Portal Fragment and 15 Diamonds, repair the portal to unlock the final round.'
                    : 'Questions appear here the moment organizers publish them.'}
                </p>
              </div>
            )}

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
                      onClick={() => setQuestionIndex((value) => ({ ...value, [activeTabEntry!.id]: index }))}
                      className={selected ? 'round-ui__qitem round-ui__qitem--active' : 'round-ui__qitem'}
                    >
                      <b className="round-ui__qitem-no">{index + 1}</b>
                      <span className="round-ui__qitem-text">
                        {/* The prompt usually opens with a code block, so the seeded
                            title is what makes a readable list item. */}
                        <strong>{question.title || `Question ${index + 1}`}</strong>
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
                    <p className="round-ui__tile-title">
                      Question {currentIndex + 1}
                      <span className="round-ui__type-badge">{questionTypeLabel(currentQuestion.type)}</span>
                    </p>
                    {currentQuestion.title && <p className="round-ui__question-title">{currentQuestion.title}</p>}
                    {['coding', 'code_completion', 'debugging', 'debug_output', 'output'].includes(currentQuestion.type) && (
                      <div style={{ marginBottom: '16px' }}>
                        <select
                          style={{ width: 'auto', padding: '6px 12px', fontSize: '13px', display: 'inline-block', backgroundColor: 'rgba(0, 0, 0, 0.6)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '4px', cursor: 'pointer', appearance: 'auto', minHeight: 'auto', fontFamily: 'var(--rd-font-mono)' }}
                          value={languages[currentQuestion.id] ?? defaultLanguageFor(currentQuestion.language_options)}
                          onChange={(e) => {
                            setLanguages((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }));
                            writeLanguage(teamCode, roundId, currentQuestion.id, e.target.value);
                          }}
                          disabled={readOnly}
                        >
                          {offeredRuntimes(currentQuestion.language_options).map((rt) => (
                            <option key={rt.id} value={rt.id} style={{ backgroundColor: '#222', color: '#fff' }}>
                              {rt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <QuestionPrompt question={currentQuestion} language={languages[currentQuestion.id] ?? defaultLanguageFor(currentQuestion.language_options)} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label className="round-ui__field-label" style={{ margin: 0 }} htmlFor={`answer-${currentQuestion.id}`}>Your answer</label>
                    </div>
                    {usesEditor(currentQuestion) ? (
                      <>
                        {/* A program does not fit in this column, so the board
                            shows the first lines and the editor takes the window. */}
                        <pre className="round-ui__code-preview" aria-label="Your code so far">
                          {(drafts[currentQuestion.id] ?? '').split('\n').slice(0, 6).join('\n') || 'No code yet.'}
                        </pre>
                        <button
                          type="button"
                          className="round-ui__btn round-ui__btn--go round-ui__open-editor"
                          onClick={() => setCodingId(currentQuestion.id)}
                        >
                          <Code2 size={14} /> Open code editor
                        </button>
                      </>
                    ) : (
                      <textarea
                        id={`answer-${currentQuestion.id}`}
                        className="round-ui__field"
                        rows={4}
                        value={drafts[currentQuestion.id] ?? ''}
                        disabled={readOnly}
                        onChange={(event) => changeDraft(currentQuestion.id, event.target.value)}
                        placeholder={isRoundLocked ? 'The round has ended.' : currentIsFinal ? 'This answer is final.' : 'Type your answer here…'}
                      />
                    )}
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
                ) : (
                  <p className="round-ui__empty">No questions are currently available in this category.</p>
                )}
              </div>

              <aside className="round-ui__tile round-ui__rewards-tile">
                <p className="round-ui__tile-title">Rewards</p>
                {currentQuestion && payoutList(currentQuestion.pays).length > 0 ? (
                  <div className="round-ui__rewards">
                    {payoutList(currentQuestion.pays).map(({ key, icon, label, amount }) => (
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
                {stale ? 'Connection interrupted — showing last known progress.'
                  : sectionLocked ? <><LockKeyhole size={13} /> This section is submitted and final.</>
                  : isRoundLocked ? 'Round closed — answers are read-only.'
                  : <><b>{answeredInSection}</b> of <b>{activeQuestions.length}</b> saved in this section</>}
              </span>
              <div className="round-ui__section-actions">
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
                <button
                  type="button"
                  className="round-ui__btn round-ui__btn--finish"
                  disabled={finishing}
                  onClick={() => setConfirmFinish(true)}
                  title="Submit the whole round and go back to the main screen"
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
                art={chrome.eventArt ?? undefined}
                idleText={chrome.eventIdleText}
              />

              {guardian && guardianUnlocked && (
              <section className="round-ui__panel round-ui__card">
                <p className="round-ui__panel-title">
                  {guardian.label}
                  {guardian.mandatory && <span className="round-ui__type-badge">Required</span>}
                </p>
                {chrome.guardianArt && (
                  <div className="round-ui__art">
                    <img src={chrome.guardianArt} alt={guardian.label} />
                  </div>
                )}
                <p className="round-ui__card-text">Win for {guardian.rewardText}. Lose and it costs you {guardian.penaltyText}.</p>
                <button type="button" className="round-ui__cta" onClick={() => setGuardianOpen(true)}>
                  <Swords size={16} /> Challenge
                </button>
              </section>
              )}

              {isPvp && <PvpPanel />}

              {/* The End is the only round with a merchant and a boss. Both are
                  driven off the round catalog rather than a hardcoded id. */}
              {choice === 'end_merchant' && (
                <EndRail progress={progress} crafted={crafted} onTraded={() => void refresh()} />
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
              <Hotbar balance={resources?.balance} activeSlot={activeSlot} onSelect={setActiveSlot} crafted={crafted} />
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
            <h2>Submit {tabs.find((tab) => tab.id === confirmSection)?.label}?</h2>
            <p>
              All {tabs.find((tab) => tab.id === confirmSection)?.questions.length ?? 0} answers in this section are
              sent for grading and can no longer be changed. Other sections stay open.
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
            <h2>Finish {chrome.name}?</h2>
            <p>
              Your {answeredIds.length} saved {answeredIds.length === 1 ? 'answer' : 'answers'} are sent for grading and
              can no longer be changed.
              {unansweredCount > 0 && ` ${unansweredCount} question${unansweredCount === 1 ? '' : 's'} left unanswered will score nothing.`}
              {' '}You will be taken back to the main screen.
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

      {/* Full-window editor for the current coding question. Rendered last so it
          layers over the board without the board needing to know about it. */}
      {codingQuestion && (
        <CodeWorkspace
          question={codingQuestion}
          roundName={chrome.name}
          themeClass={chrome.themeClass}
          clock={`${timer.hours}:${timer.minutes}:${timer.seconds}`}
          clockWarning={remainingSeconds !== null && remainingSeconds <= 300}
          draft={drafts[codingQuestion.id] ?? ''}
          language={languages[codingQuestion.id] ?? null}
          locked={readOnly || FINAL_STATUSES.includes(codingQuestion.submission_status ?? '')}
          submitting={saving}
          onDraftChange={(value) => changeDraft(codingQuestion.id, value)}
          onLanguageChange={(next) => {
            setLanguages((current) => ({ ...current, [codingQuestion.id]: next }));
            writeLanguage(teamCode, roundId, codingQuestion.id, next);
          }}
          onSubmit={() => void saveAnswer(codingQuestion)}
          onClose={() => setCodingId(null)}
        />
      )}

      {guardianOpen && guardian && (
        <div className="round-ui__modal" role="dialog" aria-modal="true" aria-label={`${guardian.label} challenge`}>
          <div className="round-ui__modal-card">
            <button type="button" className="round-ui__modal-close" aria-label="Close guardian challenge" onClick={() => setGuardianOpen(false)}>
              <X size={18} />
            </button>
            <GuardianArena
              guardianName={guardian.name}
              roundId={roundId}
              art={chrome.guardianArt ?? undefined}
              reward={guardian.reward}
              penalty={guardian.penalty}
              mandatory={guardian.mandatory}
              timeLimitSeconds={guardian.timeLimitSeconds}
              onResolved={() => { void refresh(); }}
            />
          </div>
        </div>
      )}

      {craft && (
        <>
          <button
            type="button"
            className="mc-crafting-toggle-btn"
            onClick={() => setCraftingOpen(!craftingOpen)}
            title="Open Crafting Table"
          >
            <img src="/crafting.svg" alt="Crafting Table" />
          </button>
          {craftingOpen && (
            <div className="mc-crafting-popover">
              <button 
                className="mc-crafting-close" 
                onClick={() => setCraftingOpen(false)}
                title="Close"
              >×</button>
              <MinecraftCraftingTable
                craft={craft}
                canCraft={canCraft}
                crafting={crafting}
                craftShortfall={craftShortfall}
                onCraft={() => {
                  void craftRoundItem();
                  if (canCraft) setCraftingOpen(false);
                }}
              />
            </div>
          )}
        </>
      )}
    </main>
  );
}
