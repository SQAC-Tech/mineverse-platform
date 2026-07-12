# PROMPT: Developer 1 — Foundation, Database, Landing, Registration (inline OTP) & Payment Page
## For: Codex / Claude Code / Antigravity

**Context:** You are building Phase 1 of the MINEVERSE platform — a **Next.js 16 (App Router) + Supabase + Tailwind CSS v4** project. You are Developer 1. You own two things:
1. The **Day-0 Foundation** — the one-time project skeleton every other dev builds on top of (created first, then **frozen**).
2. Your feature scope: landing page, the **passwordless registration flow with inline OTP verification (OTP verified BEFORE the submit button)**, the payment page, and the full database.

**Tech Stack (latest — July 2026, install everything with `@latest`):** Next.js **16.2.x** (Turbopack default), React 19, TypeScript 5, Tailwind CSS **v4** (CSS-first config — no `tailwind.config.ts`), shadcn/ui via **`npx shadcn@latest init`** (CLI v4 — the old `shadcn-ui` package is dead), Zod **4**, `@supabase/supabase-js` 2.110+, jose 6, qrcode, react-hook-form 7 + `@hookform/resolvers`, `@marsidev/react-turnstile`.

**Critical Rules:**
- App Router only. API routes are `route.ts` files. In Next 16, request interception is **`proxy.ts`**, not `middleware.ts` (Dev 3 owns that file — do not create it).
- **NO PASSWORDS.** Teams never set a password. Registration identity = OTP-verified college email. Do not add a password field anywhere.
- **OTP is verified inline in the registration form, before submit.** The Submit button stays disabled until the team lead's college email shows the ✅ Verified badge.
- OTP emails go through **Resend**; the "registration received" email goes through **SMTP** — but you never call providers directly. You only call the frozen façade `lib/email/index.ts` (Dev 2 implements it; your stub versions just `console.log`).
- **All changeable event data comes from env vars** (PRD §6): event date/venue/time, fees, UPI ID, WhatsApp link, college domain. Never hardcode these and never create an `event_config` table.
- All DB access via the Supabase **service-role** client server-side. RLS is deny-all.
- Zod 4 for every input. OTPs stored **hashed** (sha256 + `JWT_SECRET`).
- Team code format: `MNV-XXX`, random, unique, via the DB function.

---

## THE ZERO-CONFLICT CONTRACT (read first)

After your Day-0 foundation commit, **every file has exactly one owner and nobody edits a file they don't own.** You own the files marked DEV 1 below; FROZEN files are created by you on Day 0 and then never change (changing a frozen file requires a group call with all 3 devs).

```
YOU CREATE ON DAY 0, THEN FROZEN:
  package.json                    (ALL deps for all 3 devs — see Part A)
  app/layout.tsx, app/globals.css
  app/admin/layout.tsx            (sidebar nav already listing: Dashboard, Payments, Teams, Rounds)
  components/ui/**                (shadcn components, install the full set once)
  lib/env.ts                      (Zod-validated env)
  lib/supabase/server.ts, lib/supabase/client.ts
  lib/panel/session.ts            (panel JWT helpers — used by Dev 2 & Dev 3)
  lib/rate-limit.ts               (simple in-memory limiter)
  lib/email/index.ts              (STUB with frozen signatures — Dev 2 replaces the body)
  types/index.ts, types/supabase.ts

YOURS (DEV 1) — ongoing:
  supabase/migrations/**
  app/page.tsx                    app/register/page.tsx        app/payment/page.tsx
  app/api/event/config/route.ts   app/api/otp/send/route.ts    app/api/otp/verify/route.ts
  app/api/register/route.ts       app/api/payment/status/route.ts
  components/forms/**             lib/validation/**            lib/team-code.ts
  tests/unit/dev1/**

NOT YOURS (never touch):
  proxy.ts, app/login, app/dashboard/**, app/api/auth/**, app/api/team/**   → Dev 3
  app/admin/** pages, app/attendance/**, app/api/admin/**, app/api/attendance/**,
  app/api/panel/**, lib/email/{resend,smtp,templates}.ts, lib/qr/**         → Dev 2
  app/admin/rounds/**, app/api/admin/rounds/**                              → Dev 3
```

Because you call email only through the frozen stub, Dev 2 can wire real providers later **without either of you touching the other's files**.

---

## PART A: Day-0 Foundation

### A.1 Project init

