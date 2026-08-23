import {
  BookOpen, Brain, Bug, Code2, Flame, Moon, Mountain, Pickaxe, Puzzle,
  ScrollText, Sparkles, Terminal, TreePine, type LucideIcon,
} from 'lucide-react';
import { ROUND_CONFIGS } from '@/lib/gameplay/round-config';
import { GUARDIANS, type GuardianName } from '@/lib/gameplay/guardians/config';
import { CRAFT_RECIPES } from '@/lib/gameplay/crafting/rules';

/**
 * Everything the round shells used to hardcode to Round 1.
 *
 * `CustomRoundShell` takes a `roundId` but drew the Forest biome, the Forest
 * Guardian's rewards, the Wooden Pickaxe recipe and a fixed Crossword/Aptitude/
 * Output tab strip no matter which round it was rendering — so Round 3 showed
 * Round 1's economy over Round 3's questions. Everything here is derived from the
 * same catalogs the server grades against.
 */

export type ResourceKey = 'wood' | 'stone' | 'iron' | 'gold' | 'diamond' | 'emerald' | 'obsidian';

export const RESOURCE_META: Array<{ key: ResourceKey; label: string; icon: string }> = [
  { key: 'wood', label: 'Wood', icon: '/wood.svg' },
  { key: 'stone', label: 'Stone', icon: '/stone.svg' },
  { key: 'iron', label: 'Iron', icon: '/iron.svg' },
  { key: 'gold', label: 'Gold', icon: '/gold.svg' },
  { key: 'diamond', label: 'Diamond', icon: '/diamond.svg' },
  { key: 'emerald', label: 'Emerald', icon: '/emerald.svg' },
  { key: 'obsidian', label: 'Obsidian', icon: '/obsidian.svg' },
];

const RESOURCE_BY_KEY = new Map(RESOURCE_META.map((meta) => [meta.key, meta]));

/** `pays` as the UI renders it, in the fixed inventory order rather than key order. */
export function payoutList(pays: Record<string, number> | null | undefined) {
  if (!pays) return [];
  return RESOURCE_META
    .filter((meta) => Number(pays[meta.key] ?? 0) !== 0)
    .map((meta) => ({ ...meta, amount: Number(pays[meta.key]) }));
}

export function payoutText(pays: Record<string, number> | null | undefined) {
  const parts = payoutList(pays).map(({ amount, label }) => `${amount > 0 ? '+' : ''}${amount} ${label}`);
  return parts.length > 0 ? parts.join(', ') : null;
}

/** Reward/penalty objects from the guardian catalog use the same shape. */
export function deltaList(delta: Record<string, number | undefined>) {
  return RESOURCE_META
    .filter((meta) => Number(delta[meta.key] ?? 0) !== 0)
    .map((meta) => ({ ...meta, amount: Number(delta[meta.key]) }));
}

export function deltaText(delta: Record<string, number | undefined>) {
  return deltaList(delta)
    .map(({ amount, label }) => `${amount > 0 ? '+' : '−'}${Math.abs(amount)} ${label}`)
    .join(', ');
}

export function resourceMeta(key: string) {
  return RESOURCE_BY_KEY.get(key as ResourceKey);
}

// ------------------------------------------------------------------ questions

export interface ShellQuestion {
  id: string;
  type: string;
  title?: string;
  prompt: string;
  content: unknown;
  order_index: number;
  submission_status: string | null;
  submission_revision?: number | null;
  submitted_code?: string | null;
  submitted_language?: string | null;
  coding_evaluation?: {
    kind: 'coding_evaluation';
    status: 'completed' | 'runner_error';
    sample_passed: number;
    sample_total: number;
    hidden_passed: number;
    hidden_total: number;
    total_passed: number;
    total_cases: number;
    evaluated_at: string;
  } | null;
  language_options?: string[];
  /** Worked examples for a coding question. Never the hidden grading cases. */
  sample_test_cases?: Array<{ stdin: string; stdout: string; explanation?: string }>;
  pays?: Record<string, number>;
  language_prompts?: Record<string, string>;
  /** Function contract for a coding question; null for stdin/stdout ones. */
  fn_contract?: import('@/lib/gameplay/code/contract').FnContract | null;
}

