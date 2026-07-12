# MINEVERSE Platform — Phase 1 PRD
## Product Requirements Document

**Version:** 2.0
**Date:** 2026-07-12
**Phase:** 1 — Registration, OTP Auth, Payments, Attendance & Dashboard
**Team Size:** 3 Developers (fully independent, zero merge conflicts — see PROMPT_DEV_*.md)
**Stack:** Next.js 16 (App Router) + Supabase + Tailwind CSS v4 + shadcn/ui + Resend (OTP) + Nodemailer/SMTP (all other mail) + Cloudflare Turnstile

---

## 1. Executive Summary

MINEVERSE is a 2-day Minecraft-themed coding competition platform. Phase 1 covers the entire pre-event and event-day entry flow: public landing, **passwordless team registration** (college email verified via OTP *before* submit), UPI payment with manual admin verification, a **standalone password-protected attendance panel** with camera QR scanning and **per-round attendance checkpoints**, admin controls, and the locked dashboard that unlocks rounds via the admin panel.

### What changed from v1.0
| # | Change |
|---|--------|
| 1 | **No passwords anywhere for teams.** Registration and event-day login are OTP-based only. |
| 2 | **OTP emails go through Resend** (free tier, ~100/day). **All other emails go through personal SMTP** (Gmail/personal mailbox via Nodemailer). |
| 3 | **OTP is verified inline, before the submit button.** The registration form's Submit stays disabled until the team lead's college email is verified. |
| 4 | **Attendance is NOT part of the admin panel.** It lives at its own route `/attendance`, protected by its own single-input-box password. |
| 5 | **Attendance uses the device camera** to scan team QR codes (no image upload). Manual team-code entry is the fallback. Staff selects **how many members are present** (a count, not per-member checkboxes). |
| 6 | **Attendance is taken at every checkpoint:** Round 1, Round 2, Round 3, Round 4, and each phase of Round 4. |
| 7 | **Admin panel and attendance panel each use a single input-box password** (from env vars). No usernames. No IP whitelist. |
| 8 | **All changeable data lives in env vars** — event date/time/venue, WhatsApp link, UPI ID, fees, college domain, contact info. The `event_config` DB table is gone. |
| 9 | Stack upgraded to the latest packages (July 2026): Next.js 16, React 19, Tailwind v4, Zod 4, etc. |

---

## 2. Tech Stack (Latest — July 2026)

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | Next.js (App Router) | **16.2.x** | Turbopack is the default bundler; `middleware.ts` is replaced by **`proxy.ts`** |
| UI Library | React | 19.2.x | Server Components + Actions stable |
| Language | TypeScript | 5.x | strict mode |
| Styling | Tailwind CSS | **4.3.x** | CSS-first config (`@import "tailwindcss"` + `@theme`); no `tailwind.config.ts` |
| Components | shadcn/ui | CLI **v4** | `npx shadcn@latest init` (the old `shadcn-ui` CLI is dead) |
| Validation | Zod | **4.x** | `z.email()`, `z.uuid()` top-level APIs |
| Database | Supabase (PostgreSQL) | `@supabase/supabase-js` 2.110+ | Service-role client server-side; anon client only for Realtime |
| OTP Email | Resend | SDK 6.x | Free tier ≈100 emails/day — reserved exclusively for OTPs |
| All other Email | Nodemailer (SMTP) | 9.x | Personal mailbox (e.g., Gmail with App Password) |
| Captcha | Cloudflare Turnstile | `@marsidev/react-turnstile` | Free, invisible |
| QR generation | `qrcode` (npm) | latest | Server-side base64 PNG |
| QR camera scanning | `qr-scanner` (nimiq) | latest | **Do NOT use `html5-qrcode` — it is unmaintained (dead zxing-js port)** |
| JWT | `jose` | 6.x | Sessions, panel cookies, QR signing |
| Forms | react-hook-form + @hookform/resolvers | 7.8x | Zod 4 resolver |
| Unit tests | Vitest | 4.x | Replaces Jest |
| E2E tests | Playwright | 1.61.x | |
| Deployment | Vercel | — | Env vars managed in Vercel dashboard |

