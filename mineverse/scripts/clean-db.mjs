#!/usr/bin/env node
/**
 * clean-db.mjs — purge every team's data except the ones you keep (default MNV-000).
 *
 *   node scripts/clean-db.mjs                  # dry run, shows what would be deleted
 *   node scripts/clean-db.mjs --confirm        # actually deletes
 *   node scripts/clean-db.mjs --keep=MNV-000,MNV-093 --confirm
 *   node scripts/clean-db.mjs --wipe-config --confirm   # ALSO wipes rounds/questions/checkpoints
 *
 * Deletes are ordered children-first so the NO ACTION foreign keys
 * (crafting_log/grading_items/manual_adjustments/offline_results -> resource_ledger,
 * item_uses -> transactions) never trip. Cascades would mostly handle this, but doing it
 * explicitly gives a per-table count and survives future FK changes.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (read from .env.local).
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------- env + args

function loadEnvLocal() {
  let raw;
  try {
    raw = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
  } catch {
    return; // fall back to whatever is already in process.env
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
const wipeConfig = args.includes('--wipe-config');
const keepCodes = (args.find((a) => a.startsWith('--keep='))?.slice('--keep='.length) ?? 'MNV-000')
  .split(',')
  .map((c) => c.trim().toUpperCase())
  .filter(Boolean);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (checked .env.local).');
  process.exit(1);
}

/**
 * On 16 Aug 2026 this script ran against production because `.env.local` happened
 * to hold the live credentials — 52 teams, 210 members and every payment record
 * went with it, and the project had no backup to restore from.
 *
 * So production is refused by default. Pointing `.env.local` at the live project
 * is no longer enough to arm this thing; you have to say so on the command line
 * and then type the project ref back at the prompt.
 */
const PRODUCTION_REF = 'cmfhvvgsdwvsbsbwyhqo';
const targetRef = new URL(url).hostname.split('.')[0];
const isProduction = targetRef === PRODUCTION_REF;
const allowProduction = args.includes('--allow-production');

