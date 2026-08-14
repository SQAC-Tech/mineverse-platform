#!/usr/bin/env node
/**
 * seed-questions.mjs — load the question bank from supabase/seed/round-N.json into
 * the `questions` table.
 *
 *   node scripts/seed-questions.mjs                     # dry run, every round
 *   node scripts/seed-questions.mjs --round=1           # dry run, one round
 *   node scripts/seed-questions.mjs --round=1 --confirm # write it
 *   node scripts/seed-questions.mjs --round=3 --confirm --prune
 *   node scripts/seed-questions.mjs --round=1 --confirm --force
 *
 * Rows are matched on (round_id, order_index), which is the table's unique key, so
 * re-running is safe: an existing question is updated in place and keeps its id,
 * and every submission pointing at it stays valid.
 *
 * --prune deletes rows in that round that the JSON no longer lists. It refuses to
 *   delete anything a team has already answered.
 * --force allows writing to a round that already has submissions. Without it the
 *   script stops, because editing a question mid-event changes what a team was
 *   graded against.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (read from .env.local).
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEED_DIR = resolve(ROOT, 'supabase/seed');
const ALL_ROUNDS = [1, 2, 3, 5]; // Round 4 is the portal repair — no platform questions.

const QUESTION_TYPES = [
  'crossword', 'aptitude', 'output', 'debugging', 'code_completion',
  'coding', 'pvp', 'logic_puzzle', 'debug_output',
];
const GUARDIAN_NAMES = ['forest_guardian', 'skeleton_archer', 'blaze_guardian'];
const PUZZLE_VARIANTS = ['n_queens', 'missionaries_cannibals', 'tower_of_hanoi', 'sudoku_logic'];
const RESOURCES = ['wood', 'stone', 'iron', 'gold', 'diamond', 'emerald', 'obsidian'];

// ---------------------------------------------------------------- env + args

function loadEnvLocal() {
  let raw;
  try {
    raw = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    if (!(match[1] in process.env)) process.env[match[1]] = value;
  }
}

loadEnvLocal();

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const prune = args.includes('--prune');
const force = args.includes('--force');
const roundArg = args.find((a) => a.startsWith('--round='))?.slice('--round='.length);
const rounds = roundArg
  ? roundArg.split(',').map((r) => Number(r.trim())).filter(Boolean)
  : ALL_ROUNDS;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (checked .env.local).');
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

// ---------------------------------------------------------------- helpers

/** A prompt may be a plain string or an array of lines, which is easier to edit. */
function joinPrompt(prompt) {
  return Array.isArray(prompt) ? prompt.join('\n') : String(prompt ?? '');
}

/**
 * Only the columns that exist on `questions`.
 *
 * `title` has no column of its own, so it rides along inside `content`, which the
 * API already passes through to the browser. The round UI uses it to label list
 * items and tabs — a prompt that opens with a code block makes a useless label.
 */
function toRow(question, roundId) {
  return {
    round_id: roundId,
    order_index: question.order_index,
    type: question.type,
    prompt: joinPrompt(question.prompt),
    content: {
      ...(question.content ?? {}),
      ...(question.title ? { title: question.title } : {}),
    },
    reward: question.reward ?? {},
    expected_answer: question.expected_answer ?? null,
    hidden_test_cases: question.hidden_test_cases ?? null,
    rubric: question.rubric ?? null,
    guardian_name: question.guardian_name ?? null,
    logic_puzzle_variant: question.logic_puzzle_variant ?? null,
    language_options: question.language_options ?? [],
    time_limit_seconds: question.time_limit_seconds ?? null,
    auto_grade_strategy: question.auto_grade_strategy ?? null,
  };
}

