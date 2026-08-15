import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

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

async function seed() {
  const teamId = 'b4b267ed-4896-420e-b114-cf4eee083f5f'; // Demo Team
  
  const { data: existingCraft } = await db.from('crafting_log').select('id').eq('team_id', teamId).eq('item', 'iron_armor').single();
  if (!existingCraft) {
    const ledgerId = randomUUID();
    const { error: ledgerError } = await db.from('resource_ledger').insert({
      id: ledgerId,
      team_id: teamId,
      source_type: 'craft',
      delta: {},
      balance_after: {},
      idempotency_key: randomUUID(),
    });
    if (ledgerError) console.error('Ledger Error:', ledgerError);
    
    const { error: craftError } = await db.from('crafting_log').insert({
      team_id: teamId,
      item: 'iron_armor',
      base_cost: {},
      actual_cost: {},
      ledger_id: ledgerId,
      idempotency_key: randomUUID()
    });
    if (craftError) console.error('Craft Error:', craftError);
  }
  
  const { data: existingGuardian } = await db.from('guardian_battles').select('id').eq('team_id', teamId).eq('guardian_name', 'blaze_guardian').single();
  if (existingGuardian) {
    await db.from('guardian_battles').update({ status: 'won' }).eq('id', existingGuardian.id);
  } else {
    const { error: guardianError } = await db.from('guardian_battles').insert({
      team_id: teamId,
      round_id: 3,
      guardian_name: 'blaze_guardian',
      status: 'won',
      attempt_number: 1,
      question_set_version: 'v1',
      total_questions: 1
    });
    if (guardianError) console.error('Guardian Error:', guardianError);
  }
  
  console.log('Seeded Iron Armor and Blaze Guardian for Demo Team.');
}

seed().catch(console.error);
