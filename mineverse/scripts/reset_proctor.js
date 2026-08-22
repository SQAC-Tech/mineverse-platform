/**
 * Clears proctor strikes and re-unlocks rounds, for getting a stuck team moving
 * again during a walkthrough.
 *
 * READ THIS BEFORE RUNNING IT. There is one database and `.env.local` points at
 * it — the live event one, with every registered team in it. Unscoped, this
 * script sets `is_locked = false` on every `team_round_access` row for every
 * round, which opens rounds nobody has started yet, and resets every proctor
 * session to `active` with zero warnings, which erases the violation counts the
 * `/admin/proctor` feed is judged on. Neither is recoverable.
 *
 * So it is a dry run unless you say otherwise, and it refuses to touch the whole
 * field unless you say that too — the same shape `seed-questions.mjs` uses.
 *
 *   node scripts/reset_proctor.js --team=MNV-000            # show what it would do
 *   node scripts/reset_proctor.js --team=MNV-000 --confirm  # do it, one team
 *   node scripts/reset_proctor.js --all-teams --confirm     # do it, everyone
 */

const fs = require('fs');
const dotenv = require('dotenv');

const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const allTeams = args.includes('--all-teams');
const teamArg = args.find((a) => a.startsWith('--team='));
const teamCode = teamArg ? teamArg.split('=')[1].trim().toUpperCase() : null;

if (!teamCode && !allTeams) {
  console.error(
    'Refusing to run without a scope.\n' +
    '  --team=MNV-000   one team\n' +
    '  --all-teams      every team in the database\n',
  );
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

async function run() {
  const query = teamCode
    ? `select=id,team_code&team_code=eq.${encodeURIComponent(teamCode)}`
    : 'select=id,team_code';

  const res = await fetch(`${SUPABASE_URL}/rest/v1/teams?${query}`, { headers });
  const teams = await res.json();

  if (!Array.isArray(teams) || teams.length === 0) {
    console.error(teamCode ? `No team ${teamCode}.` : 'No teams found.');
    process.exit(1);
  }

  console.log(
    `${confirm ? 'Resetting' : 'Would reset'} ${teams.length} team(s): ` +
    `proctor strikes cleared, every round unlocked.`,
  );

  if (!confirm) {
    console.log(teams.map((t) => `  ${t.team_code}`).join('\n'));
    console.log('\nDry run only. Add --confirm to write.');
    return;
  }

  for (const team of teams) {
    console.log(`Resetting ${team.team_code}`);

    await fetch(`${SUPABASE_URL}/rest/v1/proctor_sessions?team_id=eq.${team.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'active', warning_count: 0, key_violation_count: 0 }),
    });

    await fetch(`${SUPABASE_URL}/rest/v1/team_round_access?team_id=eq.${team.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ is_locked: false }),
    });
  }

  console.log(`Done. ${teams.length} team(s) reset.`);
}

run().catch(console.error);