> **Install rule for devs:** always `npm install <pkg>@latest` at project start; the versions above are the floor, not a pin.

---

## 3. User Personas

### 3.1 Participant (Team Lead / Member)
Lands on page → Registers team (verifies college email by OTP **inline in the form**) → Pays via UPI QR → Waits for verification → Receives confirmation email (SMTP) with WhatsApp link + team attendance QR → Attends event → On event day, logs in with **team code + OTP** → Sees locked dashboard → Shows team QR at every round checkpoint.

### 3.2 Admin (Organizer)
Opens `/admin` → enters the admin password (single input box) → Verifies payments (toggle) → Controls rounds (lock/unlock) → Monitors teams. **Admin does not mark attendance.**

### 3.3 Attendance Volunteer (Desk / Round Marshal)
Opens `/attendance` on a phone/laptop → enters the attendance password (single input box) → picks the current checkpoint (Round 1 / Round 2 / Round 3 / Round 4 Phase 1 / Round 4 Phase 2) → scans the team's QR with the camera (or types the team code) → selects **how many members are present** → marks. Repeats at every checkpoint.

---

## 4. Functional Requirements

### 4.1 Landing Page (`/`)
- Hero section with event branding (MINEVERSE).
- Two primary CTAs: **Register Now** and **Login to Dashboard**.
- Event details (date, venue, time, fees) come from **env vars** via `GET /api/event/config` (no DB read).
- Rules/FAQ accordion, contact/organizer footer (contact info from env).

### 4.2 Registration Flow (`/register`) — passwordless, OTP-before-submit

**Form fields (per member, max 3):** Full Name, Email, College Email (whitelist domain from env), Phone (10-digit Indian), Section, Department. First member = Team Lead (auto-marked). Solo / Duo / Trio allowed.

**Inline OTP verification (the key UX):**
1. Team lead fills their college email → clicks **"Verify Email"** button next to the field.
2. Client calls `POST /api/otp/send` (purpose `registration`, Turnstile token required) → Resend delivers a 6-digit OTP (10-min expiry).
3. An OTP input appears inline → lead enters code → `POST /api/otp/verify` → on success the field locks with a ✅ "Verified" badge and the client stores a short-lived `verification_token`.
4. **The Submit button is disabled until the lead's college email is verified.**
5. Submit → `POST /api/register` with form data + `challenge_id` + `verification_token`. Server re-checks the token, then creates `teams`, `members`, `payments`, `team_round_access` rows in one go.

**No password field exists.** There is no `/verify-otp` page anymore — OTP happens inside the form.

**Team Code:** `MNV-XXX` (random 3 digits, zero-padded, non-sequential, unique via DB function + unique constraint).

**Security:** Turnstile server-side verify on OTP send; honeypot field `website_url` on register; rate limits (5 registrations/IP/hour; 3 OTP sends per email per 10 min); OTPs stored **hashed** (SHA-256), max 3 verify attempts.

**Post-submit:**
1. "Registration received — payment pending" email to team lead via **SMTP** (Nodemailer).
2. Redirect to `/payment?team=MNV-XXX`.

### 4.3 Payment Flow (`/payment`)
- Dynamic UPI QR (`upi://pay?pa=<UPI_ID>&pn=<UPI_PAYEE_NAME>&am=<amount>&tn=Team-MNV-XXX&cu=INR`).
- Amount from env: `FEE_SOLO` / `FEE_DUO` / `FEE_TRIO` mapped by team size.
- Downloadable QR PNG, payment instructions, live status pill (Pending / Verified / Rejected).

### 4.4 Admin Panel (`/admin`) — single password box
- `/admin/login`: **one password input** compared against `ADMIN_PASSWORD` env var → on success a signed, httpOnly `panel_session` cookie (JWT, scope `admin`, 12 h) is set. No username. **No IP whitelist.**
- `/admin/payments`: table of all teams — verify/unverify toggle, filter, debounced search, notes.
  - On verify: `payments.status='verified'` → trigger syncs `teams.is_payment_verified=true` → generate the team's **attendance QR** (JWT signed with `ATTENDANCE_QR_SECRET`, stored as `teams.qr_token`) → email **all members** via **SMTP**: WhatsApp link, venue, date, time, embedded QR image.
