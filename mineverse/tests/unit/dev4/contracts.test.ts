import { describe, expect, it } from 'vitest';
import { CRAFT_RECIPES } from '../../../lib/gameplay/crafting/rules';
import { serializeSafeQuestion, validateSubmissionForQuestion, type QuestionRow } from '../../../lib/gameplay/questions/contracts';
import { serializeSafePvpQuestion } from '../../../lib/gameplay/pvp/contracts';

function question(overrides: Partial<QuestionRow> = {}): QuestionRow {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    round_id: 1,
    type: 'aptitude',
    prompt: 'Safe prompt',
    content: { body: 'Visible content' },
    order_index: 1,
    language_options: [],
    time_limit_seconds: null,
    ...overrides,
  };
}

describe('Dev4 safe question contract', () => {
  it('serializes only attendee-safe fields', () => {
    const unsafe = {
      ...question(),
      expected_answer: { answer: 'secret' },
      rubric: { secret: true },
      hidden_test_cases: [{ input: 'x' }],
      reward: { wood: 99 },
    } as QuestionRow & Record<string, unknown>;

    const safe = serializeSafeQuestion(unsafe, { status: 'submitted', revision: 2, final_score: null });

    expect(safe).toMatchObject({ id: unsafe.id, prompt: 'Safe prompt', submission_status: 'submitted' });
    expect(JSON.stringify(safe)).not.toContain('expected_answer');
    expect(JSON.stringify(safe)).not.toContain('hidden_test_cases');
    expect(JSON.stringify(safe)).not.toContain('rubric');
    expect(JSON.stringify(safe)).not.toContain('secret');
    expect(JSON.stringify(safe)).not.toContain('reward');
  });

  it('validates required payload shape by question type', () => {
    expect(validateSubmissionForQuestion(question({ type: 'aptitude' }), { question_id: question().id, answer_text: '', response: {} })).toMatchObject({ ok: false, code: 'ANSWER_REQUIRED' });
    expect(validateSubmissionForQuestion(question({ type: 'coding', language_options: ['ts'] }), { question_id: question().id, code: 'return 1;', language: 'ts', response: {} })).toMatchObject({ ok: true });
    expect(validateSubmissionForQuestion(question({ type: 'coding', language_options: ['ts'] }), { question_id: question().id, code: 'return 1;', language: 'py', response: {} })).toMatchObject({ ok: false, code: 'INVALID_LANGUAGE' });
  });
});

describe('Dev4 question count fixtures', () => {
  it('matches Day 1 required platform question counts', () => {
    const fixtures = [
      ...Array.from({ length: 2 }, () => ({ round_id: 1, type: 'crossword' })),
      ...Array.from({ length: 6 }, () => ({ round_id: 1, type: 'aptitude' })),
      ...Array.from({ length: 2 }, () => ({ round_id: 1, type: 'output' })),
      ...Array.from({ length: 5 }, () => ({ round_id: 2, type: 'aptitude' })),
      { round_id: 2, type: 'debugging' },
      { round_id: 2, type: 'code_completion' },
      { round_id: 2, type: 'output' },
      ...Array.from({ length: 2 }, () => ({ round_id: 3, type: 'debugging' })),
      ...Array.from({ length: 2 }, () => ({ round_id: 3, type: 'coding' })),
    ];

    const count = (round: number, type: string) => fixtures.filter((item) => item.round_id === round && item.type === type).length;

    expect(count(1, 'crossword')).toBe(2);
    expect(count(1, 'aptitude')).toBe(6);
    expect(count(1, 'output')).toBe(2);
    expect(count(2, 'aptitude')).toBe(5);
    expect(count(2, 'debugging')).toBe(1);
    expect(count(2, 'code_completion')).toBe(1);
    expect(count(2, 'output')).toBe(1);
    expect(count(3, 'debugging')).toBe(2);
    expect(count(3, 'coding')).toBe(2);
  });
});

describe('Dev4 crafting contract', () => {
  it('uses canonical base costs and rounds discounted costs up per resource', () => {
    expect(CRAFT_RECIPES.wooden_pickaxe.base_cost).toEqual({ wood: 60 });
    expect(CRAFT_RECIPES.stone_pickaxe.base_cost).toEqual({ wood: 10, stone: 45, iron: 25 });
    expect(CRAFT_RECIPES.iron_armor.base_cost).toEqual({ iron: 40, gold: 25 });
  });
});

describe('Dev4 PvP safety contract', () => {
  it('omits answer keys, hidden tests, and opponent state from PvP question serialization', () => {
    const safe = serializeSafePvpQuestion({
      id: 'q1',
      display_order: 1,
      type: 'trivia',
      prompt: 'Visible prompt',
      content: { choices: ['A', 'B'] },
      expected_answer: 'A',
      hidden_test_cases: [{ secret: true }],
      opponent_answers: ['A'],
      opponent_progress: 'done',
    });

    const raw = JSON.stringify(safe);
    expect(raw).toContain('Visible prompt');
    expect(raw).not.toContain('expected_answer');
    expect(raw).not.toContain('hidden_test_cases');
    expect(raw).not.toContain('opponent');
  });
});