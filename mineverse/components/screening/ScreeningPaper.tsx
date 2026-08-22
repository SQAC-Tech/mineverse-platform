'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronRight, Home, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useProctorSession } from '@/components/game/proctor/ProctorProvider';
import { DEV_OPEN_SCREENING, GAUNTLET_PUZZLES } from '@/lib/screening/config';
import { GauntletTopBar } from './GauntletTopBar';
import { GatekeeperDialogueBox } from './GatekeeperDialogueBox';
import { InteractivePuzzleCanvas } from './InteractivePuzzleCanvas';
import { ArcadeInputTerminal } from './ArcadeInputTerminal';
import { ScreeningVideoBackground } from './ScreeningVideoBackground';
import { TypewriterPromptText } from './TypewriterPromptText';
import './screening-ui.css';

interface GauntletAttempt {
  attempt_id: string;
  deadline_at: string;
  seconds_remaining: number;
  current_step?: number;
  answers?: Record<number, string>;
  status: 'in_progress' | 'submitted' | 'expired';
  submitted_at: string | null;
  year?: number;
  word_assigned?: string;
  image_assigned?: string;
  code_snippets?: Record<string, string>;
}

const FINAL_VERDICT_TEXT = "You have successfully completed the screening round. Your timestamp has been noted. Results would be announced soon.";