if (isProduction && !allowProduction) {
  console.error(`\n  REFUSING TO RUN — ${url} is the production project.\n`);
  console.error('  Point .env.local at a local or branch database, or, if you genuinely');
  console.error('  mean to wipe production, re-run with --allow-production and be ready');
  console.error(`  to type the project ref (${PRODUCTION_REF}) to confirm.\n`);
  process.exit(1);
}
if (!keepCodes.length) {
  console.error('--keep cannot be empty. Pass at least one team code.');
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// ------------------------------------------------------------------ helpers

const die = (label, error) => {
  console.error(`\n  ${label} failed: ${error.message}`);
  process.exit(1);
};

/** Rows in `table` whose `column` is one of `ids`. Returns a count. */
async function countIn(table, column, ids) {
  const { count, error } = await db
    .from(table)
    .select('*', { count: 'exact', head: true })
    .in(column, ids);
  if (error) die(`count ${table}`, error);
  return count ?? 0;
}

async function deleteIn(table, column, ids) {
  const { error } = await db.from(table).delete().in(column, ids);
  if (error) die(`delete ${table}`, error);
}

const fmt = (table, n) => `  ${table.padEnd(32)} ${String(n).padStart(6)}`;

// ------------------------------------------------------------ deletion plan

/**
 * Team-scoped tables, children before parents. `grading_items` has no team_id —
 * it hangs off submissions, so it is resolved separately below.
 */
const TEAM_TABLES = [
  'structure_repairs',
  'structures',
  'item_uses',
  'guardian_battles',
  'choice_decisions',
  'team_event_effects',
  'offline_results',
  'manual_adjustments',
  'crafting_log',
  'pvp_match_submissions',
  'pvp_match_teams',
  'transactions',
  'resource_ledger',
  'resources',
  'team_game_state',
  'attendance_records',
  'team_round_access',
  'otp_challenges',
  'payments',
  'email_logs',
  'members',
];

/** rounds/questions/checkpoints — only touched with --wipe-config. */
const CONFIG_TABLES = ['attendance_checkpoints', 'rounds'];

// ---------------------------------------------------------------------- run

async function main() {
  const { data: allTeams, error: teamsError } = await db
    .from('teams')
    .select('id, team_code, team_name')
    .order('team_code');
  if (teamsError) die('load teams', teamsError);

  const keep = allTeams.filter((t) => keepCodes.includes(t.team_code.toUpperCase()));
  const drop = allTeams.filter((t) => !keepCodes.includes(t.team_code.toUpperCase()));

  const missing = keepCodes.filter((c) => !keep.some((t) => t.team_code.toUpperCase() === c));
  if (missing.length) {
    console.error(`\nTeam code(s) not found in DB: ${missing.join(', ')}`);
    console.error('Refusing to run — a typo here would delete the team you meant to keep.');
    process.exit(1);
  }

  console.log(`\nSupabase: ${url}`);
  console.log(`\nKEEP  (${keep.length}):`);
  for (const t of keep) console.log(`  ${t.team_code}  ${t.team_name}`);
  console.log(`\nDELETE (${drop.length}):`);
  for (const t of drop) console.log(`  ${t.team_code}  ${t.team_name}`);

  if (!drop.length && !wipeConfig) {
    console.log('\nNothing to delete. Done.');
    return;
  }

  const dropIds = drop.map((t) => t.id);

  // Submissions are needed twice: to count/delete grading_items, then themselves.
  let submissionIds = [];
  if (dropIds.length) {
    const { data, error } = await db.from('submissions').select('id').in('team_id', dropIds);
    if (error) die('load submissions', error);
    submissionIds = data.map((s) => s.id);
  }

  // ------------------------------------------------------------ dry-run report
  console.log('\nRows to delete:');
  let total = 0;

  const plan = [];

  if (dropIds.length) {
    plan.push({ label: 'grading_items', run: () => deleteIn('grading_items', 'submission_id', submissionIds), count: submissionIds.length ? await countIn('grading_items', 'submission_id', submissionIds) : 0 });
    plan.push({ label: 'submissions', run: () => deleteIn('submissions', 'team_id', dropIds), count: await countIn('submissions', 'team_id', dropIds) });

    // pvp_results points at teams twice (winner + loser).
    const { count: pvpResults, error: pvpError } = await db
      .from('pvp_results')
      .select('*', { count: 'exact', head: true })
      .or(`winner_team_id.in.(${dropIds.join(',')}),loser_team_id.in.(${dropIds.join(',')})`);
    if (pvpError) die('count pvp_results', pvpError);
    plan.push({
      label: 'pvp_results',
      count: pvpResults ?? 0,
      run: async () => {
        const { error } = await db
          .from('pvp_results')
          .delete()
          .or(`winner_team_id.in.(${dropIds.join(',')}),loser_team_id.in.(${dropIds.join(',')})`);
        if (error) die('delete pvp_results', error);
      },
    });

    for (const table of TEAM_TABLES) {
      plan.push({
        label: table,
        count: await countIn(table, 'team_id', dropIds),
        run: () => deleteIn(table, 'team_id', dropIds),
      });
    }

    // email_logs with a null team_id are orphans from failed/registration-less sends.
    const { count: orphanEmails, error: orphanError } = await db
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .is('team_id', null);
    if (orphanError) die('count orphan email_logs', orphanError);
    plan.push({
      label: 'email_logs (no team)',
      count: orphanEmails ?? 0,
      run: async () => {
        const { error } = await db.from('email_logs').delete().is('team_id', null);
        if (error) die('delete orphan email_logs', error);
      },
    });

    plan.push({
      label: 'teams',
      count: dropIds.length,
      run: () => deleteIn('teams', 'id', dropIds),
    });
  }

  if (wipeConfig) {
    for (const table of CONFIG_TABLES) {
      // Select the ids rather than an unfiltered delete: id types differ per table
      // (int vs uuid) and PostgREST refuses a delete with no filter.
      const { data, error } = await db.from(table).select('id');
      if (error) die(`count ${table}`, error);
      const ids = data.map((row) => row.id);
      plan.push({
        label: `${table} (config)`,
        count: ids.length,
        run: () => deleteIn(table, 'id', ids),
      });
    }
  }

  for (const step of plan) {
    if (step.count > 0) console.log(fmt(step.label, step.count));
    total += step.count;
  }
  console.log(`  ${'—'.repeat(32)} ${'—'.repeat(6)}`);
  console.log(fmt('TOTAL', total));

  if (wipeConfig) {
    console.log('\n  !! --wipe-config also deletes rounds + checkpoints. That cascades into the');
    console.log(`     KEPT team's team_round_access, submissions and questions too.`);
  }

  if (!confirm) {
    console.log('\nDry run — nothing deleted. Re-run with --confirm to apply.\n');
    return;
  }

  // ------------------------------------------------------------- snapshot
  // Taken before anything is touched, so a mistaken run is still recoverable
  // from disk even when the project has no database backup behind it.
  if (dropIds.length) {
    const [{ data: teamRows }, { data: memberRows }, { data: paymentRows }] = await Promise.all([
      db.from('teams').select('*').in('id', dropIds),
      db.from('members').select('*').in('team_id', dropIds),
      db.from('payments').select('*').in('team_id', dropIds),
    ]);

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotPath = resolve(ROOT, `clean-db-snapshot-${stamp}.json`);
    writeFileSync(
      snapshotPath,
      JSON.stringify(
        { taken_at: new Date().toISOString(), supabase_url: url, teams: teamRows ?? [], members: memberRows ?? [], payments: paymentRows ?? [] },
        null,
        2,
      ),
    );
    console.log(`\n  Snapshot written: ${snapshotPath}`);
    console.log(`  ${teamRows?.length ?? 0} teams, ${memberRows?.length ?? 0} members, ${paymentRows?.length ?? 0} payments.`);
  }

  // --------------------------------------------------------------- execute
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  if (isProduction) {
    const ref = await rl.question(`\nThis is PRODUCTION. Type the project ref (${PRODUCTION_REF}) to continue: `);
    if (ref.trim() !== PRODUCTION_REF) {
      rl.close();
      console.log('Aborted.\n');
      return;
    }
  }

  const answer = await rl.question(`\nType DELETE to permanently remove ${total} rows: `);
  rl.close();
  if (answer.trim() !== 'DELETE') {
    console.log('Aborted.\n');
    return;
  }

  console.log('');
  for (const step of plan) {
    if (step.count === 0) continue;
    await step.run();
    console.log(`  deleted ${step.label} (${step.count})`);
  }

  // ---------------------------------------------------------------- verify
  const { data: left, error: leftError } = await db.from('teams').select('team_code').order('team_code');
  if (leftError) die('verify teams', leftError);
  console.log(`\nDone. Teams remaining: ${left.map((t) => t.team_code).join(', ') || '(none)'}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
