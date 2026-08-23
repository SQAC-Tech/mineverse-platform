'use client';

import { useCallback, useEffect, useRef } from 'react';
import Editor, { loader, type OnMount } from '@monaco-editor/react';
import type * as MonacoNs from 'monaco-editor';
import { MINEVERSE_THEME, MINEVERSE_THEME_DATA } from './monaco-theme';

/**
 * Monaco, served from our own origin.
 *
 * @monaco-editor/react fetches Monaco from jsDelivr unless told otherwise. The
 * event runs on campus wifi in a hall, so a CDN that is slow or blocked would
 * leave every coding question without an editor and no way to recover mid-round.
 * scripts/copy-monaco.mjs puts the bundle in public/monaco; this points the
 * loader at it.
 */
loader.config({ paths: { vs: '/monaco/vs' } });

interface CodeEditorProps {
  value: string;
  language: string;
  onChange: (value: string) => void;
  /** Answers are read-only once the round closes or the answer is final. */
  readOnly?: boolean;
  fontSize: number;
  minimap: boolean;
  wordWrap: boolean;
  /** Ctrl/Cmd+Enter — the run shortcut every judge has. */
  onRun?: () => void;
  /** Ctrl/Cmd+S — save the draft without leaving the keyboard. */
  onSave?: () => void;
}

export function CodeEditor({
  value,
  language,
  onChange,
  readOnly = false,
  fontSize,
  minimap,
  wordWrap,
  onRun,
  onSave,
}: CodeEditorProps) {
  // The commands are registered once on mount, but the callbacks are new on
  // every render, so they are read through a ref rather than re-bound. Updated
  // in an effect: writing a ref during render is what `react-hooks/refs` warns
  // about, and under the compiler it is genuinely unsafe.
  const actions = useRef({ onRun, onSave });
  useEffect(() => {
    actions.current = { onRun, onSave };
  }, [onRun, onSave]);

  const handleMount = useCallback<OnMount>((editor, monaco) => {
    monaco.editor.defineTheme(MINEVERSE_THEME, MINEVERSE_THEME_DATA);
    monaco.editor.setTheme(MINEVERSE_THEME);

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => actions.current.onRun?.());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => actions.current.onSave?.());
  }, []);

  return (
    <Editor
      language={language}
      value={value}
      theme={MINEVERSE_THEME}
      onChange={(next) => onChange(next ?? '')}
      onMount={handleMount}
      loading={<p className="cw-loading">Loading editor…</p>}
      options={
        {
          readOnly,
          fontSize,
          minimap: { enabled: minimap },
          wordWrap: wordWrap ? 'on' : 'off',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontLigatures: false,
          tabSize: 4,
          insertSpaces: true,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          renderWhitespace: 'selection',
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          suggestOnTriggerCharacters: true,
          quickSuggestions: { other: true, comments: false, strings: false },
          acceptSuggestionOnEnter: 'off',
          padding: { top: 12, bottom: 12 },
          // The round already has a scrolling column; a second scrollbar inside
          // the editor that also moves the page is disorienting.
          scrollbar: { alwaysConsumeMouseWheel: false },
        } satisfies MonacoNs.editor.IStandaloneEditorConstructionOptions
      }
    />
  );
}
