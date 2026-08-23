'use client';

import dynamic from 'next/dynamic';
import { resolveRuntime } from '@/lib/gameplay/code/runtimes';
import { extractCodeBlock, type ExtractedCode } from '@/components/game/custom-round-ui/round-presentation';
import './inspector-card.css';

// Monaco touches `window` while loading, so it stays out of the server render.
const CodeInspector = dynamic(() => import('./CodeInspector').then((m) => m.CodeInspector), {
  ssr: false,
  loading: () => <p className="cw-loading">Loading listing…</p>,
});

/**
 * Types whose answer is *about* a line rather than the code itself.
 *
 * These grade against a line number — `{"any_of": ["7", "line 7", ...]}` — so
 * picking the line is the answer, and clicking one is both faster and safer
 * than counting rows and typing a digit.
 */
const PICKS_A_LINE = ['debugging'];

/** Types that show code but are answered with something else entirely. */
const SHOWS_CODE = ['debugging', 'debug_output', 'code_completion'];

export function usesInspector(question: { type: string; prompt: string; content?: unknown }): boolean {
  return SHOWS_CODE.includes(question.type) && extractCodeBlock(question.prompt) !== null;
}

interface InspectorCardProps {
  type: string;
  /** The body for the language the team is reading, already picked by the shell. */
  prompt: string;
  /** The team's current answer — a line number, an expression, or an output. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Language the team selected, used when the prompt's fence names none. */
  language?: string | null;
}

/**
 * A question that shows code, with its answer attached to the listing.
 *
 * Replaces a `<pre>` of numbered text plus a detached textarea somewhere below
 * it. Nothing here is editable: none of these question types execute what is
 * submitted — they are string-matched against a line number, one expression, or
 * an expected output — so an editable listing would invite a team to fix the
 * bug and submit a program the grader scores as wrong.
 */
export function InspectorCard({ type, prompt, value, onChange, disabled = false, language }: InspectorCardProps) {
  const block: ExtractedCode | null = extractCodeBlock(prompt);
  if (!block) return null;

  // The fence's own tag wins — it describes the listing that is actually there,
  // which is not always the language the team has selected.
  const runtime = resolveRuntime(block.language) ?? resolveRuntime(language ?? null);
  const monacoLanguage = runtime?.monaco ?? 'plaintext';

  const picksLine = PICKS_A_LINE.includes(type) && block.wasNumbered;
  const selectedLine = picksLine ? Number.parseInt(value.replace(/[^0-9]/g, ''), 10) || null : null;

  return (
    <div className="ic">
      {block.intro && <p className="ic__intro">{block.intro}</p>}

      <div className="ic__listing">
        <CodeInspector
          code={block.code}
          language={monacoLanguage}
          selectedLine={selectedLine}
          onSelectLine={picksLine ? (line) => onChange(String(line)) : undefined}
          disabled={disabled}
        />
      </div>

      {block.outro && <p className="ic__outro">{block.outro}</p>}

      <div className="ic__answer">
        {picksLine ? (
          <>
            <label className="ic__label" htmlFor={`ic-${type}`}>
              Buggy line
            </label>
            <input
              id={`ic-${type}`}
              className="ic__field ic__field--line"
              inputMode="numeric"
              value={value}
              disabled={disabled}
              placeholder="click a line"
              onChange={(event) => onChange(event.target.value)}
            />
            <span className="ic__hint">Click the line above, or type its number.</span>
          </>
        ) : (
          <>
            <label className="ic__label" htmlFor={`ic-${type}`}>
              {type === 'code_completion' ? 'Missing code' : 'What it should print'}
            </label>
            <input
              id={`ic-${type}`}
              className="ic__field"
              value={value}
              disabled={disabled}
              spellCheck={false}
              autoComplete="off"
              placeholder={type === 'code_completion' ? 'just the missing part' : 'the corrected output'}
              onChange={(event) => onChange(event.target.value)}
            />
            <span className="ic__hint">
              {type === 'code_completion'
                ? 'Only what belongs in the blank — not the whole program.'
                : 'The output the fixed program would produce.'}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