const QUESTION_TYPE_META: Record<string, { label: string; Icon: LucideIcon }> = {
  crossword: { label: 'Crosswords', Icon: BookOpen },
  aptitude: { label: 'Aptitude', Icon: Brain },
  output: { label: 'Output prediction', Icon: Terminal },
  debugging: { label: 'Debugging', Icon: Bug },
  code_completion: { label: 'Code completion', Icon: ScrollText },
  coding: { label: 'Coding', Icon: Code2 },
  logic_puzzle: { label: 'Logic puzzles', Icon: Puzzle },
  debug_output: { label: 'Debug & output', Icon: Bug },
};

/**
 * The per-language prompt variants a coding question carries, if any.
 *
 * `content` is a jsonb column, so it arrives as `unknown` and the shape has to
 * be checked rather than asserted. That check lived in three copies — one in
 * each shell and one in the guardian arena — each casting through `any`, which
 * is how three call sites end up disagreeing about the fallback without anyone
 * noticing. The shape check is here; the fallback stays at the call site,
 * because the shells genuinely want different ones.
 *
 * Live data: 60 questions across rounds 1, 2, 3 and 5 carry one, each with all
 * five runtimes (c, cpp, java, python, javascript).
 */
export function languagePrompts(question: { content: unknown }): Record<string, string> | null {
  const content = question.content;
  if (!content || typeof content !== 'object') return null;

  const prompts = (content as { language_prompts?: unknown }).language_prompts;
  if (!prompts || typeof prompts !== 'object') return null;

  const usable: Record<string, string> = {};
  for (const [language, prompt] of Object.entries(prompts as Record<string, unknown>)) {
    // A blank variant would render an empty question. Dropping it here lets
    // every caller's `??` fall through to the generic prompt instead.
    if (typeof prompt === 'string' && prompt.trim()) usable[language] = prompt;
  }

  return Object.keys(usable).length ? usable : null;
}

/** Types whose answer is code, where the picker chooses what actually compiles. */
const CODE_ANSWER_TYPES = ['coding', 'code_completion'];

/**
 * Whether to offer the language picker for a question.
 *
 * Both shells hardcoded the same list of five types. That list was a stand-in
 * for "has something to switch between", and it was wrong in both directions:
 * it excluded the six `aptitude` questions that carry all five variants, so
 * their language could never be changed, and it would have offered a picker on
 * a question with a single body.
 *
 * Asking the question itself is the fix. A coding question always offers one —
 * the choice is the compile target, whether or not the prompt varies — and
 * anything else offers one only when there is more than one body to show.
 */
export function offersLanguageChoice(question: { type: string; content: unknown }): boolean {
  if (CODE_ANSWER_TYPES.includes(question.type)) return true;
  const prompts = languagePrompts(question);
  return Boolean(prompts && Object.keys(prompts).length > 1);
}

export function questionTypeLabel(type: string) {
  return QUESTION_TYPE_META[type]?.label ?? type.replace(/_/g, ' ');
}

export interface QuestionTab {
  id: string;
  label: string;
  Icon: LucideIcon;
  questions: ShellQuestion[];
}

/**
 * One tab per question type actually present, ordered by where that type first
 * appears in the round. A round with no questions gets no tabs, which is what
 * Round 4 needs — its hour is entirely off-platform.
 */
