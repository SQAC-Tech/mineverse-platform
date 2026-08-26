// Builds the certificate name lists from the live database.
//
// Three kinds:
//   participation  — every member of a team whose payment was verified
//   finalists      — every member of a team qualified for Day 2 (The End)
//   winners        — the top three of the Round 5 standings, one file each
//
// Read-only. Re-running overwrites the CSVs and nothing else.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'C:/Users/shaur/Documents/mineverse-platform';
const OUT = join(ROOT, 'certificates');

const env = {};
for (const line of readFileSync(join(ROOT, 'mineverse/.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const get = async (path) => {
  const r = await fetch(`${SB}/rest/v1/${path}`, { headers: h });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  return r.json();
};

/**
 * Seeded and demo teams. They are payment-verified in the database — the flag was
 * set by hand so they could walk the flow — but nobody sat behind them, so they
 * must not print a certificate. MNV-777 is the only one of these that also holds
 * a verified `payments` row, so the payment join alone does not catch it.
 */
const NOT_REAL = new Set(['MNV-000', 'MNV-005', 'MNV-006', 'MNV-88', 'MNV-DEV', 'MNV-777']);

const [teams, members, payments, state, attempts, subs, resources] = await Promise.all([
  get('teams?select=id,team_code,team_name'),
  get('members?select=team_id,name,college_email,email,is_team_lead&limit=2000'),
  get('payments?select=team_id,status'),
  get('team_game_state?select=team_id,qualified_for_day2'),
  get('day2_final_boss_attempts?select=team_id,status,completed_at,score_evidence'),
  get('submissions?select=team_id,final_score&round_id=eq.5&limit=5000'),
  get('resources?select=team_id,wood,stone,iron,gold,diamond,emerald,obsidian'),
]);

const byId = new Map(teams.map((t) => [t.id, t]));
const paidTeamIds = new Set(payments.filter((p) => p.status === 'verified').map((p) => p.team_id));

const eligible = (teamId) => {
  const t = byId.get(teamId);
  return Boolean(t) && !NOT_REAL.has(t.team_code);
};

const membersOf = new Map();
for (const m of members) {
  if (!membersOf.has(m.team_id)) membersOf.set(m.team_id, []);
  membersOf.get(m.team_id).push(m);
}
for (const list of membersOf.values()) {
  // Lead first, then alphabetical — the order a certificate batch is handed out in.
  list.sort((a, b) => Number(b.is_team_lead) - Number(a.is_team_lead) || a.name.localeCompare(b.name));
}

/** name, email, teamCode — the shape the certificate generator takes. */
const peopleOf = (teamIds) => {
  const codes = [...teamIds].map((id) => byId.get(id)).filter(Boolean).sort((a, b) => a.team_code.localeCompare(b.team_code));
  const out = [];
  for (const t of codes) {
    for (const m of membersOf.get(t.id) ?? []) {
      out.push({ name: m.name.trim(), email: (m.college_email || m.email).trim(), team_code: t.team_code, team_name: t.team_name.trim() });
    }
  }
  return out;
};

const cell = (v) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const csv = (rows, cols) => [cols.join(','), ...rows.map((r) => cols.map((c) => cell(String(r[c] ?? ''))).join(','))].join('\r\n') + '\r\n';

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'participation'), { recursive: true });

// ── Participation: everyone on a team whose payment cleared ──────────
const paid = peopleOf([...paidTeamIds].filter(eligible));
const BATCH = 50;
const batches = Math.ceil(paid.length / BATCH);
for (let i = 0; i < batches; i++) {
  const slice = paid.slice(i * BATCH, (i + 1) * BATCH);
  const n = String(i + 1).padStart(2, '0');
  writeFileSync(join(OUT, 'participation', `participation_batch_${n}.csv`), csv(slice, ['name', 'email', 'team_code']));
}
writeFileSync(join(OUT, 'participation_all.csv'), csv(paid, ['name', 'email', 'team_code']));

// ── Finalists: qualified for Day 2, i.e. reached The End ─────────────
const qualifiedIds = state.filter((s) => s.qualified_for_day2).map((s) => s.team_id).filter(eligible);
const finalists = peopleOf(qualifiedIds);
writeFileSync(join(OUT, 'finalists_the_end.csv'), csv(finalists, ['name', 'email', 'team_code', 'team_name']));

// ── Winners: the Round 5 standings, same maths as the admin board ────
const WEIGHTS = { wood: 0.5, stone: 1, iron: 1.5, gold: 2, emerald: 2, diamond: 3, obsidian: 0 };
const points = (r) => Object.entries(WEIGHTS).reduce((s, [k, w]) => s + Number(r?.[k] ?? 0) * w, 0);
const resById = new Map(resources.map((r) => [r.team_id, r]));

const boss = new Map();
for (const a of attempts) {
  const held = boss.get(a.team_id);
  if (!held || (a.completed_at && !held.completed_at)) boss.set(a.team_id, a);
}
const answered = new Map();
for (const s of subs) {
  if (Number(s.final_score ?? 0) >= 1) answered.set(s.team_id, (answered.get(s.team_id) ?? 0) + 1);
}

const standings = qualifiedIds.map((id) => {
  const b = boss.get(id);
  const correct = Number(b?.score_evidence?.correct ?? 0) + (answered.get(id) ?? 0);
  const pts = Math.round(points(resById.get(id)) * 10) / 10;
  return { id, team: byId.get(id), correct, pts, total: Math.round((correct + pts) * 10) / 10, at: b?.completed_at ?? null };
}).sort((a, b) =>
  b.total - a.total || b.correct - a.correct ||
  (a.at && b.at ? a.at.localeCompare(b.at) : a.at ? -1 : b.at ? 1 : a.team.team_code.localeCompare(b.team.team_code)));

const PLACE = ['1st', '2nd', '3rd'];
standings.slice(0, 3).forEach((s, i) => {
  const rows = peopleOf([s.id]).map((r) => ({ ...r, place: PLACE[i], score: s.total }));
  writeFileSync(join(OUT, `winner_${PLACE[i]}.csv`), csv(rows, ['name', 'email', 'team_code', 'team_name', 'place', 'score']));
});

console.log(`participation : ${paid.length} people, ${new Set(paid.map((p) => p.team_code)).size} teams, ${batches} batches of ${BATCH}`);
console.log(`finalists     : ${finalists.length} people, ${qualifiedIds.length} teams`);
standings.slice(0, 3).forEach((s, i) => console.log(`${PLACE[i]}           : ${s.team.team_code} ${s.team.team_name.trim()} — ${s.total} (${s.correct} answers + ${s.pts} resource pts)`));
console.log(`skipped       : ${[...NOT_REAL].join(', ')}`);
