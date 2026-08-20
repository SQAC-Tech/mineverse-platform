'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Check,
  ChevronsUpDown,
  Clock3,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Save,
  Send,
  Terminal,
  WrapText,
  X,
} from 'lucide-react';
import { promptBlocks, payoutText } from '@/components/game/custom-round-ui/round-presentation';
import { runtimesFor, resolveRuntime, type Runtime } from '@/lib/gameplay/code/runtimes';
import './code-workspace.css';

// Monaco reaches for `window` and `document` as it loads, so it must not be part
// of the server render. `ssr: false` is legal here because this file is a Client
// Component (see node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md).
const CodeEditor = dynamic(() => import('./CodeEditor').then((m) => m.CodeEditor), {
  ssr: false,
  loading: () => <p className="cw-loading">Loading editor…</p>,
});

export interface SampleCase {
  stdin: string;
  stdout: string;
  explanation?: string;
}

export interface CodeQuestion {
  id: string;
  type: string;
  title?: string;
  prompt: string;
  language_options?: string[];
  sample_test_cases?: SampleCase[];
  pays?: Record<string, number>;
  submission_status: string | null;
}

interface CodeWorkspaceProps {
  question: CodeQuestion;
  roundName: string;
  /** The round's biome class, so the editor wears the round's colours. */
  themeClass: string;
  clock: string;
  clockWarning: boolean;
  draft: string;
  language: string | null;
  locked: boolean;
  submitting: boolean;
  onDraftChange: (value: string) => void;
  onLanguageChange: (language: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

interface CaseResult {
  index: number;
  stdin: string;
  expected: string;
  actual: string;
  passed: boolean;
  stderr: string;
  compile: { stdout: string; stderr: string; code: number | null };
  exit_code: number | null;
}

interface CustomResult {
  compile: { stdout: string; stderr: string; code: number | null };
  run: { stdout: string; stderr: string; code: number | null; signal: string | null };
}

/**
 * A full-window judge for a coding question.
 *
 * The round board gives every question the same narrow column, which cannot hold
 * a program. This takes the window: prompt on the left, editor on the right,
 * test cases beneath it, dressed in whichever biome the round belongs to.
 *
 * Run works the way a judge's does. It executes the *sample* cases — the worked
 * examples printed in the question — and shows input, expected and actual for
 * each. It never touches `hidden_test_cases`; those are what the round is marked
 * against and the run endpoint cannot read them. Passing every sample is
 * therefore encouraging, not a score, and the panel says so.
 */
export function CodeWorkspace({
  question,
  roundName,
  themeClass,
  clock,
  clockWarning,
  draft,
  language,
  locked,
  submitting,
  onDraftChange,
  onLanguageChange,
  onSubmit,
  onClose,
}: CodeWorkspaceProps) {
  const runtimes = runtimesFor(question.language_options);
  const active = resolveRuntime(language) ?? runtimes[0] ?? null;
  const samples = question.sample_test_cases ?? [];

  const [split, setSplit] = useState(38);
  const [fontSize, setFontSize] = useState(14);
  const [wrap, setWrap] = useState(false);
  const [minimap, setMinimap] = useState(false);
  const [custom, setCustom] = useState(false);
  const [stdin, setStdin] = useState(samples[0]?.stdin ?? '');
  const [caseIndex, setCaseIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<CaseResult[] | null>(null);
  const [customResult, setCustomResult] = useState<CustomResult | null>(null);
  const [runError, setRunError] = useState('');
  const [saved, setSaved] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const body = bodyRef.current;
    if (!body) return;
    const move = (e: PointerEvent) => {
      const rect = body.getBoundingClientRect();
      // Neither pane is allowed to collapse to nothing.
      setSplit(Math.min(70, Math.max(22, ((e.clientX - rect.left) / rect.width) * 100)));
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  };

  const run = async () => {
    if (!active || running) return;
    setRunning(true);
    setRunError('');
    setResults(null);
    setCustomResult(null);
    try {
      const res = await fetch('/api/team/code/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: question.id,
          language: active.id,
          code: draft,
          mode: custom ? 'custom' : 'samples',
          stdin: custom ? stdin : '',
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setRunError(json.error ?? 'The run failed.');
      } else if (json.mode === 'custom') {
        setCustomResult({ compile: json.compile, run: json.run });
      } else {
        setResults(json.results);
        // Land on the first failure — that is the one worth reading.
        const firstFailed = (json.results as CaseResult[]).findIndex((entry) => !entry.passed);
        setCaseIndex(firstFailed === -1 ? 0 : firstFailed);
      }
    } catch {
      setRunError('Could not reach the runner.');
    } finally {
      setRunning(false);
    }
  };

  // The draft is persisted on every keystroke by the round shell; this is the
  // acknowledgement, so Ctrl+S does something visible.
  const acknowledgeSave = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  };

  const blocks = promptBlocks(question.prompt);
  const reward = payoutText(question.pays);
  const shown = results?.[caseIndex] ?? null;
  const allPassed = results !== null && results.length === samples.length && results.every((entry) => entry.passed);

  return (
    <div
      className={`cw ${themeClass}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${question.title ?? 'Coding question'} editor`}
    >
      <div className="cw-backdrop" aria-hidden="true" />
      <div className="cw-scrim" aria-hidden="true" />

      <div className="cw-bar">
        <div className="cw-bar__title">
          <span className="cw-bar__eyebrow">{roundName.toUpperCase()}</span>
          <span className="cw-bar__name">{question.title || 'Coding question'}</span>
        </div>

        <div className="cw-clock" data-warn={String(clockWarning)}>
          <Clock3 size={14} aria-hidden="true" /> {clock}
        </div>

        <button type="button" className="cw-btn" onClick={acknowledgeSave} disabled={locked}>
          {saved ? <Check size={14} /> : <Save size={14} />} {saved ? 'Saved' : 'Save'}
        </button>

        <button type="button" className="cw-btn cw-btn--run" onClick={() => void run()} disabled={running || !active}>
          <Play size={14} /> {running ? 'Running…' : custom ? 'Run custom' : 'Run samples'}
        </button>

        <button type="button" className="cw-btn cw-btn--submit" onClick={onSubmit} disabled={locked || submitting}>
          <Send size={14} /> {submitting ? 'Submitting…' : 'Submit'}
        </button>

        <button type="button" className="cw-btn cw-btn--icon" onClick={onClose} aria-label="Close editor">
          <X size={16} />
        </button>
      </div>

      <div className="cw-body" ref={bodyRef} style={{ ['--cw-split' as string]: `${split}%` }}>
        <section className="cw-pane cw-problem">
          <div className="cw-problem__head">
            <span className="cw-problem__tag">{question.type.replace(/_/g, ' ')}</span>
            {reward && <span className="cw-problem__reward">{reward}</span>}
          </div>
          <h1>{question.title || 'Coding question'}</h1>

          {blocks.map((block, index) =>
            block.kind === 'code' ? (
              <pre key={index}>
                <code>{block.body}</code>
              </pre>
            ) : (
              <p key={index}>{block.body}</p>
            ),
          )}

          {samples.length > 0 && (
            <>
              <h2 className="cw-problem__sub">Examples</h2>
              {samples.map((sample, index) => (
                <div key={index} className="cw-example">
                  <p className="cw-example__label">Example {index + 1}</p>
                  <dl>
                    <dt>Input</dt>
                    <dd>{sample.stdin || '(none)'}</dd>
                    <dt>Output</dt>
                    <dd>{sample.stdout}</dd>
                  </dl>
                  {sample.explanation && <p className="cw-example__why">{sample.explanation}</p>}
                </div>
              ))}
            </>
          )}

          <p className="cw-problem__note">
            Run checks the examples above. Your answer is marked after the round against further tests you have not
            seen, so passing every example is a good sign — not a score.
          </p>
        </section>

        <button type="button" className="cw-divider" onPointerDown={startDrag} aria-label="Resize panes" title="Drag to resize" />

        <div className="cw-pane cw-editor-pane">
          <div className="cw-toolbar">
            <select
              className="cw-select"
              value={active?.id ?? ''}
              onChange={(event) => onLanguageChange(event.target.value)}
              disabled={locked || runtimes.length <= 1}
              aria-label="Language"
            >
              {runtimes.map((runtime: Runtime) => (
                <option key={runtime.id} value={runtime.id}>
                  {runtime.label}
                </option>
              ))}
            </select>

            <button type="button" className="cw-btn cw-btn--icon" onClick={() => setFontSize((s) => Math.max(11, s - 1))} aria-label="Smaller text">
              <Minus size={14} />
            </button>
            <button type="button" className="cw-btn cw-btn--icon" onClick={() => setFontSize((s) => Math.min(24, s + 1))} aria-label="Larger text">
              <Plus size={14} />
            </button>
            <button type="button" className="cw-btn cw-btn--icon" onClick={() => setWrap((w) => !w)} aria-pressed={wrap} aria-label="Toggle word wrap" title="Word wrap">
              <WrapText size={14} />
            </button>
            <button type="button" className="cw-btn cw-btn--icon" onClick={() => setMinimap((m) => !m)} aria-pressed={minimap} aria-label="Toggle minimap" title="Minimap">
              <ChevronsUpDown size={14} />
            </button>

            <span className="cw-toolbar__spacer" />

            <button type="button" className="cw-btn" onClick={() => active && onDraftChange(active.starter)} disabled={locked || !active}>
              <RotateCcw size={14} /> Reset
            </button>
          </div>

          <div className="cw-editor">
            <CodeEditor
              value={draft}
              language={active?.monaco ?? 'plaintext'}
              onChange={onDraftChange}
              readOnly={locked}
              fontSize={fontSize}
              minimap={minimap}
              wordWrap={wrap}
              onRun={() => void run()}
              onSave={acknowledgeSave}
            />
          </div>

          <div className="cw-console">
            <div className="cw-console__tabs">
              {/* Each sample is its own chip, so a failure is one click away
                  rather than buried in a wall of output. */}
              {!custom &&
                samples.map((_, index) => {
                  const outcome = results?.[index];
                  return (
                    <button
                      key={index}
                      type="button"
                      className="cw-case"
                      data-active={String(caseIndex === index)}
                      data-state={outcome ? (outcome.passed ? 'pass' : 'fail') : 'idle'}
                      onClick={() => setCaseIndex(index)}
                    >
                      Case {index + 1}
                    </button>
                  );
                })}

              <button
                type="button"
                className="cw-case cw-case--custom"
                data-active={String(custom)}
                onClick={() => setCustom((value) => !value)}
                title="Run your own input"
              >
                <Terminal size={12} /> Custom
              </button>

              {!custom && results && (
                <span className="cw-summary" data-ok={String(allPassed)}>
                  {allPassed ? 'All examples passed' : `${results.filter((r) => r.passed).length}/${samples.length} passed`}
                </span>
              )}
            </div>

            <div className="cw-console__body">
              {runError ? (
                <p className="cw-out cw-out--err">{runError}</p>
              ) : running ? (
                <p className="cw-out cw-out--muted">Running…</p>
              ) : custom ? (
                <div className="cw-custom">
                  <label className="cw-out__label" htmlFor="cw-stdin">
                    YOUR INPUT
                  </label>
                  <textarea
                    id="cw-stdin"
                    className="cw-stdin"
                    value={stdin}
                    onChange={(event) => setStdin(event.target.value)}
                    placeholder={'Standard input for your program.'}
                    spellCheck={false}
                  />
                  {customResult && (
                    <div className="cw-custom__out">
                      {customResult.compile.stderr && (
                        <>
                          <p className="cw-out__label">COMPILER</p>
                          <pre className="cw-out cw-out--err">{customResult.compile.stderr}</pre>
                        </>
                      )}
                      <p className="cw-out__label">STDOUT</p>
                      <pre className="cw-out">{customResult.run.stdout || '(no output)'}</pre>
                      {customResult.run.stderr && (
                        <>
                          <p className="cw-out__label">STDERR</p>
                          <pre className="cw-out cw-out--err">{customResult.run.stderr}</pre>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : !results ? (
                <p className="cw-out cw-out--muted">
                  {samples.length
                    ? 'Press Run — or Ctrl+Enter — to check your code against the examples.'
                    : 'This question has no examples. Use Custom to run your own input.'}
                </p>
              ) : shown ? (
                <div className="cw-case-detail">
                  {shown.compile.code ? (
                    <>
                      <span className="cw-verdict" data-ok="false">
                        Compile error
                      </span>
                      <pre className="cw-out cw-out--err">{shown.compile.stderr || 'Your code did not compile.'}</pre>
                    </>
                  ) : (
                    <>
                      <span className="cw-verdict" data-ok={String(shown.passed)}>
                        {shown.passed ? 'Passed' : 'Wrong output'}
                      </span>

                      <p className="cw-out__label">INPUT</p>
                      <pre className="cw-out">{shown.stdin || '(none)'}</pre>

                      <p className="cw-out__label">EXPECTED</p>
                      <pre className="cw-out">{shown.expected}</pre>

                      <p className="cw-out__label">YOUR OUTPUT</p>
                      <pre className={shown.passed ? 'cw-out' : 'cw-out cw-out--err'}>
                        {shown.actual || '(no output)'}
                      </pre>

                      {shown.stderr && (
                        <>
                          <p className="cw-out__label">STDERR</p>
                          <pre className="cw-out cw-out--err">{shown.stderr}</pre>
                        </>
                      )}
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
