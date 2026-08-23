/**
 * The language-model half of automatic grading.
 *
 * Two jobs, both of which exist because a string comparison cannot do them:
 *
 *   - `rescueFreeText` — a team wrote "the sack labelled MIX" and the answer key
 *     lists "mix", "the mix", "mix sack". They are right and the key cannot say
 *     so, because nobody can enumerate every phrasing of a sentence.
 *   - `gradeCode` — a submission that failed some hidden tests still contains
 *     work, and the event pays partial credit for it.
 *
 * Two rules shape everything here.
 *
 * **The model never overrules the answer key.** `rescueFreeText` is only ever
 * called after `checkDeterministicAnswer` has already returned false, and it is
 * given the accepted answers so its judgement is "does this mean the same as one
 * of these" rather than "is this correct". An open-ended grader asked to mark a
 * puzzle it has not solved will confidently mark a wrong answer right; asked
 * whether two short strings mean the same thing, it is reliable. Numeric answers
 * never reach it at all — see `isFixedAnswerKey`.
 *
 * **A provider failure is not a wrong answer.** Every function returns null when
 * the key is missing, the call fails, or the reply does not parse. The caller
 * parks those in `manual_review`, which an organiser can settle by hand. Scoring
 * them zero would silently rob teams on the one path where nobody is watching.
 */

import { z } from 'zod';
import type { ExpectedAnswer } from './deterministic';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

/** Judgement in [0,1] plus one line a human can audit it by. */
export interface LlmVerdict {
  score: number;
  reasoning: string;
}

const verdictSchema = z.object({
  score: z.number().min(0).max(1),
  reasoning: z.string().max(600).optional(),
});

export function isLlmConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

/**
 * One Groq call, returning null on any failure at all.
 *
 * Timed out deliberately: this runs inside a team pressing "Submit section" and
 * waiting on the button. A provider hanging must cost them a few seconds and a
 * manual review, never the round.
 */
async function ask(system: string, user: unknown, timeoutMs = 12_000): Promise<LlmVerdict | null> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);

  try {
    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: abort.signal,
      body: JSON.stringify({
        model: process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL,
        response_format: { type: 'json_object' },
        // Two graders looking at the same answer must not disagree, and a team
        // re-submitting must not get a different mark for identical work.
        temperature: 0,
        max_tokens: 400,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(user) },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`[grading/llm] provider returned ${response.status}`);
      return null;
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return null;

    const parsed = verdictSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      console.error('[grading/llm] reply did not match the expected shape');
      return null;
    }

    return { score: parsed.data.score, reasoning: parsed.data.reasoning ?? '' };
  } catch (error) {
    console.error('[grading/llm] call failed:', error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Every accepted answer the key lists, flattened for display to the model. */
export function acceptedAnswers(expected: ExpectedAnswer): string[] {
  if (expected === null || expected === undefined) return [];
  if (typeof expected === 'string' || typeof expected === 'number') return [String(expected)];
  if (Array.isArray(expected.any_of)) return expected.any_of.map(String);
  if (expected.value !== undefined && expected.value !== null) return [String(expected.value)];
  return [];
}

/**
 * Whether this key is settled by comparison alone.
 *
 * A key counts as fixed when every accepted answer is a number, optionally with
 * a unit after it — "17", "17 minutes", "48 kg", "5 4". Those are the questions
 * the brief says never to send to the model, and rightly: an arithmetic puzzle
 * has one answer, the key already holds it, and asking a model whether 240 is
 * 240 adds nothing but a way to be wrong.
 *
 * Word and phrase answers are the opposite case. "mix", "queue", "the sack
 * labelled mix" can each be written a dozen ways, so a failed comparison there
 * is genuinely ambiguous and worth a second opinion.
 */
export function isFixedAnswerKey(expected: ExpectedAnswer): boolean {
  const candidates = acceptedAnswers(expected);
  if (candidates.length === 0) return false;
  return candidates.every((candidate) => /^[^A-Za-z]*\d[\d\s,.\-/:]*[A-Za-z%°]{0,12}$/.test(candidate.trim()));
}

/**
 * Second opinion on a free-text answer the key rejected.
 *
 * The model is shown the accepted answers and asked only whether the team's
 * answer means the same thing. It is not asked to solve the question — it does
 * not need to, because the key already contains the solution.
 */
export async function rescueFreeText(params: {
  prompt: string;
  accepted: string[];
  answer: string;
}): Promise<LlmVerdict | null> {
  if (params.accepted.length === 0) return null;
  if (!params.answer.trim()) return { score: 0, reasoning: 'No answer given.' };

  return ask(
    [
      'You are marking one short answer in a Minecraft-themed coding contest.',
      'You are given the accepted answers. Decide only whether the submitted answer means the SAME THING as one of them.',
      'Ignore spelling, capitalisation, articles, units and extra words around the answer.',
      'Score 1 when it clearly matches an accepted answer, 0 when it does not, and something in between only when it is partially right.',
      'Do NOT try to solve the question yourself, and never accept an answer that contradicts every accepted answer.',
      'Reply with JSON only: {"score": number between 0 and 1, "reasoning": "one short sentence"}.',
    ].join(' '),
    { question: params.prompt, accepted_answers: params.accepted, submitted_answer: params.answer },
  );
}

/**
 * Marks an open-ended answer against a rubric, for questions with no key at all.
 */
export async function gradeOpenEnded(params: {
  prompt: string;
  rubric: unknown;
  answer: string;
}): Promise<LlmVerdict | null> {
  if (!params.answer.trim()) return { score: 0, reasoning: 'No answer given.' };

  return ask(
    [
      'You are marking one open-ended answer in a Minecraft-themed coding contest.',
      'Judge how completely the answer solves what the question asks, using the rubric when one is given.',
      'Be fair but strict: reward correct reasoning, not length or confidence.',
      'Reply with JSON only: {"score": number between 0 and 1, "reasoning": "one short sentence"}.',
    ].join(' '),
    { question: params.prompt, rubric: params.rubric ?? null, submitted_answer: params.answer },
  );
}

/**
 * Marks code that did not pass every hidden test.
 *
 * Code that passes everything never gets here — that is settled by the judge and
 * paid in full. This is the partial-credit path, so the model is told how the
 * tests actually went and asked to weigh the logic, which stops it from being
 * talked into a high score by code that plainly does not run.
 */
export async function gradeCode(params: {
  prompt: string;
  language: string;
  code: string;
  passed: number;
  total: number;
}): Promise<LlmVerdict | null> {
  if (!params.code.trim()) return { score: 0, reasoning: 'No code submitted.' };

  const ratio = params.total > 0 ? params.passed / params.total : 0;

  return ask(
    [
      'You are marking one coding answer in a Minecraft-themed contest.',
      'The code has already been run against hidden tests and the results are given to you.',
      'Judge how correct the solution logic is: does it implement the right approach, and how far is it from passing everything?',
      'The test results are evidence you must respect — code that passes no tests cannot score above 0.4 no matter how it reads,',
      'and code that passes most of them but has one edge-case bug deserves a high score.',
      'Ignore style, comments and naming. Judge only correctness of the logic.',
      'Reply with JSON only: {"score": number between 0 and 1, "reasoning": "one short sentence"}.',
    ].join(' '),
    {
      question: params.prompt,
      language: params.language,
      submitted_code: params.code.slice(0, 12_000),
      hidden_tests_passed: params.passed,
      hidden_tests_total: params.total,
      pass_rate: Number(ratio.toFixed(3)),
    },
    20_000,
  );
}
