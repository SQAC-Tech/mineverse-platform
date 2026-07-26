# Phase 1 Backend — Deep Walkthrough (already built)

Phase 1 is **done and live in the repo**. This doc is a guided tour of the real code, so you can read it side-by-side with the actual files. If you find this doc disagreeing with the code, the code wins — Phase 1 evolved slightly past its original spec (noted below where that happened).

Read [00-how-the-backend-works.md](./00-how-the-backend-works.md) first — this doc assumes you know what deny-all RLS, the three cookies, `proxy.ts`, and the ledger pattern are.

## What Phase 1 covers

Registration → payment → admin verification → event-day login → team dashboard → round unlock/lock → per-round attendance scanning. Everything up to "a team can see their round cards" — no gameplay yet (that's Phase 2/3).

## The database (`supabase/migrations/001` through `011`)

| Table | One-line purpose |
|---|---|
| `teams` | One row per registered team. `team_code` (`MNV-XXX`), `status`, `is_payment_verified` (a cache flag kept in sync by a trigger), `qr_token` (their signed attendance QR, set once payment is verified) |
| `members` | One row per person. `college_email` is globally unique — this is how we prevent someone joining two teams |
| `payments` | One row per team (1:1). `amount` is snapshotted at registration time so a later fee change in env vars doesn't retroactively change what an already-registered team owes. Also holds `transaction_id` and `sender_name` — see the payment-flow note below |
| `otp_challenges` | Shared by both OTP flows (registration email verification, and event-day login). OTPs are stored **hashed** (`sha256(otp + secret)`), never in plaintext — a database leak never leaks live codes |
| `rounds` | The 5 rounds, seeded once. `status` (`locked`/`active`/`completed`), `starts_at`/`ends_at` |
| `attendance_checkpoints` | The 5 moments attendance gets taken (one per round), seeded once |
| `attendance_records` | One row per (team, checkpoint) — a **head count** (`members_present`), not a per-person list. Volunteers count heads, they don't check off names |
| `team_round_access` | Per-team, per-round lock state — this is what actually gates "can this team open Round 2 right now" |
| `email_logs` | Audit trail of every email sent, which provider sent it, and whether it succeeded |

All of the above have RLS enabled with **no policies** — see [00-how-the-backend-works.md §2](./00-how-the-backend-works.md). Every read/write goes through `lib/supabase/server.ts` inside a `route.ts` file.

Two DB functions worth knowing about (in `009_functions_triggers.sql`):
- `generate_team_code()` — picks a random unused `MNV-XXX` code
- `sync_payment_verification()` — a trigger that automatically flips `teams.is_payment_verified` and `teams.status` whenever `payments.status` changes, so application code never has to remember to update both tables

## The three auth flows, in the order a team experiences them

### 1. Registration (`POST /api/otp/send` → `POST /api/otp/verify` → `POST /api/register`)

The important design decision: **the OTP is verified before the form is even submitted**, not after. The "Verify Email" button next to the lead's college email field is a separate action from the form's Submit button.

```
Lead types college email, clicks "Verify Email" (NOT the form submit)
  → POST /api/otp/send
      - verifies the Cloudflare Turnstile captcha token server-side
      - checks the email domain against NEXT_PUBLIC_COLLEGE_EMAIL_DOMAIN
      - rejects if that college_email is already in `members` (409)
      - throttles to 3 sends per email per 10 minutes (429)
      - generates a 6-digit code, stores sha256(code) in otp_challenges
      - emails it via Resend
  → client shows an inline OTP input, form's Submit stays disabled

Lead types the 6-digit code
  → POST /api/otp/verify
      - checks expiry, checks attempts < 3 (increments on a miss)
      - compares the hash, marks the challenge row verified=true
      - returns a verification_token
  → client stores verification_token in hidden form fields, Submit unlocks

Lead fills the rest of the form (members, payment details), clicks Submit
  → POST /api/register
      - re-checks that challenge_id + verification_token match a VERIFIED,
        UNEXPIRED row whose email equals the lead's college_email
        (this is what actually enforces "you can't submit without verifying" —
         a client-side disabled button alone would not be secure)
      - checks every member's college_email isn't already registered
      - generates the team code, inserts teams/members/payments/team_round_access
      - deletes the now-consumed otp_challenges row (single use)
      - sends a "registration received" email via SMTP (not Resend — see below)
      - responds with { team_code, redirect: "/payment?team=MNV-XXX" }
```

**Why two email providers?** OTPs go through **Resend** because it's fast and reliable for time-sensitive single emails, but has a limited free quota. Every other email (registration received, payment verified, payment issue) goes through a **personal SMTP mailbox via Nodemailer**, which has no meaningful send-rate concern for our volume. This split is enforced in exactly one place — `lib/email/index.ts` — so a route never picks a provider itself, it just calls `sendOtpEmail(...)` or `sendRegistrationReceivedEmail(...)` and the routing is handled for it.

### 2. Payment — **note: this deviates from the original written spec**

The original Phase 1 spec (`../Phase1/API_GUIDE.md`) describes "register first, then see a payment QR and wait for admin verification." **The actual shipped code pays first:**

```
While filling the registration form, once the lead's email is OTP-verified,
the form fetches GET /api/payment/qr?size=<member count>
  - this is a PRE-registration QR — no team exists yet
  - amount is derived purely from team size (env FEE_SOLO/FEE_DUO/FEE_TRIO)
  - returns a upi://pay?... deep link rendered as a QR image

Lead scans it, pays via their UPI app, and gets a transaction/reference ID
Lead types that transaction_id + their sender_name into the SAME form
  → this is submitted as part of POST /api/register (see above) —
    payments.status starts as 'pending', holding those two fields for
    the admin to manually cross-reference

/payment?team=MNV-XXX (after registration) is now READ-ONLY status display:
  GET /api/payment/status?team=MNV-XXX
  - polls every 15s while status is 'pending'
  - shows the submitted transaction_id/sender_name back to the team,
    and flips to "PAYMENT VERIFIED" / "PAYMENT REJECTED" once an admin acts
```

If you're building on top of the payment flow, **trust the code, not the old spec doc** — the transaction ID / sender name fields on `payments` and the `GET /api/payment/qr?size=N` endpoint are the real, current design.

### 3. Event-day login (`POST /api/auth/login/request-otp` → `POST /api/auth/login/verify`)

Same OTP mechanism as registration, but gated on two extra checks, both enforced **before** an email is even sent (protects the Resend quota from being drained by people repeatedly mistyping their team code):

```
Team enters their team code
  → POST /api/auth/login/request-otp
      gate 1: today (IST) must equal env EVENT_DATE_DAY1 or EVENT_DATE_DAY2
              → else 403 "Login opens on event day."
      gate 2: team must exist → else 401 "Invalid team code" (deliberately
              generic — never reveal whether a code exists, to stop enumeration)
      gate 3: team.is_payment_verified must be true → else 403
      → OTP emailed via Resend to the LEAD's college email (not any member's)

Team enters the OTP
  → POST /api/auth/login/verify
      - same hash/expiry/attempts checks as registration OTP
      - deletes the challenge, signs a session_token JWT, sets it as a cookie
      - response includes { team: { id, team_code, team_name } }
  → proxy.ts now lets this browser into /dashboard/**
```

## Admin flows

### Payment verification (`GET/POST /api/admin/payments`)

```
Admin panel loads GET /api/admin/payments → full list of payments + team info

Admin clicks Verify on a team
  → POST /api/admin/payments { payment_id, action: 'verify' }
      - signs a JWT { team_id, team_code } using ATTENDANCE_QR_SECRET
        (a DIFFERENT secret from the login JWT_SECRET — a leaked QR can't be
        used to forge a login session, and vice versa)
      - stores that JWT string as teams.qr_token
      - sets payments.status = 'verified', verified_at = now()
        (the sync_payment_verification trigger flips teams.is_payment_verified)
      - renders the QR as a PNG (server-side, via the `qrcode` package)
      - emails it to EVERY member (not just the lead) via SMTP, along with
        the WhatsApp group link and venue/date/time — all read from env vars
```

Unverifying reverses this: `payments.status` back to `'pending'`, `teams.qr_token` cleared (this **revokes** the QR — see attendance resolve below), and a notice email sent.

### Round unlock/lock (`GET /api/admin/rounds`, `POST /api/admin/rounds/action`)

```
POST /api/admin/rounds/action { round_id, action: 'unlock' }
  - rounds.status = 'active', starts_at = now(), ends_at = now() + time_allotted
  - team_round_access.is_locked = false for every team with is_payment_verified = true
  - broadcasts "round_unlocked" on the Realtime channel "round_status"
    (see 00-how-the-backend-works.md §6 for how the dashboard picks this up)

action: 'lock' reverses the flags and broadcasts "round_locked"
action: 'extend' pushes ends_at forward and broadcasts "round_extended"
```

### Attendance (`/api/attendance/*` — requires `panel_session` scope `attendance`, NOT `admin`)

This is a deliberately separate cookie scope from admin, because volunteers at the door should never be able to see payment data or unlock rounds, and admins shouldn't need to be handed the attendance-panel password.

```
Volunteer opens /attendance, picks a checkpoint from a dropdown
  → GET /api/attendance/checkpoints (the 5 seeded checkpoints, one per round)

Volunteer scans a team's QR with the phone camera, or types the team code
  → POST /api/attendance/resolve { qr_token } OR { team_code }
      - if qr_token: verifies the JWT signature with ATTENDANCE_QR_SECRET
        AND checks it still matches teams.qr_token in the database
        (this second check is what makes unverifying a payment actually
        revoke the QR — a valid signature alone isn't enough once revoked)
      - if team_code: direct lookup, no signature to check
      - returns the team + their existing per-checkpoint marks

Volunteer sees "how many members are present?" as a stepper (0..team_size —
NOT a checkbox-per-person list, because we only need a head count)
  → POST /api/attendance/mark { team_id, checkpoint_id, members_present, method }
      - upserts on (team_id, checkpoint_id) — re-marking the same checkpoint
        updates the existing row rather than creating a duplicate, and the
        response says updated: true so the UI can show "mark updated"
```

## Full route reference

| Route | Method | Auth | Owner (original) |
|---|---|---|---|
| `/api/event/config` | GET | public | Dev 1 |
| `/api/otp/send`, `/api/otp/verify` | POST | public | Dev 1 |
| `/api/register` | POST | public | Dev 1 |
| `/api/payment/qr` | GET | public | Dev 1 |
| `/api/payment/status` | GET | public | Dev 1 |
| `/api/auth/login/request-otp`, `/verify` | POST | public | Dev 3 |
| `/api/auth/logout` | POST | `session_token` | Dev 3 |
| `/api/panel/login`, `/logout` | POST | public / panel cookie | Dev 2 |
| `/api/admin/teams` | GET | `panel_session` admin | Dev 2 |
| `/api/admin/payments` | GET/POST | `panel_session` admin | Dev 2 |
| `/api/admin/rounds`, `/action` | GET/POST | `panel_session` admin | Dev 3 (owns this one file inside Dev 2's admin area) |
| `/api/attendance/checkpoints`, `/resolve`, `/mark` | GET/POST | `panel_session` attendance | Dev 2 |
| `/api/dashboard/data` | GET | `session_token` | Dev 3 |

## File ownership (who owns what — don't edit outside your lane)

```
mineverse/
├── proxy.ts                                  DEV 3
├── package.json                              FROZEN — group call to change
├── app/
│   ├── layout.tsx, globals.css               FROZEN (foundation)
│   ├── page.tsx, register/, payment/         DEV 1
│   ├── login/, dashboard/**                  DEV 3
│   ├── admin/(panel)/layout.tsx              FROZEN
│   ├── admin/(panel)/{page,payments,teams}   DEV 2
│   ├── admin/(panel)/rounds/                 DEV 3
│   ├── attendance/**                         DEV 2
│   └── api/  (see table above for per-route owner)
├── components/
│   ├── ui/**                                 FROZEN (shadcn, don't hand-roll)
│   ├── admin/**, attendance/**               DEV 2
├── features/
│   ├── landing-registration/**               DEV 1
│   └── dashboard/**                          DEV 3
├── lib/
│   ├── env.ts, supabase/**, panel/session.ts FROZEN
│   ├── email/**                              DEV 2
│   ├── auth/session.ts                       DEV 3
│   └── validation/**                         DEV 1
└── supabase/migrations/**                    DEV 1
```

Cross-owner dependencies flow only through the frozen stubs (`lib/email/index.ts`'s function signatures, `lib/panel/session.ts`'s cookie checks) — never by one dev editing another dev's file.

## Environment variables that drive Phase 1

Everything "changeable" about the event (dates, fees, venue, contact info, WhatsApp link, UPI details) lives in env vars, validated at startup by `lib/env.ts` — the app refuses to build if a required one is missing. There is deliberately no `event_config` database table; if the venue changes, you edit an env var and redeploy, you don't touch the database.