```bash
npx create-next-app@latest mineverse --typescript --tailwind --app --src-dir=false --turbopack
cd mineverse
npx shadcn@latest init          # CLI v4
npx shadcn@latest add button input label card select badge accordion sonner dialog table
# ALL runtime deps for all 3 devs (freeze package.json after this):
npm install zod@latest @supabase/supabase-js@latest jose@latest qrcode@latest qr-scanner@latest \
  resend@latest nodemailer@latest react-hook-form@latest @hookform/resolvers@latest \
  @marsidev/react-turnstile@latest lucide-react@latest
npm install -D @types/qrcode @types/nodemailer vitest@latest @vitejs/plugin-react @playwright/test@latest
```

> Tailwind v4 note: there is **no `tailwind.config.ts`**. Theme customization goes in `app/globals.css` via `@import "tailwindcss";` and `@theme { ... }`. shadcn v4 sets this up for you.

### A.2 `lib/env.ts` — validated env (frozen)

```typescript
import { z } from 'zod';

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM: z.string().min(1),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number(),
  SMTP_SECURE: z.stringbool(),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  SMTP_FROM: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().min(1),
  EVENT_DATE: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  WHATSAPP_GROUP_LINK: z.url(),
  UPI_ID: z.string().min(3),
  UPI_PAYEE_NAME: z.string().min(1),
  FEE_SOLO: z.coerce.number(),
  FEE_DUO: z.coerce.number(),
  FEE_TRIO: z.coerce.number(),
  JWT_SECRET: z.string().min(32),
  ATTENDANCE_QR_SECRET: z.string().min(32),
  ADMIN_PASSWORD: z.string().min(8),
  ATTENDANCE_PASSWORD: z.string().min(8),
  OTP_EXPIRY_MINUTES: z.coerce.number().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(3),
});

export const env = serverEnvSchema.parse(process.env);

// NEXT_PUBLIC_* vars are inlined by Next at build time — read them directly
// where needed; list kept in PRD §6.
```

Import `lib/env.ts` from a server entry point (e.g., the event config route) so a missing var fails loudly at boot/build.

### A.3 `lib/supabase/server.ts` (frozen)

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export const supabaseServer = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
```

`lib/supabase/client.ts` exports a browser client with the anon key — used **only** for Realtime subscribe (RLS is deny-all).

### A.4 `lib/panel/session.ts` (frozen — Dev 2 & Dev 3 both consume this)

```typescript
import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
export type PanelScope = 'admin' | 'attendance';

export async function createPanelToken(scope: PanelScope) {
  return new SignJWT({ scope })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(scope === 'admin' ? '12h' : '24h')
    .sign(SECRET);
}

export async function verifyPanelToken(token: string, requiredScope: PanelScope) {
  try {
    const { payload } = await jwtVerify(token, SECRET, { clockTolerance: 60 });
    return payload.scope === requiredScope;
  } catch {
    return false;
  }
}

export const PANEL_COOKIE = 'panel_session';
```

### A.5 `lib/email/index.ts` (STUB — signatures frozen, Dev 2 owns the body)

```typescript
// FROZEN SIGNATURES — Dev 2 replaces the bodies with Resend (OTP) + SMTP (rest).
// Dev 1 and Dev 3 call ONLY these functions and never import providers directly.

export type EmailResult = { success: boolean; error?: string };

/** OTP mail — Resend. purpose: 'registration' | 'login' */
export async function sendOtpEmail(_: {
  to: string; otp: string; purpose: 'registration' | 'login';
  team_id?: string;
}): Promise<EmailResult> {
  console.log('[email stub] OTP', _);
  return { success: true };
}

/** SMTP — registration received (payment pending). */
export async function sendRegistrationReceivedEmail(_: {
  to: string; team_name: string; team_code: string; amount: number; team_id: string;
}): Promise<EmailResult> {
  console.log('[email stub] reg received', _);
  return { success: true };
}

/** SMTP — payment verified, sent to every member. Includes QR + WhatsApp + venue. */
export async function sendPaymentVerifiedEmail(_: {
  to: string; member_id: string; team_id: string; team_name: string; team_code: string;
  qr_image_data_url: string;
}): Promise<EmailResult> {
  console.log('[email stub] payment verified', _);
  return { success: true };
}