- `/admin/teams`: read-only roster with member details and per-checkpoint attendance summary (read-only view; marking happens only at `/attendance`).
- `/admin/rounds`: round lock/unlock toggles, timers, +5 min extension, live team counters.

### 4.5 Attendance Panel (`/attendance`) — standalone, NOT in admin
- `/attendance/login`: **one password input** compared against `ATTENDANCE_PASSWORD` env var → `panel_session` cookie (scope `attendance`, 24 h).
- Main screen:
  1. **Checkpoint selector** (dropdown): Round 1 / Round 2 / Round 3 / Round 4 – Phase 1 / Round 4 – Phase 2. Persisted in localStorage so the marshal picks once.
  2. **Camera QR scanner** (`qr-scanner` library, live camera — no file upload) that decodes the team QR JWT → `POST /api/attendance/resolve`.
  3. **Manual fallback:** team code input (`MNV-XXX`).
  4. Team card appears: name, code, size, payment status, previous checkpoint marks.
  5. **"How many members present?" selector** (0 … team_size stepper/segmented buttons).
  6. **Mark** button → `POST /api/attendance/mark` (upserts `attendance_records` for `(team_id, checkpoint)`). Re-marking the same checkpoint shows a "already marked — update?" confirm.
- Works one-handed on a phone. Big tap targets. Camera permission prompt handled gracefully with the manual input always visible.

### 4.6 Event-Day Login (`/login`) — OTP-based, no password
1. Team enters **team code only** → `POST /api/auth/login/request-otp`.
2. Server gates **before** burning Resend quota: current date must equal `EVENT_DATE` (env), team must exist, `is_payment_verified` must be true. Errors are specific but non-enumerating.
3. OTP (6-digit, 10-min, hashed at rest) is sent to the **team lead's college email** via **Resend**. Response includes the masked email (`ra•••@college.edu.in`).
4. Team enters OTP → `POST /api/auth/login/verify` → httpOnly `session_token` JWT cookie (SameSite=Strict, 24 h) → redirect `/dashboard`.

> Attendance no longer gates login (attendance is per-round now). Gates: **event date + payment verified** only.

### 4.7 Dashboard (`/dashboard`)
- Header: team code, team name, logout. Sidebar: members list, payment status.
- **Day 1:** 3 round cards (Forest & Grasslands, Cave Biome, Mountain Biome) — Locked / Active / Completed states. Unlock only when admin toggles.
- **Day 2:** locked placeholder ("available tomorrow").
- Resource bar placeholder (zeros — Phase 2).
- Live updates via Supabase Realtime broadcast + 10 s polling fallback.
- `/dashboard/qr`: team can re-view their attendance QR if the email is lost.

### 4.8 Admin Round Controls (`/admin/rounds`)
- Table of 4 rounds (3× Day 1, 1× Day 2). Toggle Lock/Unlock per round.
- Unlock → `rounds.status='active'`, `started_at=now()`, unlock `team_round_access` for all payment-verified teams, broadcast `round_unlocked` on Realtime channel.
- Countdown timer per active round; **"+5 minutes"** emergency button; early-lock button.

### 4.9 Email Matrix (who sends what, via which provider)

| Email | Trigger | Provider | Recipient |
|-------|---------|----------|-----------|
| **OTP — registration email verify** | "Verify Email" click in form | **Resend** | Team lead college email |
| **OTP — event-day login** | Login request | **Resend** | Team lead college email |
| Registration received (payment pending) | Successful register | **SMTP** (Nodemailer) | Team lead |
| Payment verified / "You're In!" (+ QR, WhatsApp, venue) | Admin verifies payment | **SMTP** | All members |
| Payment unverified / issue notice | Admin unverifies | **SMTP** | Team lead |
| Event reminder (optional, D-1) | Manual script | **SMTP** | All members |

Every send (both providers) is logged to `email_logs` with a `provider` column.

---

## 5. Non-Functional Requirements

