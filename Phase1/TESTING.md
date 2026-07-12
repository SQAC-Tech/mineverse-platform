# MINEVERSE — Testing Document
## Phase 1: Test Strategy, Cases & Execution Plan (v2.0)

**Test Philosophy:** Manual testing dominates for event-day reliability (camera scanning, OTP delivery, round unlocking). Automated tests cover the critical paths: inline-OTP registration, OTP login, payment verification, per-checkpoint attendance.
**Tools (latest — July 2026):** **Vitest 4** (unit — replaces Jest), **Playwright 1.61** (E2E), k6 (load), Chrome DevTools (responsive), real Android + iOS phones (camera).

### What changed from v1.0
- No password tests — **passwords don't exist**. New OTP suites instead (send throttle, hash compare, attempts, single-use, expiry).
- `x-admin-key` header tests replaced by **scoped panel-cookie** tests (admin vs attendance isolation).
- Attendance tests rewritten: standalone `/attendance` route, **camera scanning**, **per-checkpoint head counts**, upsert semantics.
- Email tests split by **provider**: Resend (OTP) vs SMTP (everything else).
- Env-driven config tests (no `event_config` table).
- Jest → Vitest, `middleware.ts` assumptions → `proxy.ts`.

---

## 1. Test Environment Setup

```bash
# .env.test (mirror of PRD §6 with test values)
NEXT_PUBLIC_SUPABASE_URL=https://test-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon
SUPABASE_SERVICE_ROLE_KEY=test-service-key

RESEND_API_KEY=test-resend-key
RESEND_FROM="MINEVERSE <otp@test.dev>"
SMTP_HOST=localhost            # Mailpit/MailHog container captures SMTP in tests
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=test
SMTP_PASS=test
SMTP_FROM="MINEVERSE <team@test.dev>"

NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA        # Cloudflare always-pass test key
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA

NEXT_PUBLIC_EVENT_NAME="MINEVERSE TEST"
EVENT_DATE=2026-08-15
NEXT_PUBLIC_EVENT_DATE_DISPLAY="15 August 2026"
NEXT_PUBLIC_EVENT_TIME="11:00 AM"
NEXT_PUBLIC_EVENT_VENUE="Test Auditorium"
NEXT_PUBLIC_REGISTRATION_OPEN=true
WHATSAPP_GROUP_LINK=https://chat.whatsapp.com/test
NEXT_PUBLIC_CONTACT_EMAIL=test@test.dev
NEXT_PUBLIC_CONTACT_PHONE=+911234567890

UPI_ID=test@upi
UPI_PAYEE_NAME=MINEVERSE
FEE_SOLO=100
FEE_DUO=180
FEE_TRIO=250

NEXT_PUBLIC_COLLEGE_EMAIL_DOMAIN=@college.edu.in

JWT_SECRET=test-jwt-secret-at-least-32-characters!!
ATTENDANCE_QR_SECRET=test-qr-secret-at-least-32-chars!!!
ADMIN_PASSWORD=test-admin-pass
ATTENDANCE_PASSWORD=test-attendance-pass
OTP_EXPIRY_MINUTES=10
OTP_MAX_ATTEMPTS=3
```

