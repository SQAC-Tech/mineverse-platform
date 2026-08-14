import { describe, expect, it } from 'vitest';
import {
  validateSubmissionForQuestion,
  serializeSafeQuestion,
  type QuestionRow,
} from '../../../lib/gameplay/questions/contracts';

function question(overrides: Partial<QuestionRow> = {}): QuestionRow {
  return {
    id: '00000000-0000-4000-8000-000000000020',
    round_id: 5,
    type: 'logic_puzzle',
    prompt: 'Safe prompt',
    content: { body: 'Visible content' },
    order_index: 1,
    language_options: [],
    time_limit_seconds: null,
    ...overrides,
  };
}

describe('Dev4 Phase 3 — logic_puzzle submission validation', () => {
  it('requires answer_text for logic_puzzle questions', () => {
    const result = validateSubmissionForQuestion(
      question({ type: 'logic_puzzle' }),
      { question_id: question().id, answer_text: '', response: {} },
    );
    expect(result).toMatchObject({ ok: false, code: 'ANSWER_REQUIRED' });
  });

  it('accepts valid answer_text for logic_puzzle', () => {
    const result = validateSubmissionForQuestion(
      question({ type: 'logic_puzzle' }),
      { question_id: question().id, answer_text: 'Q1: row 0 col 1, Q2: row 1 col 3 ...', response: {} },
    );
    expect(result).toMatchObject({ ok: true });
  });
});

describe('Dev4 Phase 3 — debug_output submission validation', () => {
  it('requires either answer_text or code for debug_output questions', () => {
    const result = validateSubmissionForQuestion(
      question({ type: 'debug_output' }),
      { question_id: question().id, answer_text: '', code: '', response: {} },
    );
    expect(result).toMatchObject({ ok: false, code: 'ANSWER_REQUIRED' });
  });

  it('accepts answer_text only for debug_output', () => {
    const result = validateSubmissionForQuestion(
      question({ type: 'debug_output' }),
      { question_id: question().id, answer_text: 'Output is 42', response: {} },
    );
    expect(result).toMatchObject({ ok: true });
  });

  it('accepts code only for debug_output', () => {
    const result = validateSubmissionForQuestion(
      question({ type: 'debug_output' }),
      { question_id: question().id, code: 'console.log(42)', response: {} },
    );
    expect(result).toMatchObject({ ok: true });
  });
});

describe('Dev4 Phase 3 — Round 5 question safety contract', () => {
  it('never exposes expected_answer, rubric or hidden_test_cases for any type', () => {
    const types: Array<QuestionRow['type']> = ['coding', 'logic_puzzle', 'debug_output'];

    for (const type of types) {
      const unsafe = {
        ...question({ type }),
        expected_answer: { answer: 'secret' },
        rubric: { criteria: 'hidden' },
        hidden_test_cases: [{ input: 'x', expected: 'y' }],
        reward: { diamond: 99 },
      } as QuestionRow & Record<string, unknown>;

      const safe = serializeSafeQuestion(unsafe, { status: 'submitted', revision: 1, final_score: null });
      const raw = JSON.stringify(safe);

      expect(raw).toContain(unsafe.prompt);
      expect(raw).not.toContain('expected_answer');
      expect(raw).not.toContain('hidden_test_cases');
      expect(raw).not.toContain('rubric');
      expect(raw).not.toContain('secret');
      expect(raw).not.toContain('criteria');
      expect(raw).not.toContain('"x"');
    }
  });

  // Payouts used to be excluded here and hardcoded in the round UI instead, which
  // meant Round 3 showed Round 1's Wood rewards. They are public — the event brief
  // prints the whole table — so the UI now reads them from the row that pays them.
  it('exposes the payout as `pays`, not as the raw column name', () => {
    const safe = serializeSafeQuestion(
      { ...question({ type: 'coding' }), reward: { diamond: 12 } },
      null,
    );

    expect(safe.pays).toEqual({ diamond: 12 });
    expect(Object.keys(safe)).not.toContain('reward');
  });

  it('falls back to a trimmed prompt line when a question has no title', () => {
    const withTitle = serializeSafeQuestion(
      { ...question(), content: { title: 'The Empty Chest' } },
      null,
    );
    expect(withTitle.title).toBe('The Empty Chest');

    const withoutTitle = serializeSafeQuestion(
      { ...question(), content: {}, prompt: 'values = [5, 3, 8, 1]\nbest = values[0]' },
      null,
    );
    expect(withoutTitle.title).toBe('values = [5, 3, 8, 1]');
  });

  it('handles null submission gracefully', () => {
    const safe = serializeSafeQuestion(question(), null);
    expect(safe.submission_status).toBeNull();
    expect(safe.submission_revision).toBeNull();
    expect(safe.graded).toBe(false);
  });
});
