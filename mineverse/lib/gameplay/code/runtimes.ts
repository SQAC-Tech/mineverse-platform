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
