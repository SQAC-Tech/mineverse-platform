#!/usr/bin/env node
/**
 * export-questions.mjs — write the live `questions` table back out to
 * supabase/seed/round-N.json.
 *
 *   node scripts/export-questions.mjs              # every round, to stdout summary
 *   node scripts/export-questions.mjs --round=3    # one round
 *   node scripts/export-questions.mjs --check      # fail if the files are stale
 *
 * This exists because the seed files silently fell behind the database once
 * already. `sample_test_cases` and a fifth language were added straight to the
 * live rows and never written back, so the JSON that *looked* authoritative
 * described a question bank two features out of date — and re-running the
 * seeder from it would have deleted the live grading cases.
 *
 * The rule this restores: the seed files are a checked-in mirror of the live
 * table. Edit them, seed them, and export again; or edit live and export. Never
 * assume.
 *
 * `--check` is the guard rail. Run it before `seed-questions.mjs --confirm` and
 * it refuses to let you seed from a file that would throw live data away.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEED_DIR = resolve(ROOT, 'supabase/seed');
const ALL_ROUNDS = [1, 2, 3, 5];

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
const check = args.includes('--check');
const roundArg = args.find((a) => a.startsWith('--round='))?.slice('--round='.length);
const rounds = roundArg ? roundArg.split(',').map((r) => Number(r.trim())).filter(Boolean) : ALL_ROUNDS;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (checked .env.local).');
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

/**
 * A prompt is stored as one string but written back as an array of lines.
 *
 * Multi-line prompts full of `\n` are unreviewable in a diff — a one-word fix
 * shows up as the whole question changing. As an array, a reworded line is a
 * one-line diff.
 */
function splitPrompt(prompt) {
  const lines = String(prompt ?? '').split('\n');
  return lines.length === 1 ? lines[0] : lines;
}

/** Drops keys the seeder treats as absent, so the files stay readable. */
function compact(entry) {
  const out = {};
  for (const [key, value] of Object.entries(entry)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) continue;
    out[key] = value;
  }
  return out;
}

/** Live row -> seed-file entry, in a fixed key order so diffs stay small. */
function toEntry(row) {
  return compact({
    order_index: row.order_index,
    type: row.type,
    title: row.content?.title ?? null,
    variant_group: row.variant_group,
    guardian_name: row.guardian_name,
    logic_puzzle_variant: row.logic_puzzle_variant,
    reward: row.reward,
    auto_grade_strategy: row.auto_grade_strategy,
    language_options: row.language_options,
    time_limit_seconds: row.time_limit_seconds,
    prompt: splitPrompt(row.prompt),
    // `title` is lifted out of content above; anything else in there is real
    // question data and has to survive the round trip.
    content: Object.fromEntries(Object.entries(row.content ?? {}).filter(([key]) => key !== 'title')),
    expected_answer: row.expected_answer,
    sample_test_cases: row.sample_test_cases,
    hidden_test_cases: row.hidden_test_cases,
    rubric: row.rubric,
  });
}

function countsFor(entries) {
  const counts = {};
  for (const entry of entries) {
    const bucket = entry.guardian_name ? 'guardian' : entry.type;
    counts[bucket] = (counts[bucket] ?? 0) + 1;
  }
  return counts;
}

let stale = 0;

for (const roundId of rounds) {
  const { data, error } = await db
    .from('questions')
    .select('*')
    .eq('round_id', roundId)
    .order('order_index', { ascending: true });
  if (error) throw error;

  const path = resolve(SEED_DIR, `round-${roundId}.json`);
  const previous = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  const entries = (data ?? []).map(toEntry);

  const file = {
    round_id: roundId,
    round_name: previous.round_name ?? `Round ${roundId}`,
    source: previous.source ?? 'exported from the live database',
    // Recomputed rather than carried over: a stale expectation that matches
    // nothing is worse than none, and the seeder warns on a mismatch.
    expected_counts: countsFor(entries),
    questions: entries,
  };

  const next = `${JSON.stringify(file, null, 2)}\n`;
  const current = existsSync(path) ? readFileSync(path, 'utf8') : '';

  if (check) {
    if (next !== current) {
      stale += 1;
      console.error(`  STALE  round-${roundId}.json does not match the live table`);
    } else {
      console.log(`  ok     round-${roundId}.json`);
    }
    continue;
  }

  writeFileSync(path, next);
  const slots = new Set(entries.map((entry) => entry.variant_group ?? `#${entry.order_index}`)).size;
  console.log(`  wrote  round-${roundId}.json — ${entries.length} row(s), ${slots} slot(s)`);
}

if (check && stale > 0) {
  console.error(`\n${stale} seed file(s) are behind the database. Run without --check to refresh them.`);
  process.exit(1);
}

console.log(check ? '\nSeed files match the database.' : '\nDone.');
