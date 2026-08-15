#!/usr/bin/env node
/**
 * seed-screening.mjs — load supabase/seed/screening.json into `screening_questions`.
 *
 *   node scripts/seed-screening.mjs             # dry run
 *   node scripts/seed-screening.mjs --confirm   # write it
 *   node scripts/seed-screening.mjs --confirm --prune
 *   node scripts/seed-screening.mjs --confirm --force
 *
 * Rows match on `order_index`, the table's unique key, so a re-run updates in
 * place and keeps ids — every sealed paper pointing at a question stays valid.
 *
 * --prune removes rows the JSON no longer lists, refusing any that a team has
 *   already been dealt.
 * --force allows writing once attempts exist. Without it the script stops:
 *   editing a question after a team answered it changes what they were graded on.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (read from .env.local).
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEED_FILE = resolve(ROOT, 'supabase/seed/screening.json');

const DIFFICULTIES = ['easy', 'medium', 'hard'];
// Mirrors DRAW_MIX in lib/screening/config.ts. Duplicated because this script is
// plain node with no TS pipeline; the check below fails loudly if they drift.
const REQUIRED = { easy: 10, medium: 10, hard: 5 };

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
const CONFIRM = args.includes('--confirm');
const PRUNE = args.includes('--prune');
const FORCE = args.includes('--force');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

/**
 * Postgres reorders jsonb keys shortest-first, so a plain JSON.stringify of a
 * round-tripped row never matches the source and every re-run reports a false
 * "update". Comparing on sorted keys is what makes the dry run trustworthy.
 */
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function validate(questions) {
  const errors = [];
  const seen = new Set();
  const counts = { easy: 0, medium: 0, hard: 0 };

  for (const q of questions) {
    const at = `order_index ${q.order_index}`;
    if (!Number.isInteger(q.order_index)) errors.push(`${at}: order_index must be an integer`);
    if (seen.has(q.order_index)) errors.push(`${at}: duplicate order_index`);
    seen.add(q.order_index);

    if (!DIFFICULTIES.includes(q.difficulty)) errors.push(`${at}: bad difficulty "${q.difficulty}"`);
    else counts[q.difficulty] += 1;

    if (typeof q.prompt !== 'string' || !q.prompt.trim()) errors.push(`${at}: empty prompt`);
    if (!Array.isArray(q.options) || q.options.length !== 4) errors.push(`${at}: needs exactly 4 options`);
    else {
      if (q.options.some((o) => typeof o !== 'string' || !o.trim())) errors.push(`${at}: blank option`);
      if (new Set(q.options.map((o) => String(o).trim().toLowerCase())).size !== 4) {
        errors.push(`${at}: two options are the same`);
      }
    }
    if (!Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index > 3) {
      errors.push(`${at}: correct_index must be 0-3`);
    }
  }

  // A bank that cannot fill the draw is the failure that would only surface at
  // 00:01 on the 22nd, when the first team tries to start.
  for (const difficulty of DIFFICULTIES) {
    if (counts[difficulty] < REQUIRED[difficulty]) {
      errors.push(
        `bank has ${counts[difficulty]} ${difficulty} questions but every paper needs ${REQUIRED[difficulty]}`,
      );
    }
  }

  return { errors, counts };
}

async function main() {
  const raw = JSON.parse(readFileSync(SEED_FILE, 'utf8'));
  const questions = raw.questions ?? [];

  const { errors, counts } = validate(questions);
  if (errors.length > 0) {
    console.error(`\n${errors.length} problem(s) in ${SEED_FILE}:`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  const { count: attemptCount } = await db
    .from('screening_attempts')
    .select('id', { count: 'exact', head: true });

  if (attemptCount > 0 && !FORCE) {
    console.error(
      `\n${attemptCount} team(s) have already been dealt a paper. Editing the bank now changes\n` +
      `what they were graded against. Re-run with --force if that is genuinely what you want.`,
    );
    process.exit(1);
  }

  const { data: existing, error } = await db
    .from('screening_questions')
    .select('id, order_index, difficulty, topic, prompt, options, correct_index, explanation');
  if (error) throw error;

  const byIndex = new Map((existing ?? []).map((row) => [row.order_index, row]));

  const inserts = [];
  const updates = [];
  for (const q of questions) {
    const row = {
      order_index: q.order_index,
      difficulty: q.difficulty,
      topic: q.topic ?? null,
      prompt: q.prompt,
      options: q.options,
      correct_index: q.correct_index,
      explanation: q.explanation ?? null,
    };
    const current = byIndex.get(q.order_index);
    if (!current) {
      inserts.push(row);
      continue;
    }
    const before = stableStringify({
      order_index: current.order_index, difficulty: current.difficulty, topic: current.topic,
      prompt: current.prompt, options: current.options, correct_index: current.correct_index,
      explanation: current.explanation,
    });
    if (before !== stableStringify(row)) updates.push({ ...row, id: current.id });
  }

  const wanted = new Set(questions.map((q) => q.order_index));
  const orphans = (existing ?? []).filter((row) => !wanted.has(row.order_index));

  console.log(`\nBank: ${questions.length} questions — ${counts.easy} easy / ${counts.medium} medium / ${counts.hard} hard`);
  console.log(`Draw needs: ${REQUIRED.easy} / ${REQUIRED.medium} / ${REQUIRED.hard} per team`);
  console.log(`\n  insert ${inserts.length}`);
  console.log(`  update ${updates.length}`);
  console.log(`  ${PRUNE ? 'delete' : 'orphan'} ${orphans.length}${orphans.length && !PRUNE ? '  (pass --prune to remove)' : ''}`);

  if (!CONFIRM) {
    console.log('\nDry run. Nothing written. Re-run with --confirm.\n');
    return;
  }

  if (inserts.length > 0) {
    const { error: insertError } = await db.from('screening_questions').insert(inserts);
    if (insertError) throw insertError;
  }
  for (const row of updates) {
    const { id, ...rest } = row;
    const { error: updateError } = await db.from('screening_questions').update(rest).eq('id', id);
    if (updateError) throw updateError;
  }
  if (PRUNE && orphans.length > 0) {
    const { error: deleteError } = await db
      .from('screening_questions')
      .delete()
      .in('id', orphans.map((row) => row.id));
    if (deleteError) throw deleteError;
  }

  const { count: total } = await db
    .from('screening_questions')
    .select('id', { count: 'exact', head: true });
  console.log(`\nDone. screening_questions now holds ${total} rows.\n`);
}

main().catch((error) => {
  console.error('\nSeeding failed:', error.message ?? error);
  process.exit(1);
});
