# PROMPT: Developer 2 — Email System (Resend + SMTP), Panel Auth, Admin Panel & Standalone Attendance Panel
## For: Codex / Claude Code / Antigravity

**Context:** You are building Phase 1 of the MINEVERSE platform — a **Next.js 16 (App Router) + Supabase + Tailwind CSS v4** project. You are Developer 2. Your scope: the **dual-provider email system** (Resend for OTPs, personal SMTP for everything else), **panel authentication** (single-password-box login for both panels), the **admin panel** (payments verification + teams roster — *not* attendance, *not* rounds), and the **standalone attendance panel at `/attendance`** with **live camera QR scanning** and **per-checkpoint head counts**.

**Tech Stack (latest — July 2026):** Next.js 16.2.x, React 19, Tailwind v4, shadcn/ui (CLI v4), Zod 4, `@supabase/supabase-js` 2.110+, **Resend SDK 6** (OTP only), **Nodemailer 9** (SMTP, all other mail), jose 6, `qrcode` (generation), **`qr-scanner`** (nimiq) for camera decoding — **NOT `html5-qrcode` (unmaintained)**.

**Critical Rules:**
- **OTP emails → Resend. Every other email → SMTP (personal mailbox via Nodemailer).** Every send on either provider is logged to `email_logs` with the `provider` column.
- **Attendance is NOT part of the admin panel.** It is its own route tree `/attendance/**` with its **own password** (`ATTENDANCE_PASSWORD`). Admin uses `ADMIN_PASSWORD`. Both are **single input box** logins — no usernames. **No IP whitelist.**
- Panel auth = scoped `panel_session` JWT cookie (scope `admin` or `attendance`). An admin cookie must NOT work on attendance APIs and vice versa. Route guarding in `proxy.ts` is Dev 3's file — your API routes still re-verify the cookie themselves (defense in depth) using the frozen `lib/panel/session.ts`.
- Attendance QR scanning uses the **device camera** (no file upload). Manual team-code input is the always-visible fallback.
- Attendance is recorded per **checkpoint** (Round 1, 2, 3, Round 4 Phase 1, Round 4 Phase 2) as a **head count** (`members_present` integer), upserted on `(team_id, checkpoint_id)`.
- Payment verification is MANUAL (no payment gateway).
- Event data (WhatsApp link, venue, date display, UPI) comes from **env vars** — never hardcode.

---

## THE ZERO-CONFLICT CONTRACT (read first)

Dev 1's Day-0 foundation is already committed and **frozen**: `package.json` (your deps are already installed — do not add any), `app/admin/layout.tsx` (nav already links Payments/Teams/Rounds), `lib/panel/session.ts`, `lib/supabase/*`, `lib/env.ts`, `lib/rate-limit.ts`, `components/ui/**`, and the stub `lib/email/index.ts` whose **signatures are frozen**.

```
YOURS (DEV 2):
  lib/email/index.ts              (replace stub BODIES — keep frozen signatures)
  lib/email/resend.ts  lib/email/smtp.ts  lib/email/templates.ts  lib/email/log.ts
  lib/qr/generator.ts
  app/api/panel/login/route.ts    app/api/panel/logout/route.ts
  app/admin/page.tsx              app/admin/login/page.tsx
  app/admin/payments/page.tsx     app/admin/teams/page.tsx
  app/api/admin/teams/route.ts    app/api/admin/payments/verify/route.ts
  app/attendance/**               (login page + main panel)
  app/api/attendance/**           (checkpoints, resolve, mark, report)
  components/admin/**             components/attendance/**
  tests/unit/dev2/**

NOT YOURS (never touch):
  app/admin/layout.tsx (frozen), app/admin/rounds/** and app/api/admin/rounds/** (Dev 3),
  proxy.ts, app/login, app/dashboard/**, app/api/auth/**, app/api/team/** (Dev 3),
  app/register, app/payment, app/api/otp/**, app/api/register (Dev 1),
  package.json, lib/env.ts, lib/panel/session.ts, types/** (frozen)
```

