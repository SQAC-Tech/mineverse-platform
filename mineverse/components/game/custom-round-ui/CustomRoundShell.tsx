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
import { supabaseClient } from '@/lib/supabase/client';
import { GuardianArena } from './GuardianArena';
import { NotificationTray, type LedgerEntry } from './NotificationTray';
import { gradingMessage } from './grading-toast';
import { WorldEvent, EVENT_FX } from './WorldEvent';
import { PvpPanel } from '../pvp/PvpPanel';
import { EndRail } from '@/components/day2/end-round/EndRail';
import { CodeWorkspace } from '@/components/game/code/CodeWorkspace';
import { InspectorCard, usesInspector } from '@/components/game/code/InspectorCard';
import { defaultLanguageFor, offeredRuntimes, offersLanguage, resolveRuntime } from '@/lib/gameplay/code/runtimes';
import { starterFor, type FnContract, type LanguageId } from '@/lib/gameplay/code/contract';
import type { CodingEvaluation } from '@/components/game/code/CodeWorkspace';
import { useAnswerAutosave } from '@/hooks/useAnswerAutosave';
import type { CraftedItem, DashboardProgress } from '@/features/dashboard/types';
import { RESOURCE_META, buildQuestionTabs, languagePrompts, offersLanguageChoice, payoutList, promptBlocks, questionTypeLabel, roundChoice, roundChrome, roundCraft, roundGuardian, roundObjective, roundPvp, type ResourceKey, type ShellQuestion } from './round-presentation';
import './round-ui.css';
import { Hotbar } from '@/components/game/inventory/Hotbar';
import { RoundCraftPrompt } from './RoundCraftPrompt';

/**
 * What a coding question opens with.
 *
 * A question that declares a function contract gets the generated stub for the
 * chosen language — the signature and a comment, nothing else. The platform
 * writes `main`, the stdin parsing and the printing, so a team spends the round
 * on the problem rather than on boilerplate it is not being marked for.
 *
 * A question with no contract is still a whole program, and falls back to the
 * runtime's own template.
 */
function starterCodeFor(question: { fn_contract?: FnContract | null }, language: string): string {
  if (question.fn_contract) return starterFor(question.fn_contract, language as LanguageId);
  return resolveRuntime(language)?.starter ?? '';
}

/**
 * Whether the editor still holds boilerplate rather than the team's work.
 *
 * True for an empty buffer, for this question's generated stub in any offered
 * language, and for the old whole-program templates that predate the function
 * contracts — a team that opened a question last week has one of those saved,
 * and it would otherwise shadow the stub forever.
 *
 * Used to decide when it is safe to swap the buffer. Anything a team has
 * actually typed fails this test and is never replaced.
 */