export function ScreeningPaper({ initial }: { initial: GauntletAttempt }) {
  const router = useRouter();
  const proctor = useProctorSession();

  const [step, setStep] = useState<number>(initial.current_step || 1);
  const [answers, setAnswers] = useState<Record<number, string>>(initial.answers || {});
  const [inputVal, setInputVal] = useState<string>('');
  const [deadline] = useState(() => new Date(initial.deadline_at).getTime());
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState<boolean>(false);
  const [eyeState, setEyeState] = useState<'neutral' | 'glowing' | 'angry'>('neutral');
  const [selectedLang, setSelectedLang] = useState<string>('C++');
  const [puzzleStartTime, setPuzzleStartTime] = useState(() => Date.now());
  
  // Sequence & Video States
  const [videoCompleted, setVideoCompleted] = useState<boolean>(false);
  const [showOutroVideo, setShowOutroVideo] = useState<boolean>(false);
  const [outroEnded, setOutroEnded] = useState<boolean>(false);
  const [isFinalCompleted, setIsFinalCompleted] = useState<boolean>(
    initial.status === 'submitted' || initial.status === 'expired'
  );
  
  useEffect(() => {
    if (isFinalCompleted) {
      router.push('/');
    }
  }, [isFinalCompleted, router]);
  const [dialogueVisible, setDialogueVisible] = useState<boolean>(true);
  const [dialogueText, setDialogueText] = useState<string | null>(null);
  const [boardVisible, setBoardVisible] = useState<boolean>(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const submittedRef = useRef(false);
  const outroVideoRef = useRef<HTMLVideoElement>(null);

  const remaining = Math.max(0, Math.floor((deadline - now) / 1000));
  
  let currentPuzzle = GAUNTLET_PUZZLES.find((p) => p.id === step) || GAUNTLET_PUZZLES[0];
  
  // Dynamic replacement for Puzzle 1
  if (step === 1 && initial.word_assigned) {
    const wordUpper = initial.word_assigned.toUpperCase();
    if (initial.year && initial.year >= 2 && initial.code_snippets) {
      currentPuzzle = {
        ...currentPuzzle,
        title: "PUZZLE 1: The Code Oracle",
        prompt: `The Server Admins have discovered an ancient algorithm guarding the core memory chunk. Predict the exact numeric output (final_power) that this program will print to the console. The output is your numeric PIN.`
      };
    } else {
      currentPuzzle = {
        ...currentPuzzle,
        title: "PUZZLE 1: Crafting Combinatorics",
        prompt: `The Iron Golem is guarding the main arena with a combination lock. The numeric PIN is exactly the number of unique ways you can arrange the letters of the word ${wordUpper} such that all the vowels always remain clustered together in a single unbroken block. What is the PIN to open the iron doors?`
      };
    }
  }

  // Dynamic replacement for Puzzle 3
  if (step === 3 && initial.image_assigned) {
    const imageName = initial.image_assigned.replace(/\.[^/.]+$/, ""); // strip extension
    currentPuzzle = {
      ...currentPuzzle,
      prompt: `You hold a lamp forged in the ${imageName.toUpperCase()}, its eerie light revealing encrypted runes on the gate.\n\nThe Golem's voice echoes heavily:\n\n'The key lies in the origin of your light, but you must discard the physical vessel itself. Take only the two-word name of its home. Shift each letter of those words forward by the total number of characters they contain.'\n\nWhat is the final password?`
    };
  }

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(tick);
  }, []);

  const finish = useCallback(
    async (auto: boolean, disqualified: boolean = false) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      try {
        await fetch('/api/screening/attempt', { method: 'POST', keepalive: true });
      } catch {
        // Handled server side
      }
      await proctor?.finish();
      setIsFinalCompleted(true);
      if (disqualified) {
        toast.error('You have been disqualified for violating proctor rules.');
      } else {
        toast.success(FINAL_VERDICT_TEXT);
      }
      router.push('/');
    },
    [proctor, router],
  );

  useEffect(() => {
    if (remaining === 0 && !submittedRef.current && !isFinalCompleted) void finish(true);
  }, [remaining, finish, isFinalCompleted]);

  useEffect(() => {
    if (proctor?.flagged && !submittedRef.current && !isFinalCompleted) void finish(true, true);
  }, [proctor?.flagged, finish, isFinalCompleted]);

  useEffect(() => {
    if (showOutroVideo) {
      // Safety fallback timer: auto-reveal verdict after 5.5 seconds if video ends or stalls
      const timer = setTimeout(() => {
        setOutroEnded(true);
        if (proctor) void proctor.finish().catch(() => {});
        toast.success(FINAL_VERDICT_TEXT);
        router.push('/');
      }, 5500);
      return () => clearTimeout(timer);
    }
  }, [showOutroVideo, proctor, router]);

  const handleResetAttempt = async () => {
    setResetting(true);
    try {
      await fetch('/api/screening/reset', { method: 'POST' });
      window.location.href = '/screening?reset=1';
    } catch {
      window.location.href = '/screening?reset=1';
    }
  };

  const handleSubmitPuzzle = async (e?: React.FormEvent, overrideAnswer?: string, moves?: number) => {
    if (e) e.preventDefault();
    const valueToSubmit = (overrideAnswer || inputVal).trim();
    if (!valueToSubmit || loading || submittedRef.current) return;

    setLoading(true);
    setEyeState('glowing');
    setErrorMsg(null);
    setSuccessMsg(null);

    const durationSeconds = Math.floor((Date.now() - puzzleStartTime) / 1000);

    try {
      const res = await fetch('/api/screening/attempt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          puzzle_id: step,
          answer: valueToSubmit,
          duration_seconds: durationSeconds,
          moves: moves,
        }),
      });

      const json = await res.json();

      if (!json.success) {
        if (json.error?.code === 'TIME_UP') {
          void finish(true);
          return;
        }
        // Wrong answer
        const errStr = json.error?.message || currentPuzzle.errorMessage;
        setEyeState('angry');
        setErrorMsg(errStr);
        setDialogueText(errStr);
        setDialogueVisible(true);
        setLoading(false);
        setTimeout(() => {
          setEyeState('neutral');
          setDialogueVisible(false);
        }, 3500);
        return;
      }

      // Success!
      const data = json.data;
      const succStr = data.message || currentPuzzle.successMessage;
      setAnswers((prev) => ({ ...prev, [step]: inputVal.trim() }));
      setEyeState('glowing');
      setSuccessMsg(succStr);
      setDialogueText(succStr);
      setDialogueVisible(true);
      setInputVal('');

      if (data.completed || data.current_step > 3) {
        // All 3 Puzzles Solved! Trigger Outro Video After_screening.mp4 at 1.5x speed!
        setTimeout(() => {
          setShowOutroVideo(true);
        }, 1200);
      } else {
        setTimeout(() => {
          setStep(data.current_step);
          setPuzzleStartTime(Date.now());
          setEyeState('neutral');
          setSuccessMsg(null);
          setDialogueText(null);
          setDialogueVisible(false);
          setLoading(false);
        }, 1500);
      }
    } catch {
      setEyeState('angry');
      const errStr = 'Network error while validating answer. Please check your connection.';
      setErrorMsg(errStr);
      setDialogueText(errStr);
      setDialogueVisible(true);
      setLoading(false);
      setTimeout(() => {
        setEyeState('neutral');
        setDialogueVisible(false);
      }, 3500);
    }
  };

  /* STEP A: INTRO VIDEO PLAYING */
  if (!videoCompleted && !isFinalCompleted) {
    return (
      <div className="fixed inset-0 w-full h-full bg-stone-950 overflow-hidden select-none">
        <ScreeningVideoBackground
          playbackRate={1.5}
          onVideoComplete={() => {
            setVideoCompleted(true);
            setDialogueVisible(true);
          }}
        />
      </div>
    );
  }



  /* STEP D: OUTRO VIDEO PLAYING UPON COMPLETING ALL 3 PUZZLES (After_screening.mp4 at 1.5x speed) */
  if (showOutroVideo) {
    return (
      <div className="fixed inset-0 w-full h-full bg-stone-950 overflow-hidden select-none z-50 flex flex-col justify-between">
        {/* OUTRO VIDEO (Freezes on last frame upon completion) */}
        <video
          ref={outroVideoRef}
          autoPlay
          muted
          playsInline
          onPlay={() => {
            if (outroVideoRef.current) outroVideoRef.current.playbackRate = 1.5;
          }}
          onLoadedMetadata={() => {
            if (outroVideoRef.current) outroVideoRef.current.playbackRate = 1.5;
          }}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (v.duration > 0 && v.currentTime >= v.duration - 0.4 && !outroEnded) {
              setOutroEnded(true);
              if (proctor) void proctor.finish().catch(() => {});
              toast.success(FINAL_VERDICT_TEXT);
              router.push('/');
            }
          }}
          onEnded={() => {
            if (!outroEnded) {
              setOutroEnded(true);
              if (proctor) void proctor.finish().catch(() => {});
              toast.success(FINAL_VERDICT_TEXT);
              router.push('/');
            }
          }}
          onError={() => {
            if (!outroEnded) {
              setOutroEnded(true);
              toast.success(FINAL_VERDICT_TEXT);
              router.push('/');
            }
          }}
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/After_screening.mp4" type="video/mp4" />
          <source src="/after screening.mp4" type="video/mp4" />
        </video>

        {/* TOP SKIP BUTTON IF USER WANTS TO SEE VERDICT IMMEDIATELY */}
        {!outroEnded && (
          <div className="relative z-30 p-4 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setOutroEnded(true);
                if (proctor) void proctor.finish().catch(() => {});
                toast.success(FINAL_VERDICT_TEXT);
                router.push('/');
              }}
              className="bg-stone-900/90 hover:bg-stone-800 border border-amber-500/60 text-amber-300 font-mono text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xl cursor-pointer backdrop-blur"
            >
              <span>SKIP VIDEO &gt;</span>
            </button>
          </div>
        )}

        {/* OVERLAY ON TOP OF LAST FRAME WHEN VIDEO ENDS */}
        {outroEnded && (
          <div className="relative z-20 h-full w-full flex flex-col justify-between p-4 bg-stone-950/75 backdrop-blur-md animate-in fade-in duration-500">
            <GauntletTopBar remainingSeconds={0} />

            <main className="flex-1 max-w-xl w-full mx-auto p-4 flex flex-col items-center justify-center relative z-30">
              <div className="bg-stone-900/95 border-2 border-stone-800 rounded-2xl p-5 sm:p-6 shadow-2xl backdrop-blur relative overflow-hidden select-none w-full animate-in fade-in zoom-in-95 duration-500">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-600 via-amber-500 to-emerald-600" />

                {/* HEADER */}
                <div className="flex items-center justify-between border-b border-stone-800 pb-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs uppercase tracking-widest text-emerald-400 font-extrabold flex items-center gap-1.5">
                      <span className="text-emerald-400 animate-pulse">✨</span> THE GATEKEEPER SPEAKS
                    </span>
                  </div>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-stone-950 border border-stone-800 text-amber-400 font-bold">
                    TRIALS COMPLETE
                  </span>
                </div>

                {/* INNER DIALOGUE BOX */}
                <div className="bg-stone-950/90 border border-stone-800 rounded-xl p-4 font-mono text-xs text-zinc-200 leading-relaxed shadow-inner flex flex-col gap-2 mb-5">
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[10px] uppercase tracking-widest pb-1 border-b border-stone-900">
                    <span>&gt;_ GOLEM VERDICT & MESSAGE LOG</span>
                  </div>

                  <p className={`${proctor?.flagged ? 'text-red-500' : 'text-emerald-400'} font-bold text-xs sm:text-sm leading-relaxed tracking-wide my-1`}>
                    "{proctor?.flagged ? 'You have been disqualified for violating proctor rules.' : FINAL_VERDICT_TEXT}"
                  </p>
                </div>

                {/* ACTION BUTTONS: RETURN TO MAIN SCREEN & RE-TEST */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => router.push('/')}
                    className="w-full sm:flex-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-stone-950 font-mono font-black py-3 px-4 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] text-xs flex items-center justify-center gap-2 cursor-pointer uppercase tracking-widest"
                  >
                    <Home className="w-4 h-4 text-stone-950" />
                    <span>RETURN TO MAIN SCREEN</span>
                  </button>

                  {/* Dev only. The screening is sat once; in production a
                      reset is an organizer action in the admin panel, where it
                      is attributable. */}
                  {DEV_OPEN_SCREENING && (
                    <button
                      type="button"
                      onClick={handleResetAttempt}
                      disabled={resetting}
                      className="w-full sm:flex-1 bg-stone-950 hover:bg-stone-800 border border-stone-700 text-purple-300 font-mono font-bold py-3 px-4 rounded-xl transition-all text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 text-purple-400 ${resetting ? 'animate-spin' : ''}`} />
                      <span>RE-TEST SCREENING (DEV)</span>
                    </button>
                  )}
                </div>
              </div>
            </main>
          </div>
        )}
      </div>
    );
  }

  /* STEP E: FINAL COMPLETION VERDICT DISPLAYED IN-PAGE MATCHING GATEKEEPER CARD DESIGN */
  if (isFinalCompleted) {
    return (
      <div className="h-screen w-screen max-h-screen bg-stone-950 flex flex-col justify-center items-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
        <p className="text-emerald-400 font-mono uppercase tracking-widest text-sm">Redirecting to home...</p>
      </div>
    );
  }

  /* STEP B & C: POST-VIDEO SEQUENTIAL ENTRANCE FLOW */
  return (
    <div className="h-screen w-screen max-h-screen max-w-vw bg-stone-950 text-zinc-100 font-sans select-none flex flex-col justify-between overflow-hidden relative">
      {/* BACKGROUND VIDEO */}
      <ScreeningVideoBackground
        playbackRate={1.5}
        onVideoComplete={() => setVideoCompleted(true)}
      />

      {/* MINIMAL TOP BAR */}
      <GauntletTopBar remainingSeconds={remaining} />

      {/* MAIN SINGLE-FRAME 2-COLUMN OVERLAY CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-2.5 sm:p-3.5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch relative z-10 overflow-hidden">
        {/* LEFT COLUMN: GATEKEEPER DIALOGUE */}
        <div className="lg:col-span-5 flex flex-col justify-end overflow-hidden pointer-events-none">
          <GatekeeperDialogueBox
            step={step}
            eyeState={eyeState}
            customMessage={dialogueText}
            isVisible={dialogueVisible}
            onSpeechComplete={() => {
              if (!dialogueText && !boardVisible) {
                setTimeout(() => {
                  setDialogueVisible(false);
                  setBoardVisible(true);
                }, 400);
              }
            }}
          />
        </div>

        {/* RIGHT COLUMN: CARVED WOODEN QUEST BOARD (SHIFTED FAR-RIGHT) */}
        <div className="lg:col-span-6 lg:col-start-7 mr-2 sm:mr-6 ml-auto max-w-xl w-full flex flex-col justify-between overflow-hidden">
          {!boardVisible ? (
            <div className="h-full flex items-center justify-end pr-2">
              <button
                type="button"
                onClick={() => {
                  setDialogueVisible(false);
                  setBoardVisible(true);
                }}
                className="bg-stone-900/90 hover:bg-stone-800 border border-stone-700 text-amber-300 font-mono text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-2xl cursor-pointer backdrop-blur animate-pulse"
              >
                <span>SKIP SPEECH & OPEN BOARD</span>
                <ChevronRight className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          ) : (
            <div className="h-full flex flex-col justify-between bg-[#1a0f07] border-4 border-[#6b4226] rounded-2xl p-3 sm:p-4 shadow-[0_15px_40px_rgba(0,0,0,0.95)] relative overflow-hidden backdrop-blur-md animate-in fade-in slide-in-from-right-10 duration-700 max-h-[calc(100vh-65px)]">
              {/* Metallic Corner Rivets */}
              <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t-2 border-l-2 border-amber-600/80 pointer-events-none" />
              <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-amber-600/80 pointer-events-none" />
              <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b-2 border-l-2 border-amber-600/80 pointer-events-none" />
              <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 border-amber-600/80 pointer-events-none" />

              {/* Wooden Beam Accent */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#4a2b16] via-[#854d27] to-[#4a2b16] border-b border-[#2d180b]" />

              {/* BOARD HEADER & PROGRESS PEGS */}
              <div className="flex-1 flex flex-col justify-between overflow-hidden">
                <div className="flex items-center justify-between border-b border-[#4d2a15] pb-2 mb-2 bg-[#26150a]/90 -mx-3 sm:-mx-4 -mt-3 sm:-mt-4 p-3 rounded-t-xl">
                  <div>
                    <span className="font-mono text-[10px] uppercase font-bold text-amber-400 tracking-widest">
                      QUEST PROGRESS • STAGE {step} OF 3
                    </span>
                    <h2 className="font-mono text-sm sm:text-base font-black text-amber-100 uppercase tracking-wide">
                      {currentPuzzle.title}
                    </h2>
                  </div>

                  {/* Wooden Peg Indicators */}
                  <div className="flex items-center gap-1.5">
                    {GAUNTLET_PUZZLES.map((p) => {
                      const isDone = step > p.id;
                      const isCurrent = step === p.id;
                      return (
                        <div
                          key={p.id}
                          className={`w-6 h-6 rounded border flex items-center justify-center font-mono text-xs font-bold transition-all shadow-inner ${
                            isDone
                              ? 'bg-[#153a1e] border-emerald-600 text-emerald-400'
                              : isCurrent
                              ? 'bg-[#4a2910] border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.6)]'
                              : 'bg-[#150b05] border-[#3f2210] text-amber-900'
                          }`}
                        >
                          {isDone ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : p.id}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* HIGH-READABILITY PROMPT CARD */}
                <div
                  className={`bg-[#120904]/95 border border-[#4d2a15] rounded-lg p-3.5 shadow-inner ${
                    step === 1 || step === 3 ? 'flex-1 my-2 overflow-y-auto flex flex-col justify-start' : 'mb-2 max-h-[140px] overflow-y-auto'
                  }`}
                >
                  <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider font-bold block mb-1.5 border-b border-[#3d200e] pb-1">
                    Challenge Instructions:
                  </span>
                  <div className="font-sans text-xs sm:text-sm text-amber-100/90 leading-relaxed font-medium whitespace-pre-line">
                    <TypewriterPromptText text={currentPuzzle.prompt} speed={14} />
                  </div>
                  
                  {step === 1 && initial.year && initial.year >= 2 && initial.code_snippets && (
                    <div className="mt-4 border border-[#3d200e] rounded bg-[#0a0502] overflow-hidden">
                      <div className="flex border-b border-[#3d200e] bg-[#1a0f07]">
                        {Object.keys(initial.code_snippets).map(lang => (
                          <button
                            key={lang}
                            onClick={() => setSelectedLang(lang)}
                            className={`px-3 py-1.5 text-xs font-mono font-bold transition-colors ${selectedLang === lang ? 'bg-[#3d200e] text-amber-400' : 'text-amber-700 hover:text-amber-500 hover:bg-[#26150a]'}`}
                          >
                            {lang}
                          </button>
                        ))}
                      </div>
                      <div className="p-3 overflow-auto max-h-64">
                        <pre className="font-mono text-xs text-emerald-400/90 leading-relaxed">
                          {initial.code_snippets[selectedLang] || 'Code not found'}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>

                {/* INTERACTIVE PUZZLE CANVAS SANDBOX */}
                <InteractivePuzzleCanvas
                  step={step}
                  imageAssigned={initial.image_assigned}
                  onSelectAnswer={(selectedAnswer, moves) => {
                    setInputVal(selectedAnswer);
                    if (selectedAnswer === 'SLIDER_SOLVED') {
                      void handleSubmitPuzzle(undefined, 'SLIDER_SOLVED', moves);
                    }
                  }}
                />
              </div>

              {/* ARCADE INPUT TERMINAL */}
              <div className="mt-1.5 pt-2 border-t border-[#4d2a15]">
                <ArcadeInputTerminal
                  inputVal={inputVal}
                  setInputVal={setInputVal}
                  onSubmit={handleSubmitPuzzle}
                  loading={loading}
                  errorMsg={errorMsg}
                  successMsg={successMsg}
                  placeholderText={
                    step === 1 ? 'Enter Wood Deficit (e.g. 20)' : step === 2 ? 'Rearrange blocks to restore matrix' : 'Enter Password (e.g. FPYI)'
                  }
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
