const fs = require('fs');
const dotenv = require('dotenv');

// Load env vars
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  console.log('Fetching teams...');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/teams?select=id`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  const teams = await res.json();
  
  for (const team of teams) {
    console.log(`Resetting team: ${team.id}`);
    
    // Clear proctor flags
    await fetch(`${SUPABASE_URL}/rest/v1/proctor_sessions?team_id=eq.${team.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ status: 'active', warning_count: 0, key_violation_count: 0 })
    });
    
    // Unlock rounds
    await fetch(`${SUPABASE_URL}/rest/v1/team_round_access?team_id=eq.${team.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ is_locked: false })
    });
  }
  console.log('Done resetting teams.');
}

run().catch(console.error);