function isPristine(question: { fn_contract?: FnContract | null; language_options?: string[] }, code: string): boolean {
  const trimmed = code.trim();
  if (!trimmed) return true;

  for (const runtime of offeredRuntimes(question.language_options)) {
    if (trimmed === starterCodeFor(question, runtime.id).trim()) return true;
    if (runtime.starter && trimmed === runtime.starter.trim()) return true;
  }
  return false;
}

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
  const [craftPrompt, setCraftPrompt] = useState(false);
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

  /**
   * Refetch the moment an admin unlocks the round or its boss.
   *
   * The dashboard has always listened on this channel; the round shells never
   * did, so once a team was inside a round the only way anything reached them
   * was the ten-second poll. That is why unlocking the boss appeared to need a
   * hard refresh.
   */
  useEffect(() => {
    const channel = supabaseClient
      .channel('round_status')
      .on('broadcast', { event: 'unlock' }, () => void refresh())
      .subscribe();
    return () => {
      void supabaseClient.removeChannel(channel);
    };
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
      const saved = question.submitted_language ?? readLanguage(teamCode, roundId, question.id);
      const persistedCode = question.submitted_code ?? '';
      const language = offersLanguage(question.language_options, saved)
        ? saved!
        : defaultLanguageFor(question.language_options);
      const restored = persistedCode || readDraft(teamCode, roundId, question.id);
      loaded[question.id] = question.type === 'coding' && isPristine(question, restored)
        ? starterCodeFor(question, language)
        : restored;
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

  /**
   * Questions that show code but are not answered with code.
   *
   * Debugging grades a line number, code completion one expression, debug
   * output the corrected output — none of them execute what is submitted. They
   * get a read-only listing with real line numbers and the answer box attached
   * to it, rather than a wall of pre-numbered text and a detached textarea.
   */
  const inspects = (question: ShellQuestion, language: string | null) =>
    usesInspector(question, questionBody(question, language));

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
  /* Only while the event is actually running — a lapsed window leaves the
     card in place but the sky should clear. */
  const eventFx = eventLive ? EVENT_FX[activeEvent?.event_key ?? ''] ?? null : null;
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
  /**
   * Every question answered. Nothing more.
   *
   * This also demanded that each coding question carry a completed evaluation,
   * which locked the button for every team on any section holding one: not a
   * single coding submission on this platform has ever reached that state, so
   * the gate was never passable rather than rarely.
   *
   * It was never needed for correctness either. Coding answers are marked after
   * the round by the admin grading run against the hidden tests, exactly like
   * every other question type — the in-editor evaluation is feedback for the
   * team, not the mark. Making feedback mandatory turned a judge outage, or
   * simply using Save, into a round a team could not hand in.
   */
  const sectionReady = activeQuestions.length > 0
    && activeQuestions.every((question) => Boolean(question.submission_status));

  /** Answered, but never run against the tests — worth nudging, not blocking. */
  const unevaluatedCoding = activeQuestions.filter(
    (question) => question.type === 'coding' && question.coding_evaluation?.status !== 'completed',
  ).length;
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

  const submitCoding = async (question: Question): Promise<CodingEvaluation | null> => {
    const code = drafts[question.id]?.trim() ?? '';
    if (!code) {
      toast.error('Write some code before submitting.');
      return null;
    }
    setSaving(true);
    try {
      // Drain any debounced draft write before saving the evaluated revision.
      // Otherwise a late autosave could replace the result summary with `{}`.
      await autosave.flush();
      const response = await fetch('/api/team/code/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: question.id,
          code,
          language: languages[question.id] ?? defaultLanguageFor(question.language_options),
        }),
      });
      const json = await response.json();
      const evaluation = json.data?.evaluation as CodingEvaluation | undefined;
      if (!json.success) {
        toast.error(json.error?.message ?? 'Could not submit your code.');
        // A runner outage still saved the code and the persisted result screen
        // explains that state without pretending evaluation happened.
        if (evaluation) {
          await refresh();
          return evaluation;
        }
        return null;
      }
      /**
       * Nail the evaluated code down before anything else can move.
       *
       * The server already holds it — `upsertTeamSubmission` runs before the
       * tests do — so a team that never presses Save cannot actually lose the
       * submission. This is the local half: mark it synced so the autosave
       * loop stops treating it as outstanding, and write it to this device so a
       * refresh restores the exact code that was judged rather than an earlier
       * keystroke.
       */
      autosave.markSynced(question.id, code);
      writeDraft(teamCode, roundId, question.id, code);

      if (evaluation?.status === 'completed' && evaluation.total_passed === evaluation.total_cases) {
        toast.success(`All ${evaluation.total_cases} tests passed — submission saved.`);
      }

      await refresh();
      return evaluation ?? null;
    } catch {
      toast.error('Could not reach the server. Your draft is saved on this device.');
      return null;
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
      const earned = gradingMessage(json.data?.grading);
      toast.success(`${tab.label} submitted — these answers are final.`, earned ? { description: earned } : undefined);
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
   * back on the dashboard. Only answered questions are sent — the section endpoint
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
      let earned: string | null = null;
      if (ids.length > 0) {
        const response = await fetch('/api/submissions/section', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // `finish` makes the server sweep the whole round rather than just
          // these ids, so a tab that was never handed in is still marked.
          body: JSON.stringify({ round_id: roundId, question_ids: ids, finish: true }),
        });
        const json = await response.json();
        if (!json.success) {
          toast.error(json.error?.message ?? 'Could not submit the round.');
          return;
        }
        earned = gradingMessage(json.data?.grading);
      }
      toast.success('Your final answers have been recorded.', earned ? { description: earned } : undefined);
      setConfirmFinish(false);

      /* One last thing before the dashboard: the round's own recipe. Crafting
         is session-scoped, not round-scoped, so a sealed paper does not stop
         it — which is what makes asking here possible at all. */
      if (craft) {
        await proctor?.finish();
        setCraftPrompt(true);
        return;
      }
      // Closes the proctor session and leaves fullscreen before navigating, so
      // the dashboard is not stuck behind a fullscreen scrim. Every way out of
      // a round lands there -- it is where the next round is opened from.
      //
      // `replace`, not `push`: the round is sealed, so leaving it on the history
      // stack means Back walks a team straight back into a paper they can no
      // longer answer. That is the round reappearing after it was handed in.
      await proctor?.finish();
      router.replace('/dashboard');
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
      {/* Between the artwork and the scrim, so the weather falls over the scene
          and the shade then dims both together. */}
      {eventFx && <div className={`round-ui__weather round-ui__weather--${eventFx}`} aria-hidden="true" />}
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
                        {/* A coding question that has been through the judge says
                            so. It read "Saved" — the same word a half-typed
                            draft shows — so a team that had submitted could not
                            tell the difference and assumed it had been lost. */}
                        <small>
                          {question.coding_evaluation?.status === 'completed'
                            ? `Submitted — ${question.coding_evaluation.total_passed}/${question.coding_evaluation.total_cases} passed`
                            : statusLabel(question.submission_status)}
                        </small>
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
                    {offersLanguageChoice(currentQuestion) && (
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
                    {inspects(currentQuestion, languages[currentQuestion.id] ?? defaultLanguageFor(currentQuestion.language_options)) ? (
                      /* Listing and answer in one card — see InspectorCard. */
                      <InspectorCard
                        type={currentQuestion.type}
                        prompt={questionBody(currentQuestion, languages[currentQuestion.id] ?? defaultLanguageFor(currentQuestion.language_options))}
                        value={drafts[currentQuestion.id] ?? ''}
                        disabled={readOnly}
                        language={languages[currentQuestion.id] ?? defaultLanguageFor(currentQuestion.language_options)}
                        onChange={(next) => changeDraft(currentQuestion.id, next)}
                      />
                    ) : (
                    <>
                    {/* A coding question shows its title, its code and its result
                        here and nothing else. The statement, the samples and the
                        rules are all one click away in the editor, and repeating
                        them in this column only reflowed them into something
                        less readable than the editor's own copy. */}
                    {!usesEditor(currentQuestion) && (
                      <>
                        <QuestionPrompt question={currentQuestion} language={languages[currentQuestion.id] ?? defaultLanguageFor(currentQuestion.language_options)} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <label className="round-ui__field-label" style={{ margin: 0 }} htmlFor={`answer-${currentQuestion.id}`}>Your answer</label>
                        </div>
                      </>
                    )}
                    {usesEditor(currentQuestion) ? (
                      <div className="rcard">
                        {currentQuestion.coding_evaluation && (
                          <div className="rcard__result">
                            <b className="rcard__badge">&#10003; SUBMITTED</b>
                            {currentQuestion.submitted_language && (
                              <span className="rcard__lang">{currentQuestion.submitted_language.toUpperCase()}</span>
                            )}
                            <span className="rcard__score">
                              {currentQuestion.coding_evaluation.status === 'completed'
                                ? `${currentQuestion.coding_evaluation.total_passed} / ${currentQuestion.coding_evaluation.total_cases} tests passed`
                                : 'Waiting for the code runner'}
                            </span>
                          </div>
                        )}

                        {/* The first lines only. A whole program does not fit in
                            this column, and the editor is one click away. */}
                        <pre className="round-ui__code-preview" aria-label="Your code so far">
                          {(drafts[currentQuestion.id] ?? '').split('\n').slice(0, 6).join('\n') || 'No code yet.'}
                        </pre>

                        <button
                          type="button"
                          className="round-ui__btn round-ui__btn--go round-ui__open-editor"
                          onClick={() => setCodingId(currentQuestion.id)}
                        >
                          <Code2 size={14} /> {currentQuestion.coding_evaluation ? 'View submitted code' : 'Open code editor'}
                        </button>
                      </div>
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
                    </>
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
                    title={
                      !sectionReady
                        ? 'Save every answer in this section first'
                        : unevaluatedCoding > 0
                          ? `${unevaluatedCoding} coding answer${unevaluatedCoding === 1 ? '' : 's'} never ran against the tests — you can still submit`
                          : 'Submit this section'
                    }
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

      {/* Full-window editor for the current coding question. Rendered last so it
          layers over the board without the board needing to know about it. */}
      {codingQuestion && (
        <CodeWorkspace
          question={codingQuestion}
          roundName={chrome.name}
          themeClass={chrome.themeClass}
          clock={endsAt ? `${timer.hours}:${timer.minutes}:${timer.seconds}` : 'NO DEADLINE'}
          clockWarning={Boolean(endsAt) && remainingSeconds <= 300}
          roundClosed={isRoundLocked}
          draft={drafts[codingQuestion.id] ?? ''}
          language={languages[codingQuestion.id] ?? null}
          locked={readOnly || FINAL_STATUSES.includes(codingQuestion.submission_status ?? '')}
          submitting={saving}
          onDraftChange={(value) => changeDraft(codingQuestion.id, value)}
          onLanguageChange={(next) => {
            setLanguages((current) => ({ ...current, [codingQuestion.id]: next }));
            writeLanguage(teamCode, roundId, codingQuestion.id, next);

            /* Swap the stub with the language, but never over real work. The
               editor used to keep whichever language's template it opened with
               until the page was reloaded, so picking Python left C++ on
               screen and the submission went up in the wrong language. */
            const current = drafts[codingQuestion.id] ?? '';
            if (isPristine(codingQuestion, current)) {
              changeDraft(codingQuestion.id, starterCodeFor(codingQuestion, next));
            }
          }}
          onSubmit={() => submitCoding(codingQuestion)}
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

      {/* The bench is no longer here. It spent the whole timed round competing
          with the questions, and a team could still finish having never opened
          it — then be stopped at the next biome by a pickaxe they never made.
          It is asked for on submit instead, in `RoundCraftPrompt`. */}
      {craftPrompt && craft && (
        <RoundCraftPrompt
          roundName={chrome.name}
          craft={craft}
          crafted={crafted.some((entry) => entry.item === craft.item && entry.crafted)}
          canCraft={canCraft}
          crafting={crafting}
          craftShortfall={craftShortfall}
          onCraft={() => void craftRoundItem()}
          onContinue={() => { setCraftPrompt(false); router.replace('/dashboard'); }}
        />
      )}
    </main>
  );
}
