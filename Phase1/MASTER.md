# MINEVERSE — MASTER.md
## Phase 1 Implementation Checklist (v2.0)

**Status Legend:**
🔴 Not Started | 🟡 In Progress | 🟢 Done | ⚪ N/A (Future Phase)

**Ground rules for this checklist:**
- Stack is the **latest** (July 2026): Next.js **16.2.x**, React 19, Tailwind **v4**, Zod **4**, shadcn CLI **v4**, `qr-scanner` for camera scanning. Not Next 14.
- **No passwords for teams.** Everything is OTP.
- **OTP mail = Resend. Every other mail = personal SMTP (Nodemailer).**
- **Attendance ≠ admin.** `/attendance` is its own password-protected route.
- **Changeable data lives in env vars** (event details, WhatsApp, UPI, fees). No `event_config` table.
- Devs work only inside their owned files (see §16) — zero merge conflicts by construction.

---

## 1. Project Setup & Infrastructure (Dev 1 — Day 0 Foundation)

| # | Feature | Owner | Status | Notes |
|---|---------|-------|--------|-------|
| 1.1 | Initialize **Next.js 16** project (App Router, TypeScript, Turbopack) | Dev 1 | 🔴 | `npx create-next-app@latest` |
| 1.2 | Tailwind CSS **v4** (CSS-first config) + shadcn/ui via **`npx shadcn@latest init`** | Dev 1 | 🔴 | No `tailwind.config.ts`; theme in `globals.css` `@theme` |
| 1.3 | Setup Supabase project & run all migrations | Dev 1 | 🔴 | DATABASE.md §7 order |
| 1.4 | Install ALL dependencies up front (freeze `package.json`) | Dev 1 | 🔴 | `zod resend nodemailer jose qrcode qr-scanner @supabase/supabase-js react-hook-form @hookform/resolvers @marsidev/react-turnstile lucide-react` + dev: `vitest playwright @types/qrcode @types/nodemailer` — all `@latest` |
| 1.5 | `lib/env.ts` — Zod 4 validation of every env var, fail build if missing | Dev 1 | 🔴 | PRD §6 list |
| 1.6 | Foundation stubs: `lib/email/index.ts` (no-op), `lib/panel/session.ts`, `types/index.ts`, root layout, admin layout shell | Dev 1 | 🔴 | Frozen after Day 0 — see §16 ownership |
| 1.7 | Configure Resend (OTP sender) + SMTP app password (personal mail) | Dev 2 | 🔴 | Two transports |
| 1.8 | Cloudflare Turnstile keys | Dev 1 | 🔴 | |
| 1.9 | Vercel deployment + all env vars | Dev 1 | 🔴 | |
| 1.10 | GitHub repo: `main` protected, `dev`, `feature/dev1|dev2|dev3` | Dev 1 | 🔴 | |

---

## 2. Database Implementation (Dev 1)

| # | Feature | Owner | Status | Notes |
|---|---------|-------|--------|-------|
| 2.1 | `teams` (no password_hash, + `qr_token`) | Dev 1 | 🔴 | |
| 2.2 | `members` | Dev 1 | 🔴 | unique college_email |
| 2.3 | `payments` | Dev 1 | 🔴 | amount snapshot from env fees |
| 2.4 | `otp_challenges` (hashed OTPs, dual purpose) | Dev 1 | 🔴 | replaces temp_otp |
| 2.5 | `rounds` + seed 4 | Dev 1 | 🔴 | |
| 2.6 | `attendance_checkpoints` + seed 5 (R1, R2, R3, R4-P1, R4-P2) | Dev 1 | 🔴 | new |
| 2.7 | `attendance_records` (head count, unique team+checkpoint) | Dev 1 | 🔴 | new |
| 2.8 | `team_round_access` | Dev 1 | 🔴 | |
| 2.9 | `email_logs` (+ `provider` column) | Dev 1 | 🔴 | |
| 2.10 | Functions: `generate_team_code()`, `update_updated_at_column()`, `sync_payment_verification()` + triggers | Dev 1 | 🔴 | |
| 2.11 | RLS: enable on all tables, **deny-all** (no policies) | Dev 1 | 🔴 | service-role only |
| 2.12 | OTP cleanup job (pg_cron / scheduled function) | Dev 1 | 🔴 | |
| 2.13 | `npx supabase gen types typescript` → `types/supabase.ts` | Dev 1 | 🔴 | part of frozen foundation |

