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
  it.each(Object.values(RUNTIMES))('$label maps to a Piston language the grader also knows', (runtime) => {
    // The grader's table is keyed by the same ids and values.
    expect(grader).toContain(`language: '${runtime.piston}'`);
    expect(grader).toContain(`file: '${runtime.file}'`);
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
  ])('resolves %s to %s', (input, expected) => {
    expect(resolveRuntime(input)?.id).toBe(expected);
  });

  it.each([null, undefined, '', 'rust', 'javascript'])('rejects %p', (input) => {
    expect(resolveRuntime(input)).toBeNull();
  });
});

describe('runtimesFor', () => {
  it('keeps the order the question lists', () => {
    expect(runtimesFor(['java', 'python', 'c']).map((r) => r.id)).toEqual(['java', 'python', 'c']);
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
