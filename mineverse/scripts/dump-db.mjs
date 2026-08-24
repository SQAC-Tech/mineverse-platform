#!/usr/bin/env node
/**
 * Dumps every public table to JSON on disk.
 *
 * There is no `pg_dump` on this machine and the Supabase CLI wants the database
 * password, which is not in `.env.local` — only the service-role key is. So the
 * dump goes through PostgREST with that key, which reaches every row of every
 * table because the service role bypasses RLS.
 *
 * ## Where it writes, and why not into the repo
 *
 * Outside the working tree by default. This file contains every answer key
 * (`questions.expected_answer`, `hidden_test_cases`) and every participant's
 * email and phone number. `supabase/seed/*.json` is gitignored for the first
 * reason alone; a backup that landed in the repo would be worse, because it
 * carries the second as well. Override with `--out <dir>` if you must, but do
 * not point it inside a git repository.
 *
 * ## Pagination
 *
 * A page boundary is only meaningful against a stable sort, and Postgres is
 * free to return rows in any order without one — so page two could repeat or
 * skip rows from page one. The sort key is discovered per table from the first
 * row, preferring a primary-key-ish column, and a table with none of them is
 * fetched in a single request and flagged if it fills the page.
 *
 * Usage:
 *   node scripts/dump-db.mjs [--out <dir>]
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PAGE = 1000;
/** First match wins. Ordering by any of these is stable enough to page on. */
const SORT_PREFERENCE = ['id', 'team_id', 'created_at', 'marked_at', 'crafted_at'];

function loadEnv() {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) {
    console.error('No .env.local found. Run this from the mineverse app directory.');
    process.exit(1);
  }
  const env = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (match) env[match[1]] = match[2];
  }
  return env;
}

const env = loadEnv();
const BASE = (env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!BASE || !KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set in .env.local.');
  process.exit(1);
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' };

const outFlag = process.argv.indexOf('--out');
const stamp = new Date().toISOString().slice(0, 10);
const OUT = outFlag !== -1 && process.argv[outFlag + 1]
  ? resolve(process.argv[outFlag + 1])
  : resolve(process.cwd(), '..', '..', `mineverse-db-backup-${stamp}`);

async function get(path) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

/**
 * Every table PostgREST exposes.
 *
 * Read from the OpenAPI document it serves at the root, so the list cannot
 * drift from what actually exists the way a hardcoded one would.
 */
async function listTables() {
  const spec = await get('');
  return Object.keys(spec.definitions ?? spec.components?.schemas ?? {}).sort();
}

async function dumpTable(table) {
  const first = await get(`${table}?select=*&limit=1`);
  if (first.length === 0) return { rows: [], sortedBy: null, truncated: false };

  const columns = Object.keys(first[0]);
  const sortKey = SORT_PREFERENCE.find((candidate) => columns.includes(candidate)) ?? null;

  if (!sortKey) {
    // Nothing safe to page on: take one large bite and say so if it fills up.
    const rows = await get(`${table}?select=*&limit=${PAGE * 50}`);
    return { rows, sortedBy: null, truncated: rows.length === PAGE * 50 };
  }

  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await get(`${table}?select=*&order=${sortKey}.asc&limit=${PAGE}&offset=${offset}`);
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return { rows, sortedBy: sortKey, truncated: false };
}

const tables = await listTables();
mkdirSync(join(OUT, 'tables'), { recursive: true });

console.log(`Dumping ${tables.length} tables from ${BASE}`);
console.log(`  -> ${OUT}\n`);

const manifest = { taken_at: new Date().toISOString(), source: BASE, tables: {} };
let total = 0;
const problems = [];

for (const table of tables) {
  try {
    const { rows, sortedBy, truncated } = await dumpTable(table);
    writeFileSync(join(OUT, 'tables', `${table}.json`), JSON.stringify(rows, null, 2));
    manifest.tables[table] = { rows: rows.length, sorted_by: sortedBy, truncated };
    total += rows.length;
    if (truncated) problems.push(`${table}: possibly truncated (no stable sort key)`);
    console.log(`  ${String(rows.length).padStart(6)}  ${table}${truncated ? '  [TRUNCATED?]' : ''}`);
  } catch (error) {
    manifest.tables[table] = { rows: 0, error: String(error) };
    problems.push(`${table}: ${error}`);
    console.log(`  ${'ERR'.padStart(6)}  ${table} — ${error}`);
  }
}

// The API's own description of every table and column: a schema record that
// costs nothing extra and cannot drift from what was dumped.
writeFileSync(join(OUT, 'openapi.json'), JSON.stringify(await get(''), null, 2));
manifest.total_rows = total;
manifest.problems = problems;
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`\n${total} rows across ${tables.length} tables.`);
if (problems.length > 0) console.log(`${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
console.log(`\nContains answer keys and participant contact details. Keep it out of git.`);