---

## 3. Landing Page (Dev 1)

| # | Feature | Owner | Status | Notes |
|---|---------|-------|--------|-------|
| 3.1 | Hero + MINEVERSE branding | Dev 1 | 🔴 | |
| 3.2 | Event details card from `/api/event/config` (**env-backed**) | Dev 1 | 🔴 | |
| 3.3 | Register Now + Login CTAs | Dev 1 | 🔴 | |
| 3.4 | Rules/FAQ accordion, contact footer (env contact info) | Dev 1 | 🔴 | |
| 3.5 | Mobile responsive + SEO/OG tags | Dev 1 | 🔴 | |

---

## 4. Registration Flow (Dev 1) — passwordless, OTP inline

| # | Feature | Owner | Status | Notes |
|---|---------|-------|--------|-------|
| 4.1 | Registration form UI (no password field) | Dev 1 | 🔴 | |
| 4.2 | Dynamic member fields (1–3), lead auto-marked | Dev 1 | 🔴 | |
| 4.3 | **Inline "Verify Email" button** on lead college email | Dev 1 | 🔴 | shows OTP input in-place |
| 4.4 | `POST /api/otp/send` (Turnstile + domain + dup check + throttle) | Dev 1 | 🔴 | Resend, via `lib/email` |
| 4.5 | `POST /api/otp/verify` (hash compare, 3 attempts) | Dev 1 | 🔴 | returns verification_token |
| 4.6 | **Submit disabled until verified** (✅ badge + locked field) | Dev 1 | 🔴 | requirement #5 |
| 4.7 | `POST /api/register` — re-validate verified challenge server-side | Dev 1 | 🔴 | |
| 4.8 | Honeypot + rate limit (5/IP/hr) | Dev 1 | 🔴 | |
| 4.9 | Team code MNV-XXX via DB function | Dev 1 | 🔴 | |
| 4.10 | Create teams/members/payments/team_round_access | Dev 1 | 🔴 | |
| 4.11 | "Registration received" email → lead (**SMTP**, via `lib/email` stub) | Dev 1 | 🔴 | Dev 2 makes stub real |
| 4.12 | Redirect `/payment?team=MNV-XXX` | Dev 1 | 🔴 | |

---

## 5. Payment Page (Dev 1)

| # | Feature | Owner | Status | Notes |
|---|---------|-------|--------|-------|
| 5.1 | `/payment` UI: amount, status pill, instructions | Dev 1 | 🔴 | |
| 5.2 | Dynamic UPI QR from env `UPI_ID`/`UPI_PAYEE_NAME`/`FEE_*` | Dev 1 | 🔴 | `upi://pay?...&tn=Team-MNV-XXX` |
| 5.3 | Downloadable QR PNG | Dev 1 | 🔴 | |
| 5.4 | `GET /api/payment/status` | Dev 1 | 🔴 | |

---

## 6. Email System (Dev 2) — dual provider

| # | Feature | Owner | Status | Notes |
|---|---------|-------|--------|-------|
| 6.1 | `lib/email/resend.ts` — **OTP mail only** | Dev 2 | 🔴 | Resend SDK 6 |
| 6.2 | `lib/email/smtp.ts` — Nodemailer 9, personal mailbox | Dev 2 | 🔴 | Gmail app password |
| 6.3 | Replace `lib/email/index.ts` foundation stub with real router: `sendOtpEmail` → Resend, everything else → SMTP | Dev 2 | 🔴 | signatures frozen |
| 6.4 | Templates: OTP, reg-received, payment-verified (QR+WhatsApp+venue from env), payment-issue | Dev 2 | 🔴 | |
| 6.5 | All sends logged to `email_logs` with `provider` | Dev 2 | 🔴 | |
| 6.6 | Fallback: if Resend fails, OTP retries once through SMTP | Dev 2 | 🔴 | quota safety |

---

## 7. Panel Auth (Dev 2) — single password box, no IP whitelist

| # | Feature | Owner | Status | Notes |
|---|---------|-------|--------|-------|
| 7.1 | `POST /api/panel/login` (`panel`: admin\|attendance) | Dev 2 | 🔴 | constant-time compare vs env |
| 7.2 | Scoped `panel_session` JWT cookie (admin 12 h / attendance 24 h) | Dev 2 | 🔴 | uses frozen `lib/panel/session.ts` |
| 7.3 | `/admin/login` page — one password input | Dev 2 | 🔴 | |
| 7.4 | `/attendance/login` page — one password input | Dev 2 | 🔴 | |
| 7.5 | Login rate limiting (10/min/IP) | Dev 2 | 🔴 | |