function validate(file, roundId) {
  const errors = [];
  const warnings = [];
  const seen = new Set();

  if (file.round_id !== roundId) {
    errors.push(`round_id in the file is ${file.round_id}, expected ${roundId}`);
  }
  if (!Array.isArray(file.questions) || file.questions.length === 0) {
    errors.push('no questions in the file');
    return { errors, warnings };
  }

  for (const q of file.questions) {
    const at = `order_index ${q.order_index} (${q.title ?? 'untitled'})`;

    if (!Number.isInteger(q.order_index) || q.order_index < 1) {
      errors.push(`${at}: order_index must be a positive whole number`);
    }
    if (seen.has(q.order_index)) {
      errors.push(`${at}: duplicate order_index — the table's unique key would reject it`);
    }
    seen.add(q.order_index);

    if (!QUESTION_TYPES.includes(q.type)) {
      errors.push(`${at}: type "${q.type}" is not one of ${QUESTION_TYPES.join(', ')}`);
    }
    if (joinPrompt(q.prompt).trim().length === 0) {
      errors.push(`${at}: empty prompt`);
    }
    if (q.guardian_name && !GUARDIAN_NAMES.includes(q.guardian_name)) {
      errors.push(`${at}: guardian_name "${q.guardian_name}" is not a known guardian`);
    }
    if (q.logic_puzzle_variant && !PUZZLE_VARIANTS.includes(q.logic_puzzle_variant)) {
      errors.push(`${at}: logic_puzzle_variant "${q.logic_puzzle_variant}" is not allowed`);
    }

    for (const [key, value] of Object.entries(q.reward ?? {})) {
      if (!RESOURCES.includes(key)) errors.push(`${at}: reward key "${key}" is not a resource`);
      if (!Number.isInteger(value) || value < 0) errors.push(`${at}: reward.${key} must be a whole number >= 0`);
    }

    // Guardian and PvP rewards are paid by their own resolver, not by the grading
    // run. A reward here would pay a team twice.
    const rewardCount = Object.keys(q.reward ?? {}).length;
    if ((q.guardian_name || q.type === 'pvp') && rewardCount > 0) {
      errors.push(`${at}: guardian/pvp questions must have an empty reward — the battle resolver pays it`);
    }
    if (!q.guardian_name && q.type !== 'pvp' && rewardCount === 0) {
      warnings.push(`${at}: no reward — a correct answer will pay the team nothing`);
    }

    if (q.expected_answer !== null && q.expected_answer !== undefined) {
      const hasKey =
        typeof q.expected_answer === 'string' ||
        typeof q.expected_answer === 'number' ||
        (Array.isArray(q.expected_answer.any_of) && q.expected_answer.any_of.length > 0) ||
        q.expected_answer.value !== undefined;
      if (!hasKey) errors.push(`${at}: expected_answer has no value/any_of — it would never match`);
    } else if (q.auto_grade_strategy === 'deterministic') {
      errors.push(`${at}: marked deterministic but has no expected_answer`);
    } else if (!(q.type === 'coding' && (q.hidden_test_cases ?? []).length > 0)) {
      // A coding question is graded by running its hidden test cases, so it does
      // not need a text answer key — anything else without one is hand-graded.
      warnings.push(`${at}: no answer key — every submission goes to manual review`);
    }

    if (['coding', 'code_completion'].includes(q.type) && (q.language_options ?? []).length === 0) {
      warnings.push(`${at}: no language_options — the UI submits a null language`);
    }
  }

  const counts = {};
  for (const q of file.questions) {
    const bucket = q.guardian_name ? 'guardian' : q.type;
    counts[bucket] = (counts[bucket] ?? 0) + 1;
  }
  for (const [bucket, expected] of Object.entries(file.expected_counts ?? {})) {
    if ((counts[bucket] ?? 0) !== expected) {
      warnings.push(`count check: ${bucket} is ${counts[bucket] ?? 0}, the event doc says ${expected}`);
    }
  }

  return { errors, warnings };
}

/**
 * Postgres does not preserve jsonb key order — it stores keys shortest-first, so
 * `{"stone":8,"iron":2}` reads back as `{"iron":2,"stone":8}`. Sorting keys before
 * comparing keeps the dry run from reporting an unchanged row as an update.
 */
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function sameRow(existing, next) {
  const keys = Object.keys(next).filter((k) => k !== 'round_id' && k !== 'order_index');
  return keys.every((key) => stableStringify(existing[key]) === stableStringify(next[key]));
}

// ---------------------------------------------------------------- per round

