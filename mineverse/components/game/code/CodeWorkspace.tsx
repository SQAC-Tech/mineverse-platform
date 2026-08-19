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

export interface CodeQuestion {
  id: string;
  type: string;
  title?: string;
  prompt: string;
  language_options?: string[];
  pays?: Record<string, number>;
  submission_status: string | null;
}

interface CodeWorkspaceProps {
  question: CodeQuestion;
  roundName: string;
  /** Formatted round clock, repeated here so nobody closes the editor to check. */
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

interface RunResult {
  compile: { stdout: string; stderr: string; code: number | null };
  run: { stdout: string; stderr: string; code: number | null; signal: string | null };
}

type ConsoleTab = 'input' | 'output';

/**
 * A full-window code editor for a coding question.
 *
 * The round board gives every question the same narrow column, which cannot hold
 * a program. This takes the window instead: prompt on the left, editor on the
 * right, console beneath it.
 *
 * Run executes against input the team types, not against the grading cases —
 * those live in `hidden_test_cases` and the run endpoint cannot read them. So
 * there is no verdict here, only what the program printed. Marking happens after
 * the round, against cases nobody has seen.
 */
export function CodeWorkspace({
  question,
  roundName,
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

  const [split, setSplit] = useState(38);
  const [fontSize, setFontSize] = useState(14);
  const [wrap, setWrap] = useState(false);
  const [minimap, setMinimap] = useState(false);
  const [tab, setTab] = useState<ConsoleTab>('input');
  const [stdin, setStdin] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState('');
  const [saved, setSaved] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Escape closes, matching every other overlay in the app.
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
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      // Neither pane is allowed to collapse to nothing.
      setSplit(Math.min(70, Math.max(22, pct)));
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
    setResult(null);
    setTab('output');
    try {
      const res = await fetch('/api/team/code/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: question.id, language: active.id, code: draft, stdin }),
      });
      const json = await res.json();
      if (json.success) setResult({ compile: json.compile, run: json.run });
      else setRunError(json.error ?? 'The run failed.');
    } catch {
      setRunError('Could not reach the runner.');
    } finally {
      setRunning(false);
    }
  };

  // The draft is already persisted on every keystroke by the round shell; this
  // is the acknowledgement, so Ctrl+S does something visible.
  const acknowledgeSave = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  };

  const resetToStarter = () => {
    if (!active) return;
    onDraftChange(active.starter);
  };

  const blocks = promptBlocks(question.prompt);
  const reward = payoutText(question.pays);
  const compileFailed = Boolean(result?.compile.code);
  const exited = result?.run.code;

  return (
    <div className="cw" role="dialog" aria-modal="true" aria-label={`${question.title ?? 'Coding question'} editor`}>
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
          <Play size={14} /> {running ? 'Running…' : 'Run'}
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

          <p className="cw-problem__note">
            Run executes your program against the input you type in the console — it is a scratchpad, not the mark.
            Your answer is graded after the round against tests you have not seen, so read the rules above carefully.
          </p>
        </section>

        <button
          type="button"
          className="cw-divider"
          onPointerDown={startDrag}
          aria-label="Resize panes"
          title="Drag to resize"
        />

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
            <button
              type="button"
              className="cw-btn cw-btn--icon"
              onClick={() => setWrap((w) => !w)}
              aria-pressed={wrap}
              aria-label="Toggle word wrap"
              title="Word wrap"
            >
              <WrapText size={14} />
            </button>
            <button
              type="button"
              className="cw-btn cw-btn--icon"
              onClick={() => setMinimap((m) => !m)}
              aria-pressed={minimap}
              aria-label="Toggle minimap"
              title="Minimap"
            >
              <ChevronsUpDown size={14} />
            </button>

            <span className="cw-toolbar__spacer" />

            <button type="button" className="cw-btn" onClick={resetToStarter} disabled={locked || !active}>
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
              <button type="button" className="cw-tab" data-active={String(tab === 'input')} onClick={() => setTab('input')}>
                Input
              </button>
              <button type="button" className="cw-tab" data-active={String(tab === 'output')} onClick={() => setTab('output')}>
                Output
              </button>
            </div>

            <div className="cw-console__body">
              {tab === 'input' ? (
                <textarea
                  className="cw-stdin"
                  value={stdin}
                  onChange={(event) => setStdin(event.target.value)}
                  placeholder={'Standard input for your program.\nOne value per line, exactly as the question describes.'}
                  spellCheck={false}
                  aria-label="Standard input"
                />
              ) : runError ? (
                <p className="cw-out cw-out--err">{runError}</p>
              ) : running ? (
                <p className="cw-out cw-out--muted">Running…</p>
              ) : !result ? (
                <p className="cw-out cw-out--muted">
                  Nothing yet. Put your input on the Input tab, then press Run — or Ctrl+Enter.
                </p>
              ) : (
                <>
                  <span className="cw-verdict" data-ok={String(!compileFailed && exited === 0)}>
                    {compileFailed
                      ? 'Compile error'
                      : exited === 0
                        ? 'Finished'
                        : `Exited with code ${exited ?? '?'}`}
                  </span>

                  {result.compile.stderr && (
                    <>
                      <p className="cw-out__label">COMPILER</p>
                      <pre className="cw-out cw-out--err">{result.compile.stderr}</pre>
                    </>
                  )}

                  <p className="cw-out__label">STDOUT</p>
                  <pre className="cw-out">{result.run.stdout || '(no output)'}</pre>

                  {result.run.stderr && (
                    <>
                      <p className="cw-out__label">STDERR</p>
                      <pre className="cw-out cw-out--err">{result.run.stderr}</pre>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