/** SMTP — payment problem / unverified notice. */
export async function sendPaymentIssueEmail(_: {
  to: string; team_id: string; team_code: string; reason?: string;
}): Promise<EmailResult> {
  console.log('[email stub] payment issue', _);
  return { success: true };
}
```

### A.6 `app/admin/layout.tsx` (frozen)

Server component with the dark sidebar. Nav must list **all four** admin pages up front so no one edits this file later: Dashboard (`/admin`), Payments (`/admin/payments`), Teams (`/admin/teams`), Rounds (`/admin/rounds`). No auth logic here — `proxy.ts` (Dev 3) guards `/admin/**`.

### A.7 `lib/rate-limit.ts` (frozen)

Simple in-memory sliding window: `rateLimit(key: string, max: number, windowMs: number): boolean`. Good enough for a single Vercel region + event-scale traffic; document that it resets per lambda instance.

Commit everything above as **`chore: day-0 foundation (FROZEN)`**. From now on, work only in DEV 1 files.

---

## PART B: Database (run in Supabase SQL Editor)

Use **exactly** the schema in `DATABASE.md` v2.0 — it is the source of truth. Summary of what you create (migration order §7):

1. `teams` — **no `password_hash`**, has `qr_token text unique`, status enum `payment_pending|verified|active|eliminated|champion`.
2. `members` — `college_email` globally unique, `email_verified` flag.
3. `payments` — amount snapshot, `upi_string`, `admin_notes`.
4. `otp_challenges` — **replaces temp_otp**: `email, otp_hash, purpose('registration'|'login'), team_id, attempts, verified, verification_token, expires_at`.
5. `rounds` — seed 4.
6. `attendance_checkpoints` — seed 5: `ROUND_1..ROUND_3, ROUND_4_PHASE_1, ROUND_4_PHASE_2`.
7. `attendance_records` — `(team_id, checkpoint_id)` unique, `members_present integer`, `method('qr_scan'|'manual')`.
8. `team_round_access`, `email_logs` (with `provider('resend'|'smtp')`).
9. Functions/triggers: `generate_team_code()`, `update_updated_at_column()`, `sync_payment_verification()`.
10. RLS: enable on every table, **create no policies** (deny-all; service role bypasses).

Then:
```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID --schema public > types/supabase.ts
```

---

## PART C: Your Feature Scope

### C.1 `lib/validation/schemas.ts` (Zod 4 idioms)

```typescript
import { z } from 'zod';

const collegeDomain = process.env.NEXT_PUBLIC_COLLEGE_EMAIL_DOMAIN || '@college.edu.in';

export const memberSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.email(),                                    // Zod 4 top-level
  college_email: z.email().refine(
    (e) => e.toLowerCase().endsWith(collegeDomain),
    { error: `Must be a ${collegeDomain} email` }      // Zod 4: `error`, not `message`
  ),
  phone: z.string().regex(/^[6-9]\d{9}$/, { error: 'Invalid Indian phone number' }),
  section: z.string().max(10).optional(),
  department: z.enum(['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'OTHER']),
  is_team_lead: z.boolean(),
});

export const otpSendSchema = z.object({
  college_email: z.email(),
  turnstile_token: z.string().min(1, { error: 'Complete the captcha' }),
});

export const otpVerifySchema = z.object({
  challenge_id: z.uuid(),
  otp: z.string().regex(/^\d{6}$/),
});

export const registrationSchema = z.object({
  honeypot: z.literal(''),
  challenge_id: z.uuid(),
  verification_token: z.uuid(),
  team_name: z.string().min(3).max(50),
  members: z.array(memberSchema).min(1).max(3)
    .refine((m) => m.filter(x => x.is_team_lead).length === 1 && m[0].is_team_lead,
      { error: 'First member must be the team lead' })
    .refine((m) => new Set(m.map(x => x.college_email.toLowerCase())).size === m.length,
      { error: 'Duplicate college emails within team' }),
});
// NOTE: NO password field. Anywhere.
```

### C.2 OTP hashing helper (put in `lib/validation/otp.ts` or `lib/team-code.ts` area — your files)

```typescript
import { createHash } from 'crypto';
export const hashOtp = (otp: string) =>
  createHash('sha256').update(otp + process.env.JWT_SECRET!).digest('hex');
export const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();
```

### C.3 `app/api/otp/send/route.ts`

1. Parse with `otpSendSchema`.
2. `rateLimit('otp:' + email, 3, 10 * 60_000)` → 429 if exceeded.
3. Verify Turnstile: POST `https://challenges.cloudflare.com/turnstile/v0/siteverify` with **form-encoded** `secret` + `response`.
4. Reject if `college_email` already in `members` → 409.
5. Delete any previous unverified `registration` challenge for this email, insert a new one: `otp_hash = hashOtp(otp)`, `expires_at = now + OTP_EXPIRY_MINUTES`.
6. `await sendOtpEmail({ to, otp, purpose: 'registration' })` (frozen stub).
7. Return `{ success: true, challenge_id, expires_in }`.

### C.4 `app/api/otp/verify/route.ts`

Fetch challenge → 400 if missing/expired → if `attempts >= OTP_MAX_ATTEMPTS` delete + 400 → compare `hashOtp(input)` to `otp_hash`; on miss increment attempts and return `attempts_left`; on hit set `verified = true` and return `{ verification_token }`.

### C.5 `app/api/register/route.ts`

1. Parse `registrationSchema` (honeypot literal `''` rejects bots at the schema level).
2. `rateLimit('reg:' + ip, 5, 60 * 60_000)`.
3. Load the challenge by `challenge_id`; require: `purpose='registration'`, `verified=true`, `verification_token` matches, not expired, **and `challenge.email === members[0].college_email`** (the lead). This is the server-side enforcement of "OTP before submit".
4. Re-check all member college emails against `members` table → 409 on any hit.
5. `rpc('generate_team_code')` → insert `teams` (status `payment_pending`, `team_size`) → insert `members` (lead gets `email_verified: true`) → insert `payments` with amount from env: `{1: env.FEE_SOLO, 2: env.FEE_DUO, 3: env.FEE_TRIO}[team_size]` → insert `team_round_access` for all rounds (locked).
6. **Delete the consumed otp_challenge.**
7. `await sendRegistrationReceivedEmail({...})` (stub).
8. Return `{ success: true, team_code, payment_amount, redirect: '/payment?team=' + team_code }`.

### C.6 `app/api/event/config/route.ts`

Returns the public env-derived config (PRD/API_GUIDE §1.1). Reads `NEXT_PUBLIC_*` display vars + fee numbers from `lib/env.ts`. **Never** return `EVENT_DATE` (machine gate) or `WHATSAPP_GROUP_LINK`.

### C.7 `app/api/payment/status/route.ts`

`GET ?team=MNV-482` → team + payment → if pending and no `upi_string`, build `upi://pay?pa=${env.UPI_ID}&pn=${env.UPI_PAYEE_NAME}&am=${amount}&tn=Team-${team_code}&cu=INR`, store it, and return `qr_image` via `QRCode.toDataURL(upi_string)`. Response per API_GUIDE §1.5.

### C.8 `components/forms/registration-form.tsx` — the inline-OTP form

react-hook-form + `zodResolver`. Structure:

```
[Team name]
[Member 1 — TEAM LEAD]
  name / email / phone / section / department
  college email  [Verify Email]        ← button, disabled while sending
      ↓ after send: inline 6-digit OTP input + "Confirm" + resend countdown (60 s)
      ↓ after confirm: field becomes readOnly + ✅ Verified badge
[+ Add member] (up to 3; members 2–3 have NO verify button — only the lead verifies)
[Turnstile widget]  ← token used by /api/otp/send
[hidden honeypot input name="website_url" mapped to honeypot]
[Submit Registration]  ← disabled={!verificationToken || isSubmitting}
```

Client state: `challengeId`, `verificationToken`, `otpState: 'idle'|'sent'|'verified'`. If the lead **edits the college email after verifying**, reset to `'idle'` and clear the token (the server would reject the mismatch anyway — C.5 step 3).

On submit → `POST /api/register` → `router.push(result.redirect)`.

### C.9 `app/payment/page.tsx`

Client page reading `?team=` (Next 16: `useSearchParams()` inside a `<Suspense>` boundary). Shows amount, status pill (poll `GET /api/payment/status` every 15 s while pending), UPI QR image, download button, 4-step pay instructions. On `verified`: green check + "Check your email for the attendance QR."

### C.10 `app/page.tsx` — landing

Server component. Event card data from `GET /api/event/config` (or import `lib/env` + `NEXT_PUBLIC_*` directly server-side — cheaper). CTAs → `/register`, `/login`. FAQ accordion (shadcn), footer contact from `NEXT_PUBLIC_CONTACT_*`.

---

## PART D: `.env.local` for development

Copy PRD §6 into `.env.example` with dummy values; fill `.env.local` locally. Both panel passwords, both mail providers, all `FEE_*`/UPI/event vars must be present or `lib/env.ts` fails the build — that is intentional.

---

## PART E: Acceptance Criteria

- [ ] Foundation committed and tagged `foundation-frozen`; `package.json` contains every dep all 3 devs need
- [ ] All migrations run; 4 rounds + 5 attendance checkpoints seeded; RLS deny-all confirmed (anon select returns nothing)
- [ ] Landing shows event details **from env vars**
- [ ] "Verify Email" sends OTP (stub logs it), inline input verifies it, Submit unlocks **only after** verification
- [ ] Editing the verified email re-locks Submit
- [ ] Register rejects: filled honeypot, unverified challenge, mismatched lead email, duplicate college email (409), >3 members
- [ ] No password field exists anywhere in the codebase
- [ ] Team code is MNV-XXX and unique; teams/members/payments/team_round_access rows all created
- [ ] Consumed OTP challenge is deleted (single-use)
- [ ] Payment page renders UPI QR built from env `UPI_ID` and correct env fee
- [ ] `npm run build` fails if any required env var is missing

**Do NOT build:** email provider implementations, admin pages, attendance panel, login, dashboard, proxy.ts — other devs own those files.