- **Performance:** page load < 2 s; QR generation < 500 ms; camera scan decode < 1 s.
- **Security:** OTPs hashed at rest; all panel/team routes behind signed httpOnly cookies via `proxy.ts`; Zod 4 on every input; Supabase client only (no raw SQL from app); rate limiting on all public endpoints; RLS deny-all (service-role-only data access).
- **Resend budget:** OTPs only. Worst case: ~2 OTPs per registration + 1–2 per login. 100/day free tier covers ~40 registrations/day; monitor `email_logs`, and registration OTP resend is throttled to 3 per email per 10 min.
- **Availability:** 99% during event days (Vercel + Supabase).
- **Scalability:** 50+ concurrent registrations.
- **Mobile-first:** attendance panel is designed for phones (camera + big buttons).

---

## 6. Environment Variables (single source of changeable data)

Everything an organizer might change lives here — never hardcode these in components.
`NEXT_PUBLIC_*` values are exposed to the browser (display-only data). Secrets never get the prefix.

```env
# ── App ─────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://mineverse.vercel.app

# ── Supabase ────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# ── Email: OTP via Resend (free tier — OTP ONLY) ────
RESEND_API_KEY=
RESEND_FROM="MINEVERSE <otp@mineverse.tech>"

# ── Email: everything else via personal SMTP ────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=youraddress@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM="MINEVERSE Team <youraddress@gmail.com>"

# ── Captcha ─────────────────────────────────────────
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

# ── Event details (ALL changeable event data) ───────
NEXT_PUBLIC_EVENT_NAME="MINEVERSE 2026"
EVENT_DATE=2026-08-15                       # server-side login gate (YYYY-MM-DD, IST)
NEXT_PUBLIC_EVENT_DATE_DISPLAY="15 August 2026"
NEXT_PUBLIC_EVENT_TIME="11:00 AM"
NEXT_PUBLIC_EVENT_VENUE="Main Auditorium, College"
NEXT_PUBLIC_REGISTRATION_OPEN=true
WHATSAPP_GROUP_LINK=https://chat.whatsapp.com/...   # server-only, goes into emails
NEXT_PUBLIC_CONTACT_EMAIL=team@mineverse.tech
NEXT_PUBLIC_CONTACT_PHONE=+91XXXXXXXXXX

# ── Payment (changeable) ────────────────────────────
UPI_ID=mineverse@upi
UPI_PAYEE_NAME=MINEVERSE
FEE_SOLO=100
FEE_DUO=180
FEE_TRIO=250

# ── Validation ──────────────────────────────────────
NEXT_PUBLIC_COLLEGE_EMAIL_DOMAIN=@college.edu.in

# ── Auth secrets ────────────────────────────────────
JWT_SECRET=                      # 32+ random bytes
ATTENDANCE_QR_SECRET=            # 32+ random bytes, signs team QR JWTs
ADMIN_PASSWORD=                  # /admin single-box password
ATTENDANCE_PASSWORD=             # /attendance single-box password (different from admin)

# ── OTP tuning ──────────────────────────────────────
OTP_EXPIRY_MINUTES=10
OTP_MAX_ATTEMPTS=3
```

A `lib/env.ts` module validates all of these with Zod 4 at boot and fails the build if any are missing.

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Resend free tier exceeded (100/day) | Resend is OTP-only; everything else on SMTP. Throttle resends. If exhausted mid-event, flip OTP sends to the SMTP transport via a one-line provider fallback in `lib/email`. |
| Gmail SMTP daily cap (~500/day) hit | Verified emails are the bulk sender; batch member emails per team, keep reminder emails optional. |
| Camera scan fails at venue (light/permissions) | Manual team-code input is always visible on the attendance panel. |
| Attendance password leaked | It only grants attendance marking (scoped JWT cookie); rotate the env var and redeploy — sessions invalidate on secret rotation. |
| Team code collision | DB unique constraint + `generate_team_code()` retry loop. |
| Team lead loses QR email | `/dashboard/qr` re-displays it; attendance panel also accepts manual team code. |
| Admin panel exposed | Scoped signed cookie, rate-limited login, generic error messages. (Explicitly no IP whitelist per requirements.) |
| Vercel/Supabase outage | Printed team roster backup (from `/admin/teams` export) + attendance can fall back to paper. |
