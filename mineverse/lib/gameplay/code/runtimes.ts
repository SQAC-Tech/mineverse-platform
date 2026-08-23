/**
 * The languages a team can write in, and what each one is called downstream.
 *
 * One table, three consumers: Piston needs its own language id and a real
 * filename (Java most of all — it compiles `Main.java` then runs the `Main`
 * class), Monaco needs its own grammar id, and the UI needs something to print.
 * The grader in lib/grading/day2-round5.ts carries the same Piston mapping; if
 * a language is ever added there it has to be added here too or a team will be
 * graded in a language it could not select.
 */

export interface Runtime {
  /** The id stored on `questions.language_options` and on a submission. */
  id: string;
  label: string;
  /** Piston's language name. */
  piston: string;
  /** Filename Piston compiles. */
  file: string;
  /** Monaco's language id. */
  monaco: string;
  /** Shown in an empty editor so nobody starts from a blank page. */
  starter: string;
}

export const RUNTIMES: Record<string, Runtime> = {
  python: {
    id: 'python',
    label: 'Python',
    piston: 'python',
    file: 'main.py',
    monaco: 'python',
    starter: [
      '# Read from standard input, print the answer to standard output.',
      'import sys',
      '',
      'def main():',
      '    data = sys.stdin.read().split()',
      '    # your code here',
      '',
      'main()',
      '',
    ].join('\n'),
  },
  cpp: {
    id: 'cpp',
    label: 'C++',
    piston: 'c++',
    file: 'main.cpp',
    monaco: 'cpp',
    starter: [
      '#include <bits/stdc++.h>',
      'using namespace std;',
      '',
      'int main() {',
      '    ios::sync_with_stdio(false);',
      '    cin.tie(nullptr);',
      '    // your code here',
      '    return 0;',
      '}',
      '',
    ].join('\n'),
  },
  c: {
    id: 'c',
    label: 'C',
    piston: 'c',
    file: 'main.c',
    monaco: 'c',
    starter: ['#include <stdio.h>', '', 'int main(void) {', '    /* your code here */', '    return 0;', '}', ''].join('\n'),
  },
  javascript: {
    id: 'javascript',
    label: 'JavaScript',
    piston: 'javascript',
    file: 'main.js',
    monaco: 'javascript',
    starter: [
      '// Read from standard input, print the answer to standard output.',
      "const data = require('fs').readFileSync(0, 'utf8').trim();",
      '',
      '// your code here',
      '',
    ].join('\n'),
  },
  java: {
    id: 'java',
    label: 'Java',
    piston: 'java',
    // Piston compiles this filename and then runs the class inside it, so the
    // public class must be called Main.
    file: 'Main.java',
    monaco: 'java',
    starter: [
      'import java.util.*;',
      '',
      'public class Main {',
      '    public static void main(String[] args) {',
      '        Scanner sc = new Scanner(System.in);',
      '        // your code here',
      '    }',
      '}',
      '',
    ].join('\n'),
  },
};

/** Aliases the question bank uses for the same runtime. */
const ALIASES: Record<string, string> = {
  py: 'python',
  python3: 'python',
  'c++': 'cpp',
  js: 'javascript',
  node: 'javascript',
  nodejs: 'javascript',
};

export function resolveRuntime(language: string | null | undefined): Runtime | null {
  if (!language) return null;
  const key = language.trim().toLowerCase();
  return RUNTIMES[ALIASES[key] ?? key] ?? null;
}

/** The runtimes a question offers, in the order the question lists them. */
export function runtimesFor(languageOptions: string[] | null | undefined): Runtime[] {
  const resolved = (languageOptions ?? []).map(resolveRuntime).filter((r): r is Runtime => r !== null);
  // De-duplicate: `py` and `python` are the same runtime and must not appear twice.
  return [...new Map(resolved.map((runtime) => [runtime.id, runtime])).values()];
}

/**
 * What a question offers when it names nothing.
 *
 * Most of the bank has an empty `language_options`, and every caller used to
 * inline its own fallback list — the same five ids, written out five times, all
 * of them starting with `python`. That ordering was the default a team got, so
 * a C++ event handed everyone a Python editor.
 *
 * C++ leads because that is what the question bank is mostly written in. The
 * list lives here once so the picker, the prompt and the editor cannot drift
 * apart again.
 */
export const DEFAULT_LANGUAGE_OPTIONS = ['cpp', 'python', 'java', 'javascript', 'c'];

/** The runtimes to actually show for a question, fallback included. */
export function offeredRuntimes(languageOptions: string[] | null | undefined): Runtime[] {
  const named = runtimesFor(languageOptions);
  return named.length > 0 ? named : runtimesFor(DEFAULT_LANGUAGE_OPTIONS);
}

/** The language a question starts on before the team picks one. */
export function defaultLanguageFor(languageOptions: string[] | null | undefined): string {
  return offeredRuntimes(languageOptions)[0]?.id ?? 'cpp';
}

/**
 * Whether a question still offers a language the team picked earlier.
 *
 * The stored choice used to be checked against `language_options` directly,
 * which is empty for most of the bank — so `[].includes('cpp')` was false and
 * every remembered choice was silently thrown away and reset to the default.
 */
export function offersLanguage(languageOptions: string[] | null | undefined, language: string | null): boolean {
  if (!language) return false;
  const resolved = resolveRuntime(language);
  return resolved !== null && offeredRuntimes(languageOptions).some((runtime) => runtime.id === resolved.id);
}
