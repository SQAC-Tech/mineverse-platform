import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { promptBlocks } from '../../../components/game/custom-round-ui/round-presentation';

/**
 * The round UI splits a prompt into prose and code so the code keeps its
 * indentation instead of being reflowed as a paragraph. The split is a heuristic,
 * so it is checked against every seeded question rather than a handmade sample.
 */

const SEED_DIR = resolve(__dirname, '../../../supabase/seed');

function seededPrompts(): Array<{ where: string; prompt: string }> {
  if (!existsSync(SEED_DIR)) return [];
  const prompts: Array<{ where: string; prompt: string }> = [];

  for (const file of readdirSync(SEED_DIR).filter((name) => name.endsWith('.json'))) {
    const parsed = JSON.parse(readFileSync(resolve(SEED_DIR, file), 'utf8'));
    for (const question of parsed.questions ?? []) {
      const prompt = Array.isArray(question.prompt) ? question.prompt.join('\n') : String(question.prompt ?? '');
      prompts.push({ where: `${file} #${question.order_index} ${question.title ?? ''}`, prompt });
    }
  }
  return prompts;
}

describe('promptBlocks', () => {
  it('keeps a code listing in one block with its indentation intact', () => {
    const blocks = promptBlocks(
      [
        'int saplings = 0;',
        'for (int i = 1; i <= 10; i++) {',
        '    if (i % 3 == 0) {',
        '        saplings = saplings + i / 2;',
        '    }',
        '}',
        'cout << saplings;',
        '',
        'All the variables are integers.',
        'What does this program print?',
      ].join('\n'),
    );

    const code = blocks.filter((block) => block.kind === 'code');
    expect(code).toHaveLength(1);
    expect(code[0].body).toContain('        saplings = saplings + i / 2;');
    expect(blocks.at(-1)?.kind).toBe('text');
    expect(blocks.at(-1)?.body).toContain('What does this program print?');
  });

  it('leaves a prose-only prompt as a single text block', () => {
    const blocks = promptBlocks(
      'There are 8 sacks of stone. Their average weight is 45 kg.\nHow many kilograms does the new sack weigh?',
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('text');
  });

  it('never drops a non-blank line from any seeded prompt', () => {
    const prompts = seededPrompts();
    // The seed files are gitignored (they hold every answer key), so a checkout
    // without them skips this rather than failing.
    if (prompts.length === 0) return;

    for (const { where, prompt } of prompts) {
      const rebuilt = promptBlocks(prompt)
        .map((block) => block.body)
        .join('\n');

      for (const line of prompt.split('\n')) {
        if (line.trim().length === 0) continue;
        expect(rebuilt, `lost a line from ${where}`).toContain(line.trim());
      }
    }
  });
});