---

## 8. Admin Panel (Dev 2, except rounds page)

| # | Feature | Owner | Status | Notes |
|---|---------|-------|--------|-------|
| 8.1 | `/admin` home (counters: teams, verified, pending) | Dev 2 | 🔴 | |
| 8.2 | `/admin/payments` table: verify/unverify toggle, filter, search, notes | Dev 2 | 🔴 | |
| 8.3 | On verify: sign QR JWT → `teams.qr_token`; SMTP email to **all members** w/ QR + WhatsApp + venue | Dev 2 | 🔴 | |
| 8.4 | On unverify: revoke `qr_token`, notice email | Dev 2 | 🔴 | |
| 8.5 | `/admin/teams` roster + **read-only** attendance summary | Dev 2 | 🔴 | marking only at /attendance |
| 8.6 | `GET /api/admin/teams`, `POST /api/admin/payments/verify` | Dev 2 | 🔴 | cookie-auth, no x-admin-key |

---

## 9. Attendance Panel (Dev 2) — standalone `/attendance`

| # | Feature | Owner | Status | Notes |
|---|---------|-------|--------|-------|
| 9.1 | `/attendance` main screen (mobile-first) | Dev 2 | 🔴 | |
| 9.2 | Checkpoint dropdown (R1/R2/R3/R4-P1/R4-P2) persisted in localStorage | Dev 2 | 🔴 | from `/api/attendance/checkpoints` |
| 9.3 | **Camera QR scanner** using `qr-scanner` (live camera, NO upload) | Dev 2 | 🔴 | html5-qrcode is unmaintained — do not use |
| 9.4 | Manual team code input fallback (always visible) | Dev 2 | 🔴 | |
| 9.5 | `POST /api/attendance/resolve` (QR JWT verify + revocation check, or team_code) | Dev 2 | 🔴 | |
| 9.6 | Team card: members, size, previous checkpoint marks | Dev 2 | 🔴 | |
| 9.7 | **"How many present?" stepper (0..team_size)** | Dev 2 | 🔴 | count, not checkboxes |
| 9.8 | `POST /api/attendance/mark` — upsert per (team, checkpoint), "already marked" confirm | Dev 2 | 🔴 | |
| 9.9 | `GET /api/attendance/report` + CSV export | Dev 2 | 🔴 | |

---

## 10. Login System (Dev 3) — OTP, event-day gated

| # | Feature | Owner | Status | Notes |
|---|---------|-------|--------|-------|
| 10.1 | `/login` page: step 1 team code → step 2 OTP input | Dev 3 | 🔴 | no password field |
| 10.2 | `POST /api/auth/login/request-otp` — gates (EVENT_DATE env, payment verified) **before** sending | Dev 3 | 🔴 | protects Resend quota |
| 10.3 | OTP → lead college email via `lib/email.sendOtpEmail` | Dev 3 | 🔴 | Resend under the hood |
| 10.4 | `POST /api/auth/login/verify` → `session_token` cookie | Dev 3 | 🔴 | jose, 24 h |
| 10.5 | `POST /api/auth/logout` | Dev 3 | 🔴 | |
| 10.6 | **`proxy.ts`** (Next 16 — not middleware.ts): team/admin/attendance route guards | Dev 3 | 🔴 | scope-aware redirects |
| 10.7 | Redirects: unauth`→/login`; authed `/login→/dashboard` | Dev 3 | 🔴 | |
| 10.8 | Safe error messages (no team enumeration) | Dev 3 | 🔴 | |

---

## 11. Dashboard (Dev 3)

| # | Feature | Owner | Status | Notes |
|---|---------|-------|--------|-------|
| 11.1 | `/dashboard` layout: header, team sidebar, logout | Dev 3 | 🔴 | |
| 11.2 | Day 1: 3 round cards (Locked/Active/Completed) | Dev 3 | 🔴 | |
| 11.3 | Day 2 locked placeholder | Dev 3 | 🔴 | |
| 11.4 | Resource bar placeholder (zeros) | Dev 3 | 🔴 | Phase 2 |
| 11.5 | Realtime `round_status` subscribe + 10 s polling fallback | Dev 3 | 🔴 | |
| 11.6 | `/dashboard/qr` — re-view attendance QR | Dev 3 | 🔴 | `GET /api/team/qr` |
| 11.7 | `GET /api/team/me`, `GET /api/team/dashboard` | Dev 3 | 🔴 | |
| 11.8 | Mobile responsive | Dev 3 | 🔴 | |

