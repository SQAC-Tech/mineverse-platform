/**
 * Proves the MongoDB shim behaves the way the 371 call sites expect.
 *
 * Not a unit test — it runs against the real migrated database, because the
 * things most likely to break in this port are the ones no mock would catch:
 * a date column compared as a string, two filters on one column where the
 * second overwrites the first, an idempotency key that stops stopping replays.
 *
 * Every assertion here is a bug that would have reached a team.
 *
 *   npx tsx --env-file=.env.local scripts/mongo/verify-shim.mts
 */

import { mongoPostgrest as db } from '../../lib/mongo/postgrest';
import { mongoDb } from '../../lib/mongo/client';

let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}${detail ? `  — ${detail}` : ''}`);
  }
}

const { data: team, error: teamError } = await db
  .from('teams')
  .select('id, team_code, team_name')
  .eq('team_code', 'MNV-244')
  .single();
check('single() by team_code', !teamError && team?.team_name != null, JSON.stringify(team));

const missing = await db.from('teams').select('id').eq('team_code', 'MNV-ZZZ').single();
check('single() with no rows returns PGRST116', missing.data === null && missing.error?.code === 'PGRST116', missing.error?.code);

const maybe = await db.from('teams').select('id').eq('team_code', 'MNV-ZZZ').maybeSingle();
check('maybeSingle() with no rows is null, not an error', maybe.data === null && maybe.error === null);

const { data: withMembers } = await db
  .from('teams')
  .select('team_code, members(name, is_team_lead)')
  .eq('team_code', 'MNV-244')
  .single();
check(
  'embedded children: teams -> members()',
  Array.isArray(withMembers?.members) && withMembers.members.length > 0,
  JSON.stringify(withMembers?.members?.[0]),
);

const { data: access } = await db
  .from('team_round_access')
  .select('round_id, rounds(name, status)')
  .eq('team_id', team.id)
  .order('round_id');
check('embedded parent: team_round_access -> rounds()', access.length > 0 && access[0]?.rounds?.name != null, JSON.stringify(access[0]));

const { count } = await db.from('teams').select('*', { count: 'exact', head: true });
check('count: exact with head', count === 96, String(count));

const { data: ledger } = await db
  .from('resource_ledger')
  .select('id, source_type, created_at')
  .eq('team_id', team.id)
  .order('created_at', { ascending: false })
  .limit(3);
check('order desc + limit, dates come back as Date', ledger.length <= 3 && ledger[0]?.created_at instanceof Date, `${ledger.length} rows`);

// The trap that would leave every round open forever: an ISO string compared
// against a BSON date matches nothing.
const { data: recent } = await db.from('resource_ledger').select('id').gte('created_at', '2026-08-24T00:00:00Z');
const { data: everything } = await db.from('resource_ledger').select('id');
check('gte on a date column actually filters', recent.length > 0 && recent.length < everything.length, `${recent.length}/${everything.length}`);

// The trap where the second filter overwrites the first and the window opens up.
const { data: windowed } = await db
  .from('resource_ledger')
  .select('id')
  .gte('created_at', '2026-08-24T00:00:00Z')
  .lte('created_at', '2026-08-24T01:00:00Z');
check('gte + lte on one column both apply', windowed.length < recent.length, `${windowed.length} vs ${recent.length}`);

const { data: ors } = await db.from('teams').select('team_code').or('team_code.eq.MNV-244,team_code.eq.MNV-431');
check('or() flat form', ors.length === 2, JSON.stringify(ors.map((row: { team_code: string }) => row.team_code)));

// The one that matters most: the same key twice must pay once.
const key = crypto.randomUUID();
const before = await db.from('resources').select('wood').eq('team_id', team.id).single();
const first = await db.rpc('mutate_team_resources', {
  p_team_id: team.id,
  p_delta: { wood: 7 },
  p_source_type: 'shim_verify',
  p_idempotency_key: key,
  p_reason: 'shim verification',
});
const replay = await db.rpc('mutate_team_resources', {
  p_team_id: team.id,
  p_delta: { wood: 7 },
  p_source_type: 'shim_verify',
  p_idempotency_key: key,
  p_reason: 'shim verification',
});
const after = await db.from('resources').select('wood').eq('team_id', team.id).single();

check('rpc grants exactly once', after.data.wood === before.data.wood + 7, `${before.data.wood} -> ${after.data.wood}`);
check('rpc replay returns the first ledger row', replay.data?.idempotent === true && first.data.ledger_id === replay.data.ledger_id);

const overdraft = await db.rpc('mutate_team_resources', {
  p_team_id: team.id,
  p_delta: { diamond: -99999 },
  p_source_type: 'shim_verify',
  p_idempotency_key: crypto.randomUUID(),
});
check('rpc refuses an overdraft', overdraft.error?.message === 'insufficient resources', overdraft.error?.message);

// Put the team back exactly as it was found.
const handle = await mongoDb();
await handle.collection('resource_ledger').deleteOne({ idempotency_key: key });
await handle.collection('resources').updateOne({ team_id: team.id }, { $inc: { wood: -7 } });
const restored = await db.from('resources').select('wood').eq('team_id', team.id).single();
check('test grant cleaned up', restored.data.wood === before.data.wood, `wood back to ${restored.data.wood}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
