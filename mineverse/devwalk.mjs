import { chromium } from '@playwright/test';
import { SignJWT } from 'jose';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const OUT = 'C:/Users/shaur/AppData/Local/Temp/claude/C--Users-shaur-Documents-mineverse-platform/289bc172-d1e4-47b7-b4a6-bc799ef7c511/scratchpad';
const TEAM = '986c854b-3228-456a-a6ea-2c9ad25caade'; // MNV-722

const env = fs.readFileSync('.env.local', 'utf8');
const pick = (k) => env.match(new RegExp('^' + k + '=(.*)$', 'm'))[1].trim();
const db = createClient(pick('NEXT_PUBLIC_SUPABASE_URL'), pick('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Start from a clean slate so this can be re-run.
await db.from('screening_attempts').delete().eq('team_id', TEAM);

const token = await new SignJWT({ team_id: TEAM, team_code: 'MNV-722', kind: 'team' })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('2h')
  .sign(new TextEncoder().encode(pick('JWT_SECRET')));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
await ctx.addCookies([{ name: 'session_token', value: token, domain: 'localhost', path: '/' }]);
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('   [console]', m.text().slice(0, 140)); });

console.log('--- login page: is the screening card live? ---');
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const cardText = await page.locator('text=SCREENING ROUND').first().textContent().catch(() => null);
const badge = await page.locator('text=LIVE NOW').first().isVisible().catch(() => false);
console.log('   card present:', Boolean(cardText), '| LIVE NOW badge:', badge);
await page.screenshot({ path: `${OUT}/dev-login.png` });

console.log('--- instructions screen ---');
await page.goto('http://localhost:3000/screening', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const startBtn = page.locator('button:has-text("Start the screening")');
const blocked = await page.locator('text=/opens on|has closed|already sat/i').first().isVisible().catch(() => false);
console.log('   blocked message shown:', blocked, '| start button:', await startBtn.isVisible().catch(() => false));
console.log('   start disabled before consent:', await startBtn.isDisabled().catch(() => null));
await page.screenshot({ path: `${OUT}/dev-instructions.png` });

console.log('--- tick consent and start ---');
await page.locator('input[type=checkbox]').check();
console.log('   start disabled after consent:', await startBtn.isDisabled().catch(() => null));
await startBtn.click();
await page.waitForTimeout(2500);

// The proctor gate stands between the instructions and the paper.
const gate = await page.locator('.pgate__card').isVisible().catch(() => false);
console.log('   proctor gate shown:', gate);
await page.screenshot({ path: `${OUT}/dev-proctor-gate.png` });

if (gate) {
  await page.locator('.pgate__btn').first().click();
  await page.waitForTimeout(2500);
}

console.log('--- the paper ---');
const clock = await page.locator('.scr__clock').textContent().catch(() => null);
const qCount = await page.locator('.scr__dot').count().catch(() => 0);
const prompt = await page.locator('.scr__prompt').first().textContent().catch(() => null);
const options = await page.locator('.scr__opt').count().catch(() => 0);
console.log('   clock:', clock?.trim(), '| navigator dots:', qCount, '| options:', options);
console.log('   Q1:', prompt?.trim().slice(0, 90).replace(/\s+/g, ' '));
await page.screenshot({ path: `${OUT}/dev-paper.png` });

console.log('--- answer three, check the navigator fills in ---');
for (let i = 0; i < 3; i += 1) {
  await page.locator('.scr__opt').nth(1).click();
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Save & next")').click();
  await page.waitForTimeout(400);
}
const done = await page.locator('.scr__dot--done').count();
const progress = await page.locator('.scr__progress').first().textContent().catch(() => null);
console.log('   answered dots:', done, '| header:', progress?.trim().replace(/\s+/g, ' '));
await page.screenshot({ path: `${OUT}/dev-paper-progress.png` });

console.log('--- reload mid-paper: answers and real remaining time survive ---');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const gate2 = await page.locator('.pgate__card').isVisible().catch(() => false);
if (gate2) { await page.locator('.pgate__btn').first().click(); await page.waitForTimeout(2000); }
const doneAfter = await page.locator('.scr__dot--done').count().catch(() => 0);
const clockAfter = await page.locator('.scr__clock').textContent().catch(() => null);
console.log('   answered dots after reload:', doneAfter, '| clock:', clockAfter?.trim(), '(must be < 30:00)');

await browser.close();

const { data: attempt } = await db.from('screening_attempts')
  .select('status, question_ids, deadline_at').eq('team_id', TEAM).single();
const { count } = await db.from('screening_answers').select('attempt_id', { count: 'exact', head: true });
console.log('\nDB — status:', attempt?.status, '| questions sealed:', attempt?.question_ids?.length, '| answers saved:', count);

// Leave the team as we found it.
await db.from('screening_attempts').delete().eq('team_id', TEAM);
const { count: left } = await db.from('screening_attempts').select('team_id', { count: 'exact', head: true });
console.log('cleanup — attempts left:', left);