---

## 12. Admin Round Controls (Dev 3)

| # | Feature | Owner | Status | Notes |
|---|---------|-------|--------|-------|
| 12.1 | `/admin/rounds` page (Dev 3 owns this file inside Dev 2's admin area — separate file, no conflict) | Dev 3 | 🔴 | |
| 12.2 | Toggle lock/unlock per round → `POST /api/admin/rounds/toggle` | Dev 3 | 🔴 | |
| 12.3 | Unlock updates `team_round_access` for payment-verified teams + Realtime broadcast | Dev 3 | 🔴 | |
| 12.4 | Countdown timer per active round + "+5 min" extend | Dev 3 | 🔴 | `ends_at` based |
| 12.5 | Live counters (teams unlocked/completed) | Dev 3 | 🔴 | |

---

## 13. Security & Hardening

| # | Feature | Owner | Status | Notes |
|---|---------|-------|--------|-------|
| 13.1 | Zod 4 schemas on every input | All | 🔴 | |
| 13.2 | OTPs hashed at rest (sha256 + secret) | Dev 1 | 🔴 | |
| 13.3 | OTP throttles: 3 sends/email/10 min; 3 verify attempts | Dev 1/3 | 🔴 | |
| 13.4 | Panel cookies scoped (`admin` ≠ `attendance`) | Dev 2 | 🔴 | admin cookie can't mark attendance and vice versa |
| 13.5 | Constant-time password compare for panels | Dev 2 | 🔴 | `crypto.timingSafeEqual` |
| 13.6 | QR revocation: resolve checks `teams.qr_token` match, not just signature | Dev 2 | 🔴 | |
| 13.7 | SameSite=Strict httpOnly cookies everywhere | Dev 3 | 🔴 | |
| 13.8 | Rate limiting on all public endpoints | Dev 1 | 🔴 | |
| 13.9 | Turnstile server-side verification on OTP send | Dev 1 | 🔴 | |
| 13.10 | Honeypot validation on register | Dev 1 | 🔴 | |
| 13.11 | `lib/env.ts` fails build on missing env vars | Dev 1 | 🔴 | |
| 13.12 | ~~IP whitelist for admin~~ | — | ⚪ | **Explicitly excluded** per requirements |

---

## 14. Testing & QA (see TESTING.md)

| # | Feature | Owner | Status | Notes |
|---|---------|-------|--------|-------|
| 14.1 | Unit tests (Vitest 4) | All | 🔴 | |
| 14.2 | API route tests | All | 🔴 | |
| 14.3 | E2E: registration w/ inline OTP (Playwright 1.61) | QA | 🔴 | |
| 14.4 | E2E: OTP login + dashboard | QA | 🔴 | |
| 14.5 | E2E: admin verify, attendance mark, round unlock | QA | 🔴 | |
| 14.6 | Camera scan test on real Android + iOS | Dev 2 | 🔴 | |
| 14.7 | Email deliverability (Resend OTP + SMTP bulk) | Dev 2 | 🔴 | |
| 14.8 | Load test: 50 concurrent registrations (k6) | QA | 🔴 | |
| 14.9 | Security checklist (TESTING.md §7) | QA | 🔴 | |

---

## 15. Pre-Event Deployment Checklist

| # | Task | Owner | Deadline | Status |
|---|------|-------|----------|--------|
| 15.1 | All env vars set in Vercel (PRD §6, incl. both panel passwords) | Dev 1 | D-7 | 🔴 |
| 15.2 | DB migrated + rounds/checkpoints seeded | Dev 1 | D-7 | 🔴 |
| 15.3 | Resend domain verified + SMTP app password tested | Dev 2 | D-7 | 🔴 |
| 15.4 | Email templates reviewed on Gmail/Outlook | Dev 2 | D-7 | 🔴 |
| 15.5 | QR generation + camera scan rehearsed on venue phones | Dev 2 | D-3 | 🔴 |
| 15.6 | Login date gate tested (EVENT_DATE flip) | Dev 3 | D-3 | 🔴 |
| 15.7 | Round unlock flow rehearsed | Dev 3 | D-3 | 🔴 |
| 15.8 | Attendance volunteers briefed + password distributed | Organizer | D-1 | 🔴 |
| 15.9 | Team roster CSV exported (paper backup) | Dev 2 | D-1 | 🔴 |
| 15.10 | WhatsApp group link live in env | Organizer | D-7 | 🔴 |
| 15.11 | Venue WiFi + phone camera check | Organizer | D-1 | 🔴 |

---

## 16. File Ownership Matrix (zero-merge-conflict contract)

**Rule: after the Day-0 foundation commit, every file has exactly one owner. Nobody edits a file they don't own. `package.json`, foundation stubs' signatures, and shared types are frozen — changing them requires a group call.**

```
mineverse/
├── proxy.ts                                  # DEV 3   (Next 16: replaces middleware.ts)
├── package.json                              # FROZEN  (all deps installed Day 0)
├── app/
│   ├── layout.tsx, globals.css               # FROZEN  (foundation)
│   ├── page.tsx                              # DEV 1   landing
│   ├── register/page.tsx                     # DEV 1
│   ├── payment/page.tsx                      # DEV 1
│   ├── login/page.tsx                        # DEV 3
│   ├── dashboard/**                          # DEV 3
│   ├── admin/
│   │   ├── layout.tsx                        # FROZEN  (nav lists all pages up front)
│   │   ├── page.tsx, login/, payments/, teams/   # DEV 2
│   │   └── rounds/page.tsx                   # DEV 3   (own file inside admin — no conflict)
│   ├── attendance/**                         # DEV 2   (standalone panel)
│   └── api/
│       ├── event/config/route.ts             # DEV 1
│       ├── otp/{send,verify}/route.ts        # DEV 1
│       ├── register/route.ts                 # DEV 1
│       ├── payment/status/route.ts           # DEV 1
│       ├── panel/{login,logout}/route.ts     # DEV 2
│       ├── admin/{teams,payments}/**         # DEV 2
│       ├── admin/rounds/**                   # DEV 3
│       ├── attendance/**                     # DEV 2
│       ├── auth/**                           # DEV 3
│       └── team/**                           # DEV 3
├── components/
│   ├── ui/**                                 # FROZEN  (shadcn, installed Day 0)
│   ├── forms/**                              # DEV 1
│   ├── admin/**                              # DEV 2
│   ├── attendance/**                         # DEV 2
│   ├── rounds/**                             # DEV 3
│   └── dashboard/**                          # DEV 3
├── lib/
│   ├── env.ts                                # FROZEN
│   ├── supabase/{server,client}.ts           # FROZEN
│   ├── panel/session.ts                      # FROZEN  (used by Dev 2 + Dev 3)
│   ├── email/index.ts                        # DEV 2   (stub in foundation, signatures frozen)
│   ├── email/{resend,smtp,templates}.ts      # DEV 2
│   ├── qr/**                                 # DEV 2
│   ├── auth/session.ts                       # DEV 3
│   ├── validation/**                         # DEV 1
│   └── rate-limit.ts                         # FROZEN
├── types/{index,supabase}.ts                 # FROZEN
├── supabase/migrations/**                    # DEV 1
└── tests/
    ├── unit/dev1|dev2|dev3/**                # per-dev dirs
    └── e2e/**                                # QA
```

Cross-dev needs are satisfied by the **frozen stubs**, never by editing another dev's file:
- Dev 1 & Dev 3 send emails only through `lib/email/index.ts` (Dev 2 fills in the implementation behind the frozen signatures).
- Dev 2 & Dev 3 check panel cookies only through `lib/panel/session.ts` (foundation).
- Nobody touches `package.json` after Day 0.

---

## 17. Phase 2 Handoff Items (Do NOT build in Phase 1)

| # | Feature | Status |
|---|---------|--------|
| 17.1 | Round questions & submission system | ⚪ |
| 17.2 | LLM grading integration (Groq) | ⚪ |
| 17.3 | Resource management | ⚪ |
| 17.4 | Guardian battles / marketplace / world events | ⚪ |
| 17.5 | Leaderboard & elimination logic | ⚪ |
| 17.6 | Day 2 qualification gates | ⚪ |
| 17.7 | Piston API code execution | ⚪ |

---

**Last Updated:** 2026-07-12
**Next Review:** After Dev 1 completes the Day-0 foundation commit
