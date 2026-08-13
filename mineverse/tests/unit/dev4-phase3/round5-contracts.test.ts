import { describe, expect, it } from 'vitest';
import { getRoundConfig, ROUND_CONFIGS } from '../../../lib/gameplay/round-config';
import { serializeSafeQuestion, questionTypes } from '../../../lib/gameplay/questions/contracts';

describe('Dev4 Phase 3 — Round 5 config', () => {
  it('has a Round 5 entry with correct properties', () => {
    const cfg = getRoundConfig(5);
    expect(cfg).not.toBeNull();
    expect(cfg!.id).toBe(5);
    expect(cfg!.name).toBe('The End');
    expect(cfg!.biome).toBe('end');
    expect(cfg!.craft).toBe('diamond_pickaxe');
    expect(cfg!.guardian).toBeNull(); // Final Boss is Dev 3's domain
    expect(cfg!.marketplace).toBe(true);
    expect(cfg!.pvp).toBe(false);
    expect(cfg!.structures).toEqual([]);
  });

  it('Round 5 does not assign a guardian (Final Boss is Dev 3)', () => {
    expect(ROUND_CONFIGS[5].guardian).toBeNull();
  });
});

describe('Dev4 Phase 3 — Round 5 question types', () => {
  it('question type array includes logic_puzzle and debug_output', () => {
    expect(questionTypes).toContain('logic_puzzle');
    expect(questionTypes).toContain('debug_output');
  });

  it('Round 5 question count fixture matches event spec: 3 coding + 2 logic_puzzle + 2 debug_output = 7', () => {
    const fixtures = [
      ...Array.from({ length: 3 }, () => ({ round_id: 5, type: 'coding' })),
      ...Array.from({ length: 2 }, () => ({ round_id: 5, type: 'logic_puzzle' })),
      ...Array.from({ length: 2 }, () => ({ round_id: 5, type: 'debug_output' })),
    ];

    expect(fixtures.length).toBe(7);

    const count = (type: string) => fixtures.filter((q) => q.type === type).length;
    expect(count('coding')).toBe(3);
    expect(count('logic_puzzle')).toBe(2);
    expect(count('debug_output')).toBe(2);
  });

  it('serializes logic_puzzle questions without leaking secrets', () => {
    const unsafe = {
      id: '00000000-0000-4000-8000-000000000010',
      round_id: 5,
      type: 'logic_puzzle' as const,
      prompt: 'Solve the N-Queens puzzle',
      content: { variant: 'n_queens', board_size: 8 },
      order_index: 4,
      language_options: [],
      time_limit_seconds: null,
      // Secrets that must never appear in output
      expected_answer: { solution: [[0, 1], [1, 3]] },
      rubric: { full_marks: 'correct placement' },
      hidden_test_cases: [{ input: '8', expected: '92' }],
      reward: { diamond: 10, emerald: 3 },
      logic_puzzle_variant: 'n_queens',
    };

    const safe = serializeSafeQuestion(unsafe as any, { status: 'submitted', revision: 1, final_score: null });
    const raw = JSON.stringify(safe);

    expect(raw).toContain('Solve the N-Queens puzzle');
    expect(raw).not.toContain('expected_answer');
    expect(raw).not.toContain('hidden_test_cases');
    expect(raw).not.toContain('rubric');
    expect(raw).not.toContain('reward');
    expect(raw).not.toContain('solution');
  });

  it('serializes debug_output questions without leaking secrets', () => {
    const unsafe = {
      id: '00000000-0000-4000-8000-000000000011',
      round_id: 5,
      type: 'debug_output' as const,
      prompt: 'What does this code print?',
      content: { code_snippet: 'console.log(1+1)' },
      order_index: 6,
      language_options: ['javascript'],
      time_limit_seconds: 300,
      expected_answer: { output: '2' },
      rubric: { partial: false },
      hidden_test_cases: [],
      reward: { diamond: 10, emerald: 2 },
    };

    const safe = serializeSafeQuestion(unsafe as any, null);
    const raw = JSON.stringify(safe);

    expect(raw).toContain('What does this code print?');
    expect(raw).not.toContain('expected_answer');
    expect(raw).not.toContain('rubric');
    expect(raw).not.toContain('reward');
  });
});