**Infra:** separate Supabase test project with all migrations + seeds (4 rounds, 5 checkpoints); [Mailpit](https://mailpit.axllent.org/) docker container to capture SMTP mail; Resend mocked at the `lib/email/resend.ts` boundary in unit tests.

**Test OTP retrieval:** tests read the OTP by intercepting `sendOtpEmail` (unit) or by querying Mailpit's API (E2E, when the SMTP fallback is exercised). For Resend-path E2E, expose a test-only `GET /api/test/last-otp?email=` route compiled only when `NODE_ENV=test`.

---

## 2. Unit Tests (Vitest 4)

### 2.1 Env validation

```typescript
// tests/unit/dev1/env.test.ts
import { describe, it, expect } from 'vitest';

describe('lib/env', () => {
  it('throws when a required var is missing', async () => {
    const old = process.env.UPI_ID;
    delete process.env.UPI_ID;
    await expect(import('@/lib/env?bust=' + Date.now())).rejects.toThrow();
    process.env.UPI_ID = old;
  });
});
```

### 2.2 Validation schemas (Zod 4, no password)

```typescript
// tests/unit/dev1/schemas.test.ts
describe('registrationSchema', () => {
  it('has NO password field', () => {
    expect('password' in registrationSchema.shape).toBe(false);
  });
  it('rejects filled honeypot', () => {
    expect(registrationSchema.safeParse({ ...valid, honeypot: 'spam' }).success).toBe(false);
  });
  it('requires the first member to be the lead', () => { /* ... */ });
  it('rejects duplicate college emails within the team', () => { /* ... */ });
  it('rejects non-whitelisted college domain', () => {
    expect(memberSchema.safeParse({ ...m, college_email: 'x@gmail.com' }).success).toBe(false);
  });
  it('validates Indian phone numbers', () => {
    expect(memberSchema.safeParse({ ...m, phone: '9876543210' }).success).toBe(true);
    expect(memberSchema.safeParse({ ...m, phone: '1234567890' }).success).toBe(false); // starts with 1
  });
});
```

### 2.3 OTP hashing & helpers

```typescript
// tests/unit/dev3/otp.test.ts
describe('OTP', () => {
  it('generates 6 digits', () => expect(generateOtp()).toMatch(/^\d{6}$/));
  it('hash is deterministic and never equals the raw OTP', () => {
    expect(hashOtp('123456')).toBe(hashOtp('123456'));
    expect(hashOtp('123456')).not.toContain('123456');
  });
  it('masks emails', () => expect(maskEmail('rahul@college.edu.in')).toBe('ra•••@college.edu.in'));
  it('isEventDay respects EVENT_DATE in IST', () => { /* fake timers around midnight IST */ });
});
```

### 2.4 Sessions & panel tokens (jose)

```typescript
// tests/unit/dev3/session.test.ts
describe('team session', () => {
  it('round-trips team_id/team_code', async () => { /* create → verify */ });
  it('rejects tampered tokens', async () => { /* flip a char */ });
  it('rejects a panel token as a team session (kind claim)', async () => { /* ... */ });
});

// tests/unit/dev2/panel.test.ts
describe('panel tokens', () => {
  it('admin token fails attendance scope check and vice versa', async () => {
    const t = await createPanelToken('admin');
    expect(await verifyPanelToken(t, 'attendance')).toBe(false);
  });
});
```

### 2.5 QR sign/verify + revocation semantics

```typescript
// tests/unit/dev2/qr.test.ts
describe('team QR', () => {
  it('signed token verifies and returns team_id', async () => { /* ... */ });
  it('token signed with a different secret fails', async () => { /* ... */ });
  it('UPI string contains pa, pn, am, tn=Team-MNV-XXX', () => { /* ... */ });
});
```

### 2.6 Email routing (provider selection)

```typescript
// tests/unit/dev2/email-routing.test.ts
describe('lib/email façade', () => {
  it('sendOtpEmail uses Resend', async () => { /* mock both transports, assert resend called */ });
  it('falls back to SMTP when Resend fails', async () => { /* resend mock rejects → smtp called */ });
  it('sendPaymentVerifiedEmail uses SMTP only', async () => { /* ... */ });
  it('every send writes an email_logs row with correct provider', async () => { /* ... */ });
});
```

---

## 3. Integration Tests (API routes)

### 3.1 Inline OTP + Registration

```typescript
describe('POST /api/otp/send', () => {
  it('sends and returns challenge_id for a valid college email', async () => { /* 200 */ });
  it('rejects non-whitelisted domain (400)', async () => { /* ... */ });
  it('rejects already-registered college email (409)', async () => { /* ... */ });
  it('throttles the 4th send within 10 min (429)', async () => { /* ... */ });
});

describe('POST /api/otp/verify', () => {
  it('verifies correct OTP and returns verification_token', async () => { /* ... */ });
  it('wrong OTP decrements attempts_left; 3rd wrong kills the challenge', async () => { /* ... */ });
  it('expired challenge → 400', async () => { /* ... */ });
});

describe('POST /api/register', () => {
  it('creates team+members+payments+round_access with a VERIFIED challenge', async () => {
    // team_code MNV-\d{3}, lead email_verified=true, amount = FEE_DUO for 2 members
  });
  it('rejects an unverified challenge (the OTP-before-submit enforcement)', async () => { /* 400/401 */ });
  it('rejects when challenge email != lead college_email', async () => { /* ... */ });
  it('rejects a REUSED challenge (single-use: second register with same token fails)', async () => { /* ... */ });
  it('rejects filled honeypot (400) and rate-limits 6th reg from same IP (429)', async () => { /* ... */ });
});
```

### 3.2 OTP Login

```typescript
describe('POST /api/auth/login/request-otp', () => {
  it('403 before event day — and sends NO email', async () => { /* assert transport not called */ });
  it('401 generic for unknown team code', async () => { /* ... */ });
  it('403 for unverified payment — and sends NO email', async () => { /* ... */ });
  it('sends OTP to LEAD college email on event day + verified payment; returns masked email', async () => {
    vi.setSystemTime(new Date('2026-08-15T10:00:00+05:30'));
    // ...
  });
  it('replaces any previous live login challenge for the team', async () => { /* ... */ });
});

describe('POST /api/auth/login/verify', () => {
  it('sets httpOnly session_token cookie on success and deletes the challenge', async () => { /* ... */ });
  it('challenge cannot be replayed after success', async () => { /* second verify → 400 */ });
});
```

### 3.3 Panel auth & scope isolation

```typescript
describe('POST /api/panel/login', () => {
  it('admin password → cookie with scope admin', async () => { /* ... */ });
  it('attendance password → scope attendance', async () => { /* ... */ });
  it('wrong password → 401 generic; 11th attempt/min → 429', async () => { /* ... */ });
});

describe('scope isolation', () => {
  it('admin cookie is REJECTED by /api/attendance/mark (401)', async () => { /* ... */ });
  it('attendance cookie is REJECTED by /api/admin/payments/verify (401)', async () => { /* ... */ });
});
```

### 3.4 Payment verification

```typescript
describe('POST /api/admin/payments/verify', () => {
  it('verify: syncs teams flag (trigger), sets teams.qr_token, SMTP-mails ALL members', async () => { /* ... */ });
  it('unverify: revokes qr_token (null) and sends issue email to lead', async () => { /* ... */ });
  it('no cookie → 401', async () => { /* ... */ });
});
```

### 3.5 Attendance (per checkpoint, head count)

```typescript
describe('POST /api/attendance/resolve', () => {
  it('resolves a valid QR token to team + existing records', async () => { /* ... */ });
  it('rejects a REVOKED token (signature valid but teams.qr_token was nulled)', async () => { /* 400 */ });
  it('resolves manual team_code (case-insensitive, with/without MNV- prefix)', async () => { /* ... */ });
});

describe('POST /api/attendance/mark', () => {
  it('inserts a record for (team, ROUND_1) with members_present=2', async () => { /* ... */ });
  it('rejects members_present > team_size (400) and negative counts', async () => { /* ... */ });
  it('re-marking the same checkpoint UPSERTS and returns updated:true', async () => { /* ... */ });
  it('marks are independent per checkpoint: R1, R2, R3, R4_P1, R4_P2 each get own rows', async () => {
    // mark all 5 for one team → 5 rows, unique(team_id, checkpoint_id) holds
  });
  it('unverified-payment team can be marked but response carries warning', async () => { /* ... */ });
});
```

### 3.6 Env-driven config

```typescript
describe('GET /api/event/config', () => {
  it('returns env values (name, venue, fees) and NEVER EVENT_DATE or WHATSAPP link', async () => { /* ... */ });
});
```

---

## 4. E2E Tests (Playwright 1.61)

### 4.1 Registration with inline OTP

```typescript
// tests/e2e/registration.spec.ts
test('inline OTP before submit', async ({ page }) => {
  await page.goto('/register');

  // Submit must be disabled before verification
  await expect(page.getByRole('button', { name: /submit registration/i })).toBeDisabled();

  await page.fill('[name="team_name"]', 'E2E Test Team');
  await page.fill('[name="members.0.name"]', 'Test Lead');
  await page.fill('[name="members.0.email"]', 'lead@gmail.com');
  await page.fill('[name="members.0.college_email"]', 'lead@college.edu.in');
  await page.fill('[name="members.0.phone"]', '9876543210');

  // Inline verify (Turnstile test key auto-passes)
  await page.getByRole('button', { name: /verify email/i }).click();
  const otp = await getTestOtp('lead@college.edu.in');
  await page.fill('[name="otp_inline"]', otp);
  await page.getByRole('button', { name: /confirm/i }).click();
  await expect(page.getByText('Verified')).toBeVisible();

  // NOW submit is enabled — and there is no password field anywhere
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.getByRole('button', { name: /submit registration/i }).click();

  await expect(page).toHaveURL(/\/payment\?team=MNV-\d{3}/);
  await expect(page.locator('img[alt="Payment QR"]')).toBeVisible();
});

test('editing verified email re-disables submit', async ({ page }) => { /* ... */ });
```

### 4.2 OTP login + dashboard

```typescript
test('event-day OTP login and locked rounds', async ({ page }) => {
  await seedVerifiedTeam('MNV-999');                       // payment verified
  await page.clock.setFixedTime(new Date('2026-08-15T10:00:00+05:30'));

  await page.goto('/login');
  await page.fill('[name="team_code"]', 'MNV-999');
  await page.getByRole('button', { name: /send otp/i }).click();
  await expect(page.getByText(/•••@college\.edu\.in/)).toBeVisible();

  const otp = await getTestOtp(leadEmailOf('MNV-999'));
  await page.fill('[name="otp"]', otp);
  await page.getByRole('button', { name: /verify/i }).click();

  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByText('Locked')).toHaveCount(3);

  await unlockRound(1);                                    // via admin API
  await expect(page.getByText('Enter Round')).toBeVisible({ timeout: 12_000 }); // realtime/poll
});

test('login refused before event day', async ({ page }) => { /* 403 copy visible */ });
```

### 4.3 Panels: single-password login + separation

```typescript
test('admin and attendance are separate panels with separate passwords', async ({ page }) => {
  await page.goto('/admin');                       // guarded by proxy.ts
  await expect(page).toHaveURL('/admin/login');
  await page.fill('input[type="password"]', 'test-admin-pass');
  await page.click('button');
  await expect(page).toHaveURL('/admin');

  // Admin panel has NO attendance nav/marking UI
  await expect(page.getByRole('link', { name: /attendance/i })).toHaveCount(0);

  // Admin cookie doesn't open /attendance
  await page.goto('/attendance');
  await expect(page).toHaveURL('/attendance/login');
});
```

### 4.4 Attendance marking (manual path; camera is manual-tested §5)

```typescript
test('per-checkpoint head count with upsert confirm', async ({ page }) => {
  await loginPanel(page, 'attendance', 'test-attendance-pass');
  await page.selectOption('[name="checkpoint"]', { label: 'Round 2 — Cave Biome' });

  await page.fill('[name="team_code"]', 'MNV-482');
  await page.getByRole('button', { name: /find/i }).click();
  await expect(page.getByText('Code Crafters')).toBeVisible();

  await page.getByRole('button', { name: '2', exact: true }).click();   // 2 of 2 present
  await page.getByRole('button', { name: /mark round 2/i }).click();
  await expect(page.getByText(/marked: 2\/2/i)).toBeVisible();

  // Re-mark → confirm dialog → updated
  await page.getByRole('button', { name: /find/i }).click();
  await page.getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: /mark round 2/i }).click();
  await expect(page.getByText(/already marked/i)).toBeVisible();
});
```

---

## 5. Manual Test Cases (Event-Day Critical)

### 5.1 Registration + inline OTP

| Step | Action | Expected |
|------|--------|----------|
| 1 | Fill lead college email, click "Verify Email" | OTP arrives **via Resend** < 30 s; inline input appears |
| 2 | Try clicking Submit before verifying | Button disabled |
| 3 | Enter wrong OTP 3× | "Too many attempts" — must request a new code |
| 4 | Verify, then EDIT the college email | Verified badge clears, Submit disabled again |
| 5 | Resend before 60 s countdown ends | Resend blocked client-side; 4th send in 10 min → 429 |
| 6 | Complete registration | "Registration received" email arrives **via SMTP** (personal mailbox as sender) |
| 7 | Register same college email again | "Already registered" at the Verify step (409) |

### 5.2 Payment verification

| Step | Action | Expected |
|------|--------|----------|
| 1 | Admin logs into `/admin` with the single password box | Dashboard loads |
| 2 | Verify Team A | Status green; `teams.qr_token` set |
| 3 | Check ALL member inboxes | Each got the SMTP email: WhatsApp link works, venue/date match env, QR renders in Gmail + Outlook |
| 4 | Scan the emailed QR at `/attendance` | Resolves to Team A |
| 5 | Unverify Team A, rescan old QR | "Invalid or revoked QR code" |
| 6 | Verify 20 teams in 3 minutes | No SMTP failures in `email_logs` |

### 5.3 Attendance — camera + per-round (THE critical path)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open `/attendance` on an **Android phone** | Password box → camera permission prompt → live viewfinder |
| 2 | Repeat on **iPhone (Safari)** | Same; rear camera selected |
| 3 | Deny camera permission | Manual team-code input still fully usable |
| 4 | Select "Round 1", scan Team A's QR (from email + a printout) | Team card < 1 s, shows size + payment ✅ |
| 5 | Pick 2 of 3 present, Mark | Success toast "2/3 present at Round 1" |
| 6 | Scan Team A again at Round 1 | "Already marked — update?" confirm |
| 7 | Switch checkpoint to "Round 2", scan Team A | Fresh (unmarked) card — records are per checkpoint |
| 8 | Mark Team A at R2, R3, R4-P1, R4-P2 | 5 independent rows; `/admin/teams` chips show all 5 |
| 9 | Scan in low light / glare | Decodes ≤ 3 s or falls back to manual |
| 10 | Try `/attendance` with the ADMIN password | Rejected |
| 11 | Refresh mid-day | Checkpoint selection restored from localStorage |

### 5.4 OTP login + rounds

| Step | Action | Expected |
|------|--------|----------|
| 1 | Login attempt on D-1 | "Login opens on event day" — no email sent (check Resend dashboard) |
| 2 | Event day, unverified team | "Payment verification pending" — no email sent |
| 3 | Verified team requests OTP | Masked lead email shown; OTP < 30 s |
| 4 | Login on two devices with two OTPs | Second request invalidates first challenge |
| 5 | Admin unlocks Round 1 | All dashboards flip to Active ≤ 10 s |
| 6 | "+5 min" on active round | Countdown extends on dashboards |
| 7 | Lock Round 1 | Cards return to Locked |

### 5.5 Resend quota drill

| Step | Action | Expected |
|------|--------|----------|
| 1 | Count `email_logs` where provider='resend' during load test | ≈ 1 per registration + 1 per login (no non-OTP mail on Resend) |
| 2 | Simulate Resend outage (bad key on staging) | OTP still arrives via SMTP fallback; log shows failed resend + sent smtp |

### 5.6 Mobile responsiveness

| Device | Test | Expected |
|--------|------|----------|
| iPhone SE (375px) | Registration form + inline OTP | Usable, no horizontal scroll |
| Android Chrome | `/attendance` full flow | One-handed: camera, stepper, mark |
| iPad (768px) | `/admin/payments` | Table scrolls or stacks |
| Laptop 1366px | Dashboard | 3 round cards in a row |

---

## 6. Load Testing (k6)

### 6.1 Registration spike (OTP flow aware)

```javascript
// load-tests/registration-spike.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 0 },
  ],
};

export default function () {
  const email = `load${__VU}x${__ITER}@college.edu.in`;

  // 1. OTP send
  const send = http.post(`${__ENV.BASE_URL}/api/otp/send`, JSON.stringify({
    college_email: email, turnstile_token: 'test-token',
  }), { headers: { 'Content-Type': 'application/json' } });
  check(send, { 'otp send 200': (r) => r.status === 200 });

  // 2. verify + register via test-only helper that returns the OTP (staging only)
  // ... then POST /api/register with the verified challenge
  sleep(1);
}
```

**Acceptance:** 95% of requests < 2 s; 0% errors for valid flows; OTP throttle (429) fires correctly for hammered emails — 429s here are *correct* behavior, excluded from the error budget.

### 6.2 Attendance burst
Simulate 4 volunteers marking 50 teams in 10 minutes at one checkpoint (resolve + mark pairs): 95% < 1 s, upserts never violate the unique constraint.

---

## 7. Security Testing Checklist

| # | Test | Method | Expected |
|---|------|--------|----------|
| 1 | SQL injection in team name / team code | `' OR 1=1 --` | Zod rejects / Supabase parameterizes; no error leak |
| 2 | XSS in team name | `<script>alert(1)</script>` | Escaped everywhere (dashboard, admin, attendance, emails) |
| 3 | OTP brute force | 100 verify attempts | Challenge dead after 3; rate limit 429 |
| 4 | OTP not stored in plaintext | Inspect `otp_challenges` | Only sha256 hashes |
| 5 | Reuse consumed registration challenge | Replay `/api/register` | Rejected (row deleted) |
| 6 | Access `/api/admin/*` with attendance cookie (and vice versa) | Cookie swap | 401 both directions |
| 7 | Access panels with no cookie | Direct URL | Redirect to respective login (`proxy.ts`) |
| 8 | Forged team QR (own secret) | Sign with a guessed key | Signature invalid |
| 9 | Replay revoked QR | Unverify then scan | "Invalid or revoked" (DB match check) |
| 10 | Session cookie tampering | Modify JWT payload | Rejected |
| 11 | Panel password brute force | 100 tries/min | 429 after 10 |
| 12 | Team enumeration via login | Random team codes | Generic "Invalid team code" (401), same latency class |
| 13 | Secrets in client bundle | grep the `.next` client chunks | No `ADMIN_PASSWORD`, `ATTENDANCE_PASSWORD`, `SMTP_PASS`, `RESEND_API_KEY`, `JWT_SECRET` |
| 14 | Large payload | 10 MB JSON | 413 |
| 15 | `/api/event/config` leakage | Inspect response | No `EVENT_DATE` (machine), no WhatsApp link |

---

## 8. Test Data Seeding

```typescript
// scripts/seed-test-data.ts  (event data comes from env — nothing to seed for config)
export async function seedTestData() {
  // rounds (4) + attendance_checkpoints (5) come from migrations.

  const teams = [
    { code: 'MNV-001', payment: 'pending' },                      // just registered
    { code: 'MNV-002', payment: 'verified' },                     // has qr_token
    { code: 'MNV-003', payment: 'verified', attendance: { ROUND_1: 3, ROUND_2: 2 } },
  ];

  for (const t of teams) {
    const team = await createTeam(t);                 // no password_hash!
    await createMembers(team.id, 3);                  // lead email_verified=true
    await createPayment(team.id, t.payment);
    if (t.payment === 'verified') await setQrToken(team.id);
    for (const [cp, count] of Object.entries(t.attendance ?? {})) {
      await markAttendance(team.id, cp, count);
    }
    await createRoundAccess(team.id);                 // all locked
  }
}
```

---

## 9. Bug Report Template

```markdown
**Bug ID:** BUG-001
**Severity:** Critical / High / Medium / Low
**Component:** Registration / OTP / Payment / Panel-Auth / Admin / Attendance / Dashboard / Rounds / Email
**Owner (file matrix):** Dev 1 / Dev 2 / Dev 3   ← use MASTER.md §16 to route
**Steps to Reproduce:** 1. 2. 3.
**Expected:** / **Actual:**
**Provider (if email):** resend / smtp — attach email_logs row
**Environment:** browser, OS, device (phone model for camera bugs)
**Status:** Open / In Progress / Fixed / Verified
```

---

## 10. Sign-off Criteria

Phase 1 is production-ready when:

- [ ] Unit suites pass (`npx vitest run`) — all three devs' dirs
- [ ] E2E suites pass (`npx playwright test`)
- [ ] Load: 50 concurrent registrations, 95% < 2 s, throttles behave
- [ ] Security checklist 15/15
- [ ] Manual sections 5.1–5.6 100% pass
- [ ] **Camera scanning verified on ≥ 2 real Android + 2 real iOS devices at the venue**
- [ ] Resend used ONLY for OTPs (email_logs audit) and daily OTP volume projection < 100
- [ ] SMTP deliverability: Gmail, Outlook, Yahoo inbox (not spam) for the verified email
- [ ] Both panel passwords rotated to strong values in Vercel before D-1
- [ ] `EVENT_DATE` flip rehearsal done (login blocked D-1, open on D-0)
- [ ] Attendance CSV export works (paper backup ready)
- [ ] No `middleware.ts` in repo (Next 16 `proxy.ts` only); `npm run build` green with all env vars

---

**Test Lead:** TBD
**Test Start:** TBD
**Completion Target:** D-3 before event