Dev 1 (`/api/otp/*`, `/api/register`) and Dev 3 (`/api/auth/login/*`) already call your email façade through the frozen signatures — when you replace the stub bodies, their flows light up with zero changes on their side.

---

## PART A: Email System (dual provider)

### A.1 `lib/email/log.ts`

```typescript
import { supabaseServer } from '@/lib/supabase/server';

export async function logEmail(entry: {
  team_id?: string; member_id?: string; email_type: string;
  provider: 'resend' | 'smtp'; recipient: string; subject: string;
  status: 'sent' | 'failed'; error?: string;
}) {
  await supabaseServer.from('email_logs').insert({
    ...entry,
    sent_at: entry.status === 'sent' ? new Date().toISOString() : null,
  });
}
```

### A.2 `lib/email/resend.ts` — OTP transport ONLY

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendViaResend(to: string, subject: string, html: string) {
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM!, to: [to], subject, html,
  });
  return { success: !error, error: error?.message };
}
```

### A.3 `lib/email/smtp.ts` — everything else (personal mailbox)

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export async function sendViaSmtp(opts: {
  to: string; subject: string; html: string;
  attachments?: { filename: string; content: Buffer; cid: string }[];
}) {
  try {
    await transporter.sendMail({ from: process.env.SMTP_FROM, ...opts });
    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err.message };
  }
}
```

> Gmail: use an **App Password** (2FA required). Keep sends per team batched; Gmail's ~500/day cap is the budget for verified/reminder mails.

### A.4 `lib/email/index.ts` — replace the stub bodies (signatures FROZEN)

Routing logic:
- `sendOtpEmail` → **Resend**; on failure, retry once through **SMTP** (quota/outage fallback), log both attempts (`email_type: 'otp_registration' | 'otp_login'`).
- `sendRegistrationReceivedEmail`, `sendPaymentVerifiedEmail`, `sendPaymentIssueEmail` → **SMTP**, log with `provider: 'smtp'`.
- Every function logs via `logEmail` and never throws — always returns `{ success, error? }`.

### A.5 `lib/email/templates.ts`

Four HTML templates (inline CSS, dark MINEVERSE styling, plain-text-friendly):
1. **OTP** — big 6-digit code, "expires in 10 minutes", purpose-aware copy (registration vs login).
2. **Registration received** — team code, amount (₹ from args), "payment pending" status box.
3. **Payment verified / You're In!** — event date/time/venue from `NEXT_PUBLIC_EVENT_*` env, WhatsApp button from `WHATSAPP_GROUP_LINK` env, and the attendance QR embedded as a **CID inline attachment** (more reliable than data-URI `<img>` in Gmail): attach the PNG buffer with `cid: 'team-qr'` and reference `<img src="cid:team-qr">`.
4. **Payment issue** — polite "contact organizers" notice.

---

## PART B: Panel Auth (single password box, two scopes)

### B.1 `app/api/panel/login/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createPanelToken, PANEL_COOKIE } from '@/lib/panel/session';
import { rateLimit } from '@/lib/rate-limit';

const schema = z.object({
  panel: z.enum(['admin', 'attendance']),
  password: z.string().min(1),
});

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(`panel:${ip}`, 10, 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many attempts' }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }

  const { panel, password } = parsed.data;
  const expected = panel === 'admin'
    ? process.env.ADMIN_PASSWORD!
    : process.env.ATTENDANCE_PASSWORD!;

  if (!safeEqual(password, expected)) {
    return NextResponse.json({ success: false, error: 'Incorrect password' }, { status: 401 });
  }

  const token = await createPanelToken(panel);
  (await cookies()).set(PANEL_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: panel === 'admin' ? 12 * 3600 : 24 * 3600,
    path: '/',
  });

  return NextResponse.json({ success: true, scope: panel });
}
```

### B.2 API-route guard helper (yours, e.g. top of each route or `lib/email`-adjacent util in your files)

```typescript
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyPanelToken, PANEL_COOKIE, type PanelScope } from '@/lib/panel/session';

