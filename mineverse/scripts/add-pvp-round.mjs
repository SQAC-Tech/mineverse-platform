#!/usr/bin/env node
/**
 * Sets up the running order for day 1: Round 3, then the duel.
 *
 * Three writes, all idempotent:
 *
 *   1. Round 3 is given 90 minutes and stops being the PvP round — the duel is
 *      its own round now, so Round 3 is earn, trade and craft, nothing else.
 *   2. `rounds` gains id 6, "The Duel", day 1, sequence 4. Six rather than four
 *      so the Day 2 rounds keep their ids — `DAY_TWO_ROUNDS`, the attendance
 *      checkpoints and every `covers_rounds` array are written in terms of them.
 *   3. The Round 3 checkpoint (`DAY1_R3`) gains 6 in `covers_rounds`, so the
 *      scan a team already had at that desk admits it to the duel as well.
 *      There is no second desk and no second scan.
 *
 * No `team_round_access` rows are created, on purpose. The duel carries no
 * unlock: `verifyTeamRoundAccess` skips the per-team check for it and asks
 * instead whether the round is running, whether the team has the Iron Armor,
 * and whether it was marked present for Round 3.
 *
 * It is created `locked`. An organiser starts it from the admin panel when
 * Round 3 closes, and that is the moment ENTER PVP appears on every dashboard.
 *
 *   node scripts/add-pvp-round.mjs [--dry-run]
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');

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
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set.');
  process.exit(1);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

async function rest(path, init = {}) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, { ...init, headers: { ...headers, ...init.headers } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const DUEL_ROUND_ID = 6;
const ROUND_3_MINUTES = 90;

const DUEL = {
  id: DUEL_ROUND_ID,
  name: 'The Duel',
  day: 1,
  sequence: 4,
  description:
    'Head-to-head PvP. Automatic pairing by academic year and standing. Winners take the Nether Portal materials.',
  // The clock on one duel, not on the phase. Mirrors `PVP_DURATION_SECONDS`.
  time_allotted: 10,
  status: 'locked',
};

const [round3] = await rest('rounds?id=eq.3&select=id,time_allotted');
if (!round3) {
  console.error('rounds: no Round 3 found — nothing to schedule the duel after.');
  process.exit(1);
}

if (round3.time_allotted === ROUND_3_MINUTES) {
  console.log(`rounds: Round 3 already set to ${ROUND_3_MINUTES} minutes, left alone.`);
} else if (DRY_RUN) {
  console.log(`rounds: would set Round 3 time_allotted ${round3.time_allotted} -> ${ROUND_3_MINUTES}`);
} else {
  await rest('rounds?id=eq.3', {
    method: 'PATCH',
    body: JSON.stringify({ time_allotted: ROUND_3_MINUTES }),
    headers: { Prefer: 'return=minimal' },
  });
  console.log(`rounds: Round 3 time_allotted ${round3.time_allotted} -> ${ROUND_3_MINUTES}`);
}

const existing = await rest(`rounds?id=eq.${DUEL_ROUND_ID}&select=id,name,status`);
if (existing.length > 0) {
  console.log(`rounds: id ${DUEL_ROUND_ID} already exists — "${existing[0].name}" (${existing[0].status}), left alone.`);
} else if (DRY_RUN) {
  console.log(`rounds: would insert ${JSON.stringify(DUEL)}`);
} else {
  await rest('rounds', { method: 'POST', body: JSON.stringify(DUEL), headers: { Prefer: 'return=minimal' } });
  console.log(`rounds: inserted id ${DUEL_ROUND_ID} "The Duel" (locked).`);
}

const [checkpoint] = await rest('attendance_checkpoints?code=eq.DAY1_R3&select=id,code,label,covers_rounds');
if (!checkpoint) {
  console.error('attendance_checkpoints: no DAY1_R3 row found — cannot admit teams to the duel.');
  process.exit(1);
}

if (checkpoint.covers_rounds?.includes(DUEL_ROUND_ID)) {
  console.log(`${checkpoint.code}: already covers round ${DUEL_ROUND_ID}, left alone.`);
} else {
  const covers = [...(checkpoint.covers_rounds ?? []), DUEL_ROUND_ID];
  if (DRY_RUN) {
    console.log(`${checkpoint.code}: would set covers_rounds = ${JSON.stringify(covers)}`);
  } else {
    await rest(`attendance_checkpoints?id=eq.${checkpoint.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ covers_rounds: covers }),
      headers: { Prefer: 'return=minimal' },
    });
    console.log(`${checkpoint.code}: covers_rounds -> ${JSON.stringify(covers)}`);
  }
}

const marked = await rest(`attendance_records?checkpoint_id=eq.${checkpoint.id}&select=team_id`);
const armored = await rest('crafting_log?item=eq.iron_armor&select=team_id');

console.log(`\n${marked.length} team(s) marked at ${checkpoint.code}.`);
console.log(`${armored.length} team(s) hold the Iron Armor — those are the ones who can enter the duel.`);
if (DRY_RUN) console.log('Dry run — nothing was written.');
