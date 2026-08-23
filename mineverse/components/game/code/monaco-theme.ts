import type * as MonacoNs from 'monaco-editor';

export const MINEVERSE_THEME = 'mineverse-dark';

/**
 * One Monaco theme for every editor on the platform.
 *
 * Lived inside `CodeEditor` until the read-only inspector needed it too. Two
 * copies of a theme definition is how a coding question and a debugging
 * question end up rendering the same language in different colours, so it is
 * defined once here and registered by whoever mounts first.
 */
export const MINEVERSE_THEME_DATA: MonacoNs.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6f7f66', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'c48cff' },
    { token: 'string', foreground: 'a8d97a' },
    { token: 'number', foreground: 'f2c14e' },
    { token: 'type', foreground: '7ad6c0' },
  ],
  colors: {
    // Sits inside the round's panel, so it borrows the panel's darkness rather
    // than Monaco's default near-black.
    'editor.background': '#0d1016',
    'editor.lineHighlightBackground': '#161b24',
    'editorLineNumber.foreground': '#4a5560',
    'editorLineNumber.activeForeground': '#c9d4c2',
    'editorCursor.foreground': '#f2c14e',
    'editor.selectionBackground': '#2b3a4a',
    'editorIndentGuide.background1': '#1d242e',
    'editorGutter.background': '#0d1016',
    'scrollbarSlider.background': '#2a333d80',
  },
};
