import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serializeSafeQuestion, type QuestionRow } from '../../../lib/gameplay/questions/contracts';
import { normalizeOutput } from '../../../lib/gameplay/code/compare';
import { wrapForExecution } from '../../../lib/gameplay/code/contract';

const root = join(__dirname, '..', '..', '..');

/**
 * Sample cases are shown to teams; hidden cases are what the round is marked
 * against. Everything here guards the line between them, and the promise that a
 * sample passing in the editor is a sample passing when it is graded.
 */

function question(extra: Partial<QuestionRow> = {}): QuestionRow {
  return {
    id: 'q1',
    round_id: 3,
    type: 'coding',
    prompt: 'Print the answer.',
    content: { title: 'Test' },
    order_index: 1,
    language_options: ['python'],
    time_limit_seconds: null,
    ...extra,
  } as QuestionRow;
}

describe('serializeSafeQuestion', () => {
  it('serves sample cases', () => {
    const safe = serializeSafeQuestion(
      question({ sample_test_cases: [{ stdin: '1 2', stdout: '3', explanation: 'sums them' }] }),
    );
    expect(safe.sample_test_cases).toEqual([{ stdin: '1 2', stdout: '3', explanation: 'sums them' }]);
  });

  it('never carries hidden cases, even when the row has them', () => {
    const safe = serializeSafeQuestion(
      question({
        sample_test_cases: [{ stdin: '1', stdout: '1' }],
        // A row read with `select *` would carry these; the serializer must not.
        hidden_test_cases: [{ stdin: 'secret', stdout: 'secret' }],
        expected_answer: { value: 'secret' },
        rubric: { note: 'secret' },
      } as Partial<QuestionRow>),
    );
    expect(JSON.stringify(safe)).not.toContain('secret');
    expect(safe).not.toHaveProperty('hidden_test_cases');
    expect(safe).not.toHaveProperty('expected_answer');
    expect(safe).not.toHaveProperty('rubric');
  });

  it('copies only the three public fields off a case', () => {
    const safe = serializeSafeQuestion(
      question({
        sample_test_cases: [{ stdin: '1', stdout: '1', weight: 99, internal_note: 'secret' }],
      } as Partial<QuestionRow>),
    );
    expect(safe.sample_test_cases[0]).toEqual({ stdin: '1', stdout: '1' });
  });

  it.each([null, undefined, 'nonsense', 42, {}])('treats %p as no samples', (value) => {
    expect(serializeSafeQuestion(question({ sample_test_cases: value } as Partial<QuestionRow>)).sample_test_cases).toEqual([]);
  });

  it('coerces a case to strings so the editor never renders an object', () => {
    const safe = serializeSafeQuestion(question({ sample_test_cases: [{ stdin: 12, stdout: 34 }] } as Partial<QuestionRow>));
    expect(safe.sample_test_cases[0]).toEqual({ stdin: '12', stdout: '34' });
  });
});

describe('normalizeOutput', () => {
  it.each([
    ['trailing newline', '3\n', '3'],
    ['windows endings', '3\r\n', '3'],
    ['trailing spaces', '3   ', '3'],
    ['per-line trailing spaces', 'a  \nb  ', 'a\nb'],
    ['leading and trailing blank lines', '\n\n3\n\n', '3'],
  ])('ignores %s', (_label, raw, expected) => {
    expect(normalizeOutput(raw)).toBe(expected);
  });

  it('does not ignore a difference that matters', () => {
    expect(normalizeOutput('SAFE')).not.toBe(normalizeOutput('UNSAFE'));
    expect(normalizeOutput('1 2')).not.toBe(normalizeOutput('12'));
  });

  it.each([null, undefined])('turns %p into an empty string', (value) => {
    expect(normalizeOutput(value)).toBe('');
  });

  it('is the very function the grader compares with', () => {
    // Not a copy of it — the same import. If the editor says a sample passed and
    // the grader then marks it wrong, a team loses marks it earned, so the two
    // must not be able to drift.
    const grader = readFileSync(join(root, 'lib', 'grading', 'day2-round5.ts'), 'utf8');
    expect(grader).toContain("import { normalizeOutput } from '@/lib/gameplay/code/compare'");
    expect(grader).not.toMatch(/function normalizeOutput/);
  });

  it('runs the same wrapper the editor ran', () => {
    // A contract question's answer is a `class Solution` with no `main` in it.
    // The grader used to post `submission.code` to Piston bare, which cannot run
    // in any language — and it books a failed run as a wrong answer, so every
    // correct Round 5 submission would have been marked zero.
    const grader = readFileSync(join(root, 'lib', 'grading', 'day2-round5.ts'), 'utf8');
    expect(grader).toContain('wrapForExecution');
    expect(grader).not.toMatch(/content:\s*submission\.code/);
  });
});

describe('the run endpoint', () => {
  const source = readFileSync(join(root, 'app', 'api', 'team', 'code', 'run', 'route.ts'), 'utf8');

  it('selects the sample cases by name and never the hidden ones', () => {
    const selects = [...source.matchAll(/\.select\('([^']*)'\)/g)].map((match) => match[1]);
    expect(selects.length).toBeGreaterThan(0);
    for (const columns of selects) {
      expect(columns).not.toContain('hidden_test_cases');
      expect(columns).not.toContain('expected_answer');
      expect(columns).not.toBe('*');
    }
    expect(selects.some((columns) => columns.includes('sample_test_cases'))).toBe(true);
  });

  it('is rate limited per team, not per IP', () => {
    // The hall shares one campus NAT address.
    expect(source).toContain('code-run:${session.team_id}');
  });
});

/**
 * Piston picks the class to run by scanning the file and taking the first one,
 * not from the filename. So for Java the wrapper's own class has to be declared
 * ahead of the team's, or a correct solution dies at run time with
 * "can't find main(String[]) method in class: Solution".
 *
 * The local harness test cannot catch this — it runs `javac Main.java && java
 * Main`, which names the entry point that Piston has to guess.
 */
describe('java assembly order', () => {
  const fn = {
    name: 'missingMarker',
    params: [{ name: 'markers', type: 'int[]' as const }],
    returns: 'int' as const,
  };

  const solution = 'import java.util.*;\n\nclass Solution {\n    public int missingMarker(int[] m) { return 0; }\n}';

  it('declares Main before the team class', () => {
    const wrapped = wrapForExecution(fn, 'java', solution);
    expect(wrapped.indexOf('public class Main')).toBeLessThan(wrapped.indexOf('class Solution'));
  });

  it('hoists the team imports above every class', () => {
    const wrapped = wrapForExecution(fn, 'java', solution);
    expect(wrapped.lastIndexOf('import ')).toBeLessThan(wrapped.indexOf('public class Main'));
  });

  it('does not repeat an import the harness already has', () => {
    const wrapped = wrapForExecution(fn, 'java', solution);
    expect(wrapped.split('import java.util.*;').length - 1).toBe(1);
  });

  it('still sandwiches the team code for every other language', () => {
    for (const language of ['cpp', 'c', 'python', 'javascript'] as const) {
      const wrapped = wrapForExecution(fn, language, 'MARKER');
      // Prelude before, harness main after — the order Java is the exception to.
      expect(wrapped.startsWith('MARKER')).toBe(false);
      expect(wrapped.trimEnd().endsWith('MARKER')).toBe(false);
    }
  });
});