async function seedRound(roundId) {
  const path = resolve(SEED_DIR, `round-${roundId}.json`);
  console.log(`\n=== Round ${roundId} ===`);

  if (!existsSync(path)) {
    console.log(`  no seed file at supabase/seed/round-${roundId}.json — skipped`);
    return { ok: true, written: 0 };
  }

  const file = JSON.parse(readFileSync(path, 'utf8'));
  const { errors, warnings } = validate(file, roundId);

  for (const warning of warnings) console.log(`  warn:  ${warning}`);
  if (errors.length > 0) {
    for (const error of errors) console.error(`  ERROR: ${error}`);
    return { ok: false, written: 0 };
  }

  const { data: round, error: roundError } = await db
    .from('rounds').select('id, name, status').eq('id', roundId).maybeSingle();
  if (roundError) throw roundError;
  if (!round) {
    console.error(`  ERROR: rounds has no row with id ${roundId}. Questions reference it by`);
    console.error('         foreign key, so the insert cannot run until that row exists.');
    return { ok: false, written: 0 };
  }

  const { count: submissionCount, error: countError } = await db
    .from('submissions').select('id', { count: 'exact', head: true }).eq('round_id', roundId);
  if (countError) throw countError;

  if (submissionCount > 0 && !force) {
    console.error(`  ERROR: round ${roundId} already has ${submissionCount} submission(s).`);
    console.error('         Editing a question now changes what those teams were graded against.');
    console.error('         Re-run with --force if you are sure.');
    return { ok: false, written: 0 };
  }

  const { data: existingRows, error: existingError } = await db
    .from('questions').select('*').eq('round_id', roundId);
  if (existingError) throw existingError;

  const existingByOrder = new Map((existingRows ?? []).map((row) => [row.order_index, row]));
  const rows = file.questions.map((q) => toRow(q, roundId));
  const titleByOrder = new Map(file.questions.map((q) => [q.order_index, q.title ?? '']));

  const toWrite = [];
  for (const row of rows) {
    const existing = existingByOrder.get(row.order_index);
    const action = !existing ? 'insert' : sameRow(existing, row) ? 'unchanged' : 'update';
    const label = String(row.order_index).padStart(3);
    const kind = (row.guardian_name ? `${row.type}/guardian` : row.type).padEnd(20);
    console.log(`  ${action.padEnd(9)} ${label}  ${kind} ${titleByOrder.get(row.order_index)}`);
    if (action !== 'unchanged') toWrite.push(row);
  }

  const orphans = (existingRows ?? []).filter(
    (row) => !rows.some((next) => next.order_index === row.order_index),
  );
  for (const orphan of orphans) {
    console.log(`  ${prune ? 'delete' : 'orphan'}    ${String(orphan.order_index).padStart(3)}  ${orphan.type} (not in the seed file)`);
  }

  if (!confirm) {
    console.log(`  -- dry run: ${toWrite.length} row(s) would be written${prune ? `, ${orphans.length} deleted` : ''}`);
    return { ok: true, written: 0 };
  }

  if (toWrite.length > 0) {
    const { error: upsertError } = await db
      .from('questions').upsert(toWrite, { onConflict: 'round_id,order_index' });
    if (upsertError) throw upsertError;
  }

  let deleted = 0;
  if (prune && orphans.length > 0) {
    for (const orphan of orphans) {
      const { count: answered, error: answeredError } = await db
        .from('submissions').select('id', { count: 'exact', head: true }).eq('question_id', orphan.id);
      if (answeredError) throw answeredError;
      if (answered > 0) {
        console.log(`  kept      ${String(orphan.order_index).padStart(3)}  has ${answered} submission(s), not deleted`);
        continue;
      }
      const { error: deleteError } = await db.from('questions').delete().eq('id', orphan.id);
      if (deleteError) throw deleteError;
      deleted += 1;
    }
  }

  console.log(`  -- wrote ${toWrite.length} row(s)${prune ? `, deleted ${deleted}` : ''}`);
  return { ok: true, written: toWrite.length };
}

// ---------------------------------------------------------------- main

let failed = false;
let total = 0;

for (const roundId of rounds) {
  const result = await seedRound(roundId);
  if (!result.ok) failed = true;
  total += result.written;
}

console.log(
  confirm
    ? `\nDone — ${total} row(s) written.`
    : '\nDry run only. Add --confirm to write.',
);

process.exit(failed ? 1 : 0);
