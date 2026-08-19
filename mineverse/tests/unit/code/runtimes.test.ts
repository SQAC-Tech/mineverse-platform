import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RUNTIMES, resolveRuntime, runtimesFor } from '../../../lib/gameplay/code/runtimes';

/**
 * The editor and the grader have to agree about languages.
 *
 * lib/grading/day2-round5.ts keeps its own PISTON_RUNTIMES table. If the two
 * drift, a team writes in a language the editor offered and the grader either
 * refuses it or compiles it as something else — and that only surfaces after the
 * round, when the marks come out wrong.
 */

const grader = readFileSync(join(__dirname, '..', '..', '..', 'lib', 'grading', 'day2-round5.ts'), 'utf8');

describe('runtime catalog', () => {
  it('is the very catalog the grader resolves against', () => {
    // Not a matching copy — the same import. A language the editor offers and
    // the grader does not know would fail a correct submission after the round,
    // with nothing on screen to explain why.
    expect(grader).toContain("import { resolveRuntime } from '@/lib/gameplay/code/runtimes'");
    expect(grader).toContain('resolveRuntime(submission.language)');
    expect(grader).not.toMatch(/PISTON_RUNTIMES/);
  });

  it("sends Piston the catalog's own language id and filename", () => {
    expect(grader).toContain('language: runtime.piston');
    expect(grader).toContain('name: runtime.file');
  });

  it('offers every language the event promised', () => {
    expect(Object.keys(RUNTIMES).sort()).toEqual(['c', 'cpp', 'java', 'javascript', 'python']);
  });

  it('compiles Java as Main.java, which is what Piston runs', () => {
    // Piston compiles the file then runs the class inside it; any other name
    // produces "class not found" for perfectly correct code.
    expect(RUNTIMES.java.file).toBe('Main.java');
    expect(RUNTIMES.java.starter).toContain('public class Main');
  });

  it('gives every runtime a starter that names where input comes from', () => {
    for (const runtime of Object.values(RUNTIMES)) {
      expect(runtime.starter.trim().length).toBeGreaterThan(0);
      expect(runtime.monaco.length).toBeGreaterThan(0);
    }
  });
});

describe('resolveRuntime', () => {
  it.each([
    ['python', 'python'],
    ['py', 'python'],
    ['python3', 'python'],
    ['cpp', 'cpp'],
    ['c++', 'cpp'],
    ['C++', 'cpp'],
    ['  Java  ', 'java'],
    ['c', 'c'],
    ['javascript', 'javascript'],
    ['js', 'javascript'],
    ['node', 'javascript'],
    ['NodeJS', 'javascript'],
  ])('resolves %s to %s', (input, expected) => {
    expect(resolveRuntime(input)?.id).toBe(expected);
  });

  it.each([null, undefined, '', 'rust', 'go', 'ruby'])('rejects %p', (input) => {
    expect(resolveRuntime(input)).toBeNull();
  });
});

describe('runtimesFor', () => {
  it('keeps the order the question lists', () => {
    expect(runtimesFor(['java', 'python', 'c']).map((r) => r.id)).toEqual(['java', 'python', 'c']);
  });

  it('resolves the five the coding questions now offer', () => {
    expect(runtimesFor(['python', 'cpp', 'c', 'java', 'javascript']).map((r) => r.id)).toEqual([
      'python',
      'cpp',
      'c',
      'java',
      'javascript',
    ]);
  });

  it('collapses aliases so one runtime cannot appear twice', () => {
    // A question listing both `py` and `python` must not offer Python twice.
    expect(runtimesFor(['py', 'python', 'python3']).map((r) => r.id)).toEqual(['python']);
  });

  it('drops languages with no runtime rather than offering something unrunnable', () => {
    expect(runtimesFor(['python', 'rust']).map((r) => r.id)).toEqual(['python']);
  });

  it.each([null, undefined, []])('returns nothing for %p', (input) => {
    expect(runtimesFor(input)).toEqual([]);
  });
});