export async function requirePanel(scope: PanelScope) {
  const token = (await cookies()).get(PANEL_COOKIE)?.value;
  if (!token || !(await verifyPanelToken(token, scope))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
```

Every `/api/admin/*` route you own calls `requirePanel('admin')`; every `/api/attendance/*` route calls `requirePanel('attendance')`. (Dev 3's `proxy.ts` also guards pages — this is defense in depth.)

### B.3 Login pages

`/admin/login/page.tsx` and `/attendance/login/page.tsx`: **one password input + one button**, posts to `/api/panel/login` with the respective `panel` value, redirects to `/admin` / `/attendance` on success. Autofocus the input; show generic error text.

---

## PART C: QR Utilities — `lib/qr/generator.ts`

```typescript
import QRCode from 'qrcode';
import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.ATTENDANCE_QR_SECRET!);

export async function signTeamQrToken(teamId: string) {
  return new SignJWT({ team_id: teamId, type: 'attendance' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('60d')
    .sign(SECRET);
}

export async function verifyTeamQrToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET, { clockTolerance: 60 });
    return payload.type === 'attendance' ? (payload.team_id as string) : null;
  } catch {
    return null;
  }
}

export const qrTokenToDataUrl = (token: string) =>
  QRCode.toDataURL(token, { width: 400, margin: 2 });

export const qrTokenToPngBuffer = (token: string) =>
  QRCode.toBuffer(token, { width: 400, margin: 2 });   // for CID email attachment
```

---

## PART D: Admin Panel (payments + teams — no attendance, no rounds)

### D.1 `app/api/admin/payments/verify/route.ts`

`requirePanel('admin')` →

**verify=true:**
1. `payments.status='verified'`, `verified_at`, `admin_notes` → trigger syncs `teams`.
2. `signTeamQrToken(team_id)` → save to `teams.qr_token`.
3. Fetch members; for each: `sendPaymentVerifiedEmail({ to, member_id, team_id, team_name, team_code, qr_image_data_url })` (façade handles SMTP + CID attachment + logging).

**verify=false:** `status='pending'`, null `teams.qr_token` (revokes the QR — resolve checks DB match), `sendPaymentIssueEmail` to lead.

Return counts: `{ success: true, message: 'Payment verified. QR generated, 3 emails sent.' }`.

### D.2 `GET /api/admin/teams/route.ts`

`requirePanel('admin')` → teams with `members(*), payments(*), attendance_records(*, attendance_checkpoints(code,label))`, filters `status`/`search` (ilike on code/name), pagination. Attendance data included **read-only** for the roster view.

### D.3 Pages

- `app/admin/page.tsx` — counters: total teams, verified, pending, emails failed (from `email_logs`).
- `app/admin/payments/page.tsx` — client table: search (debounced), status filter, verify/unverify button with confirm dialog, notes popover. Calls your cookie-authed APIs with plain `fetch` (**no `x-admin-key` header — that pattern is dead; never put secrets in `NEXT_PUBLIC_*`**).
- `app/admin/teams/page.tsx` — roster; per team an attendance chip row like `R1 ✓2 · R2 ✓1 · R3 — · R4P1 — · R4P2 —`.

---

## PART E: Attendance Panel — `/attendance` (standalone, mobile-first)

### E.1 UX contract

```
┌──────────────────────────────────────┐
│ Checkpoint: [Round 2 — Cave Biome ▼] │  ← from /api/attendance/checkpoints,
│                                      │     persisted in localStorage
│  ┌────────────────────────────────┐  │
│  │        LIVE CAMERA VIEW        │  │  ← qr-scanner, rear camera
│  │      (scanning overlay)        │  │
│  └────────────────────────────────┘  │
│  — or —                              │
│  Team code: [MNV-___]  [Find]        │  ← always visible fallback
│                                      │
│  ┌ Team card ─────────────────────┐  │
│  │ Code Crafters · MNV-482 (2)    │  │
│  │ Payment ✅  ·  R1: 2 present    │  │
│  │ Present now:  [0] [1] [•2]     │  │  ← segmented buttons 0..team_size
│  │ [ MARK ROUND 2 ]               │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### E.2 `components/attendance/qr-camera.tsx` (client)

```typescript
'use client';

import { useEffect, useRef } from 'react';
import QrScanner from 'qr-scanner';

export default function QrCamera({ onScan }: { onScan: (data: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    const scanner = new QrScanner(
      videoRef.current,
      (result) => onScan(result.data),
      {
        preferredCamera: 'environment',
        highlightScanRegion: true,
        maxScansPerSecond: 4,
      }
    );
    scanner.start().catch(() => {/* camera denied → manual input still works */});
    return () => { scanner.stop(); scanner.destroy(); };
  }, [onScan]);

  return <video ref={videoRef} className="w-full rounded-xl" />;
}
```

Debounce duplicate scans (ignore the same decoded string for 3 s). After a successful resolve, pause scanning until the team card is dismissed/marked.

### E.3 `POST /api/attendance/resolve/route.ts`

`requirePanel('attendance')` → body `{ qr_token? , team_code? }` (Zod: exactly one).
- `qr_token`: `verifyTeamQrToken()` → **also require `teams.qr_token === qr_token`** (DB match = revocation check).
- `team_code`: normalize (`MNV-` prefix, uppercase) → lookup.
Return team + members + existing `attendance_records` joined with checkpoint codes (API_GUIDE §5.2).

### E.4 `POST /api/attendance/mark/route.ts`

`requirePanel('attendance')` → body `{ team_id: uuid, checkpoint_id: number, members_present: number, method: 'qr_scan'|'manual' }`.
- Validate `0 <= members_present <= team.team_size` (400 otherwise).
- If team not payment-verified: still allow, but include `"warning": "Payment not verified"` in the response.
- **Upsert** on `(team_id, checkpoint_id)`; detect pre-existing row and return `updated: true` so the UI shows an "updated existing mark" toast (client shows a confirm dialog before overwriting).

### E.5 `GET /api/attendance/checkpoints` & `GET /api/attendance/report`

Checkpoints: ordered list for the dropdown. Report: per-checkpoint `teams_marked` + `sum(members_present)`; `?format=csv` streams CSV (roster backup).

---

## PART F: Acceptance Criteria

- [ ] `lib/email/index.ts` stub bodies replaced; **signatures unchanged** (Dev 1's register flow + Dev 3's login OTP start sending real mail with zero edits on their side)
- [ ] OTPs arrive via **Resend**; reg-received/verified/issue emails arrive via **SMTP**; all logged with correct `provider`
- [ ] Resend failure falls back to SMTP for OTPs (test by breaking the API key)
- [ ] Verified email renders in Gmail + Outlook with WhatsApp button (env link), venue/date (env), and a scannable inline QR (CID)
- [ ] `/admin/login` and `/attendance/login` are each a **single password box**; wrong password → generic error; rate limited
- [ ] Admin cookie is rejected by `/api/attendance/*` and attendance cookie by `/api/admin/*` (scope isolation)
- [ ] Verify toggle updates DB, sets `teams.qr_token`, emails all members; unverify revokes the token
- [ ] `/attendance` scans a real printed/on-screen QR **with the camera** on Android + iOS; manual code entry works with camera denied
- [ ] Marking is per **checkpoint** with a **head count**; re-marking the same checkpoint asks to confirm and upserts
- [ ] A revoked (unverified) team's old QR resolves to "Invalid or revoked QR code"
- [ ] `/admin/teams` shows read-only per-checkpoint attendance chips
- [ ] No IP whitelist anywhere; no `x-admin-key`; no secrets in `NEXT_PUBLIC_*`

**Do NOT build:** registration/OTP-send routes (Dev 1), login/dashboard/proxy.ts/round controls (Dev 3). Do not edit `app/admin/layout.tsx`, `package.json`, or any frozen/foundation file.