export function buildQuestionTabs(questions: ShellQuestion[]): QuestionTab[] {
  const byType = new Map<string, ShellQuestion[]>();
  for (const question of [...questions].sort((a, b) => a.order_index - b.order_index)) {
    const bucket = byType.get(question.type);
    if (bucket) bucket.push(question);
    else byType.set(question.type, [question]);
  }

  return [...byType.entries()].map(([type, group]) => ({
    id: type,
    label: QUESTION_TYPE_META[type]?.label ?? questionTypeLabel(type),
    Icon: QUESTION_TYPE_META[type]?.Icon ?? BookOpen,
    questions: group,
  }));
}

/**
 * A code block needs a monospace block of its own; prose does not.
 *
 * The two subscript/member forms are not decoration. `backup["gold"] = 5` and
 * `spare.append(4)` are top-level statements with no leading indent, no
 * trailing semicolon and no keyword, so the earlier rule read them as prose —
 * which split the reference-semantics questions' listings into three blocks
 * with two sentences of body text stranded in the middle of the program.
 */
export function isCodeLine(line: string) {
  return /^\s{2,}|[{};]\s*$|^\s*(?:\d+\s{2,}|[#/]{2}|def |class |for |while |if |int |print\(|cout|return |import |public |values? =|\w+\s*\[[^\]]*\]\s*=|\w+(?:\.\w+)+\s*\(|\w+ = )/.test(line);
}

/**
 * Splits a prompt into prose and code blocks so the UI can render code in a real
 * code block instead of one undifferentiated wall of monospace text.
 */
export function promptBlocks(prompt: string): Array<{ kind: 'text' | 'code'; body: string }> {
  const lines = String(prompt ?? '').split('\n');
  const blocks: Array<{ kind: 'text' | 'code'; body: string[] }> = [];

  for (const line of lines) {
    const kind: 'text' | 'code' = isCodeLine(line) ? 'code' : 'text';
    const last = blocks[blocks.length - 1];
    // A blank line inside a block belongs to that block, not to a new one.
    if (last && (last.kind === kind || line.trim() === '')) last.body.push(line);
    else blocks.push({ kind, body: [line] });
  }

  return blocks
    .map((block) => ({ kind: block.kind, body: block.body.join('\n').replace(/^\n+|\n+$/g, '') }))
    .filter((block) => block.body.trim().length > 0);
}

export interface ExtractedCode {
  /** The listing with any baked-in line numbers removed. */
  code: string;
  /** The fence's language tag, when the prompt carried one. */
  language: string | null;
  /** True when the source numbered its own lines, so a viewer must not double them. */
  wasNumbered: boolean;
  /** Prose before and after the listing, kept so the question still reads. */
  intro: string;
  outro: string;
}

/** `1   int main() {` — a listing that numbers itself, as the debugging bank does. */
const NUMBERED_LINE = /^\s*(\d+)(?:\s{2,}|\t|\s*$)/;

/**
 * Removes the self-numbered gutter without eating the code's own indentation.
 *
 * `line.replace(NUMBERED_LINE, '')` looked equivalent and was not: `\s{2,}` is
 * greedy, so on `3       if value % 4 == 0:` it swallowed the number *and* all
 * seven following spaces, leaving `if value % 4 == 0:` flush against the
 * margin. Every numbered listing rendered flat — merely ugly in C++ and Java,
 * but a Python listing came out as code that cannot run and whose loop bodies
 * are indistinguishable from its top level.
 *
 * The bank pads the gutter to a fixed width (`1   `, `10  `), so the column the
 * code starts in is the narrowest one any numbered row uses. Cutting exactly
 * that many characters leaves every relative indent intact.
 */
function stripGutter(lines: string[]): string[] {
  const starts = lines
    .map((line) => /^\s*\d+\s+\S/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => match[0].length - 1);

  // A listing of nothing but bare numbers has no column to measure; the digits
  // are all there is to remove.
  if (starts.length === 0) return lines.map((line) => line.replace(/^\s*\d+\s*/, ''));

  const digitsEnd = lines.reduce((widest, line) => Math.max(widest, /^\s*\d+/.exec(line)?.[0].length ?? 0), 0);
  // Never cut into a line number, however the gutter is padded.
  const gutter = Math.max(Math.min(...starts), digitsEnd);

  return lines.map((line) => (NUMBERED_LINE.test(line) ? line.slice(gutter) : line));
}

/**
 * Pulls the code listing out of a question prompt.
 *
 * The bank writes code three different ways: fenced with a language tag and
 * self-numbered lines (debugging), unfenced and unnumbered (code completion,
 * debug output), and not at all (aptitude). This finds whichever is there.
 *
 * The numbering is the interesting part. Those digits are *text* — the prompt
 * literally contains "7       for (int i = 0; ...", which is why the rendered
 * listing looks like a paste rather than code, and why nothing can highlight or
 * address a line. Stripping them lets a real editor put real line numbers in a
 * gutter, and `wasNumbered` tells the caller the question means to talk about
 * lines at all.
 *
 * Returns null rather than guessing when there is no listing worth showing —
 * one stray indented sentence is prose, not a program.
 */
export function extractCodeBlock(prompt: string): ExtractedCode | null {
  const source = String(prompt ?? '');

  const fenced = source.match(/```([A-Za-z+#]*)\s*\n([\s\S]*?)```/);
  let body: string;
  let language: string | null = null;
  let intro: string;
  let outro: string;

  if (fenced) {
    language = fenced[1]?.trim() ? fenced[1].trim().toLowerCase() : null;
    body = fenced[2];
    intro = source.slice(0, fenced.index ?? 0);
    outro = source.slice((fenced.index ?? 0) + fenced[0].length);
  } else {
    // No fence: fall back to the same prose/code split the plain renderer uses,
    // and take the longest run of code lines.
    const blocks = promptBlocks(source);
    const codeBlocks = blocks.filter((block) => block.kind === 'code');
    if (codeBlocks.length === 0) return null;

    const largest = codeBlocks.reduce((a, b) => (b.body.split('\n').length > a.body.split('\n').length ? b : a));
    if (largest.body.split('\n').length < 3) return null;

    body = largest.body;
    const at = source.indexOf(body);
    intro = at >= 0 ? source.slice(0, at) : '';
    outro = at >= 0 ? source.slice(at + body.length) : '';
  }

  const lines = body.replace(/^\n+|\n+$/g, '').split('\n');
  if (lines.length < 2) return null;

  // Only treat the digits as numbering when most of the listing agrees. One
  // line starting with a number is a statement; ten in sequence is a gutter.
  const numbered = lines.filter((line) => NUMBERED_LINE.test(line)).length;
  const wasNumbered = numbered >= Math.max(2, Math.ceil(lines.length * 0.6));

  const code = (wasNumbered ? stripGutter(lines) : lines).join('\n');

  return {
    code: code.replace(/\s+$/, ''),
    language,
    wasNumbered,
    intro: intro.replace(/```[A-Za-z+#]*\s*$/, '').trim(),
    outro: outro.replace(/^```/, '').trim(),
  };
}

// --------------------------------------------------------------- round chrome

interface RoundChrome {
  name: string;
  eyebrow: string;
  day: string;
  mode: string;
  Icon: LucideIcon;
  themeClass: string;
  guardianArt: string | null;
  eventArt: string | null;
  eventIdleText: string;
}

const CHROME: Record<number, Omit<RoundChrome, 'name'>> = {
  // The screening qualifier. Not a game round — it runs before the event and has
  // no biome, guardian or economy — but it is proctored through the same gate,
  // so it needs a palette entry for the gate to theme itself with.
  0: {
    eyebrow: 'SCREENING', day: 'Qualifier', mode: 'Online', Icon: Moon, themeClass: 'round-ui--night',
    guardianArt: null, eventArt: null,
    eventIdleText: 'The world is dark. Only the qualifier stands between you and the event.',
  },
  1: {
    eyebrow: 'ROUND 1', day: 'Day 1', mode: 'Online', Icon: TreePine, themeClass: 'round-ui--forest',
    guardianArt: '/round1/guardian-forest.webp', eventArt: '/round1/event-heavy-rain.webp',
    eventIdleText: 'The forest is calm. Organizers announce world events.',
  },
  2: {
    eyebrow: 'ROUND 2', day: 'Day 1', mode: 'Online', Icon: Pickaxe, themeClass: 'round-ui--cave',
    guardianArt: '/round2/guardian-skeleton-archer.webp', eventArt: '/round2/event-fertile-marsh.webp',
    eventIdleText: 'The cave is quiet. Organizers announce world events.',
  },
  3: {
    eyebrow: 'ROUND 3', day: 'Day 1', mode: 'Elimination', Icon: Mountain, themeClass: 'round-ui--mountain',
    guardianArt: '/round3/guardian-blaze.webp', eventArt: '/round3/event-gold-rush.webp',
    eventIdleText: 'The peaks are still. Organizers announce world events.',
  },
  4: {
    eyebrow: 'ROUND 4', day: 'Day 2', mode: 'Off-platform', Icon: Flame, themeClass: 'round-ui--nether',
    guardianArt: null, eventArt: null,
    eventIdleText: 'This round is run by the volunteers in the hall.',
  },
  5: {
    eyebrow: 'ROUND 5', day: 'Day 2', mode: 'Final', Icon: Sparkles, themeClass: 'round-ui--end',
    guardianArt: null, eventArt: null,
    eventIdleText: 'The End is silent. Organizers announce world events.',
  },
};

export function roundChrome(roundId: number): RoundChrome {
  const config = ROUND_CONFIGS[roundId];
  const chrome = CHROME[roundId] ?? CHROME[1];
  // The screening has no ROUND_CONFIGS entry — it has no objective, guardian or
  // craft — so "Round 0" would be the fallback. Name it properly.
  const fallback = roundId === 0 ? 'Screening Round' : `Round ${roundId}`;
  return { name: config?.name ?? fallback, ...chrome };
}

export function roundObjective(roundId: number) {
  return ROUND_CONFIGS[roundId]?.objective ?? null;
}

/** The guardian for this round, with its real rewards — or null if it has none. */
export function roundGuardian(roundId: number) {
  const entry = ROUND_CONFIGS[roundId]?.guardian;
  if (!entry) return null;

  const config = GUARDIANS[entry.name as GuardianName];
  const label = entry.name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    name: entry.name as GuardianName,
    label,
    mandatory: entry.mandatory,
    reward: config.victoryReward as Record<string, number>,
    penalty: config.defeatPenalty as Record<string, number>,
    rewardText: deltaText(config.victoryReward),
    penaltyText: deltaText(config.defeatPenalty),
    timeLimitSeconds: config.timeLimitSeconds,
  };
}

/** The progression item craftable in this round, with its real recipe. */
export function roundCraft(roundId: number) {
  const item = ROUND_CONFIGS[roundId]?.craft;
  if (!item) return null;

  const recipe = CRAFT_RECIPES[item];
  return {
    item: recipe.item,
    label: recipe.label,
    cost: recipe.base_cost as Record<string, number>,
    costText: Object.entries(recipe.base_cost)
      .map(([key, value]) => `${value} ${resourceMeta(key)?.label ?? key}`)
      .join(' + '),
    unlockRoundId: recipe.unlock_round_id,
  };
}

/** Whether PvP is enabled for this round. */
export function roundPvp(roundId: number) {
  return ROUND_CONFIGS[roundId]?.pvp ?? false;
}

/**
 * The choice event that resolves in this round, if any.
 *
 * `end_merchant` is deliberately not in the Day 1 CHOICES catalog — it has its
 * own Day 2 route and its own panel — so callers switch on the key rather than
 * handing it to ChoicePanel, which cannot serve it.
 */
export function roundChoice(roundId: number) {
  return ROUND_CONFIGS[roundId]?.choice ?? null;
}
