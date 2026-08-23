'use client';

import { useCallback, useEffect, useRef } from 'react';
import Editor, { loader, type OnMount } from '@monaco-editor/react';
import type * as MonacoNs from 'monaco-editor';
import { MINEVERSE_THEME, MINEVERSE_THEME_DATA } from './monaco-theme';

// Same self-hosted bundle the editor uses — see CodeEditor for why.
loader.config({ paths: { vs: '/monaco/vs' } });

interface CodeInspectorProps {
  code: string;
  /** Monaco language id. Falls back to plaintext when the question names none. */
  language: string;
  /** The line the team has picked, 1-based. Null when nothing is picked yet. */
  selectedLine?: number | null;
  /** Set to make lines clickable. Omit for a listing that is only read. */
  onSelectLine?: (line: number) => void;
  /** Locked once the answer is final or the round has closed. */
  disabled?: boolean;
}

const LINE_HEIGHT = 20;
const PADDING = 20;
const MAX_HEIGHT = 460;

/**
 * A read-only listing of a question's code, with real line numbers.
 *
 * The debugging bank asks which line carries the bug and grades the answer as
 * a number, so the listing has to be *addressable*. It used to be a `<pre>`
 * whose line numbers were characters inside the prompt text — nothing could
 * highlight a line, and a team counted rows by eye and typed the number into a
 * box, which is a transcription error waiting to happen on a timed round.
 *
 * Here the numbers come from the editor's own gutter and a click picks a line.
 * The code stays read-only on purpose: nothing executes these submissions, and
 * an editable box would invite a team to fix the bug and submit a program that
 * the grader compares against "7".
 */
export function CodeInspector({
  code,
  language,
  selectedLine = null,
  onSelectLine,
  disabled = false,
}: CodeInspectorProps) {
  const editorRef = useRef<MonacoNs.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof MonacoNs | null>(null);
  const decorations = useRef<MonacoNs.editor.IEditorDecorationsCollection | null>(null);

  // Read through a ref so the mouse handler, registered once, always calls the
  // current callback rather than the one from the render that installed it.
  const selectRef = useRef(onSelectLine);
  useEffect(() => {
    selectRef.current = onSelectLine;
  }, [onSelectLine]);

  const disabledRef = useRef(disabled);
  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  const handleMount = useCallback<OnMount>((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    monaco.editor.defineTheme(MINEVERSE_THEME, MINEVERSE_THEME_DATA);
    monaco.editor.setTheme(MINEVERSE_THEME);

    decorations.current = editor.createDecorationsCollection([]);

    editor.onMouseDown((event) => {
      if (disabledRef.current || !selectRef.current) return;
      const line = event.target.position?.lineNumber;
      if (line) selectRef.current(line);
    });
  }, []);

  // Paint the chosen line. A decorations collection replaces its own contents,
  // so there is no stale highlight to clear when the selection moves.
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco || !decorations.current) return;

    decorations.current.set(
      selectedLine
        ? [
            {
              range: new monaco.Range(selectedLine, 1, selectedLine, 1),
              options: {
                isWholeLine: true,
                className: 'ci__line--picked',
                linesDecorationsClassName: 'ci__gutter--picked',
              },
            },
          ]
        : [],
    );
  }, [selectedLine]);

  const lines = Math.max(1, code.split('\n').length);
  const height = Math.min(MAX_HEIGHT, lines * LINE_HEIGHT + PADDING);

  return (
    <div className={onSelectLine && !disabled ? 'ci ci--pickable' : 'ci'} style={{ height }}>
      <Editor
        language={language}
        value={code}
        theme={MINEVERSE_THEME}
        onMount={handleMount}
        loading={<p className="cw-loading">Loading listing…</p>}
        options={
          {
            readOnly: true,
            // Without this Monaco still shows a blinking cursor and a text
            // caret, which reads as an editable box.
            domReadOnly: true,
            renderLineHighlight: 'none',
            lineNumbers: 'on',
            minimap: { enabled: false },
            fontSize: 13,
            lineHeight: LINE_HEIGHT,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontLigatures: false,
            tabSize: 4,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            folding: false,
            glyphMargin: false,
            contextmenu: false,
            occurrencesHighlight: 'off',
            selectionHighlight: false,
            matchBrackets: 'never',
            guides: { indentation: true, bracketPairs: false },
            padding: { top: 10, bottom: 10 },
            // The round already scrolls; a nested wheel trap is disorienting.
            scrollbar: { alwaysConsumeMouseWheel: false },
          } satisfies MonacoNs.editor.IStandaloneEditorConstructionOptions
        }
      />
    </div>
  );
}
