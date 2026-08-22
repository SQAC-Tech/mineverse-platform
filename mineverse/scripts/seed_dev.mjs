/**
 * Creates the MNV-000 dev team and unlocks every round for it.
 *
 * `.env.local` points at the live event database, so this writes a team into the
 * same table the real 90 do. That is fine on purpose — MNV-000 is a named demo
 * code, see lib/gameplay/demo-teams.ts — but it deletes a member row and forces
 * `is_locked = false`, so it is a dry run unless told otherwise, matching
 * `seed-questions.mjs`.
 *
 *   node scripts/seed_dev.mjs             # show what it would do
 *   node scripts/seed_dev.mjs --confirm   # write it
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let raw;
try {
  raw = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
} catch {}
for (const line of (raw || '').split('\n')) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (match) process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const confirm = process.argv.slice(2).includes('--confirm');

async function seed() {
  const email = 'dev0@mineverse.test';

  if (!confirm) {
    console.log(
      'Would upsert team MNV-000 ("Dev Team", payment verified), replace the member\n' +
      `with ${email}, and unlock every round for it.\n\n` +
      'Dry run only. Add --confirm to write.',
    );
    return;
  }
  
  // 1. Delete existing member if any
  await db.from('members').delete().eq('college_email', email);

  // 2. Upsert team
  const { data: team, error: teamError } = await db.from('teams').upsert({
    team_code: 'MNV-000',
    team_name: 'Dev Team',
    team_size: 1,
    status: 'active',
    is_payment_verified: true
  }, { onConflict: 'team_code' }).select('id').single();

  if (teamError) throw teamError;

  // 3. Insert member
  const { error: memberError } = await db.from('members').insert({
    team_id: team.id,
    name: 'Dev User',
    email: email,
    college_email: email,
    phone: '0000000000',
    department: 'CSE',
    is_team_lead: true,
    email_verified: true
  });

  if (memberError) throw memberError;
  
  // 4. Give team access to rounds (simulate registration fanning)
  const { data: rounds } = await db.from('rounds').select('id');
  if (rounds) {
    const accessRows = rounds.map(r => ({
      team_id: team.id,
      round_id: r.id,
      is_locked: false // Force unlock for dev
    }));
    await db.from('team_round_access').upsert(accessRows, { onConflict: 'team_id,round_id' });
  }

  console.log('Successfully seeded team MNV-000 with email:', email);
}

seed().catch(console.error);
