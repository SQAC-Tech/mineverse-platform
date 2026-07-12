# MINEVERSE — API Guide
## Phase 1: Endpoint Specification (v2.0)

**Base URL:** `https://mineverse.vercel.app/api`
**Framework:** Next.js 16 App Router route handlers (`route.ts`), request interception via **`proxy.ts`** (Next 16 renamed `middleware.ts`)
**Content-Type:** `application/json`
**Rate limits:** 60 req/min per IP (public); OTP send: 3 per email per 10 min; registration: 5 per IP per hour

### Auth model (three separate cookies)

| Cookie | Who | Set by | Scope claim | Lifetime |
|--------|-----|--------|-------------|----------|
| `session_token` | Teams | `POST /api/auth/login/verify` | `{team_id, team_code}` | 24 h |
| `panel_session` (scope=`admin`) | Admins | `POST /api/panel/login` | `{scope: 'admin'}` | 12 h |
| `panel_session` (scope=`attendance`) | Attendance volunteers | `POST /api/panel/login` | `{scope: 'attendance'}` | 24 h |

All are JWTs (jose, HS256, `JWT_SECRET`), httpOnly, Secure, SameSite=Strict. The old `x-admin-key` header is **gone** — panel routes are cookie-authenticated. There are **no passwords for teams** anywhere in this API.

### `proxy.ts` routing rules

```
Public:      /, /register, /payment, /login, /api/event/*, /api/otp/*,
             /api/register, /api/payment/*, /api/auth/*, /api/panel/login
Team:        /dashboard/**, /api/team/**            → session_token required
Admin:       /admin/** (except /admin/login),
             /api/admin/**                          → panel_session scope=admin
Attendance:  /attendance/** (except /attendance/login),
             /api/attendance/**                     → panel_session scope=attendance
```

---

## 1. Public Endpoints

### 1.1 GET `/api/event/config`
Public event details, **read from env vars** (no DB).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "event_name": "MINEVERSE 2026",
    "event_date_display": "15 August 2026",
    "event_time": "11:00 AM",
    "venue": "Main Auditorium, College",
    "registration_open": true,
    "fees": { "solo": 100, "duo": 180, "trio": 250 },
    "contact_email": "team@mineverse.tech",
    "contact_phone": "+91XXXXXXXXXX"
  }
}
```
> The machine-readable `EVENT_DATE` and `WHATSAPP_GROUP_LINK` are server-only and never returned here.

---

### 1.2 POST `/api/otp/send`
Sends a registration OTP to the team lead's college email **via Resend**. Called from the "Verify Email" button inside the registration form — **before submit**.

**Request:**
```json
{
  "college_email": "rahul@college.edu.in",
  "turnstile_token": "..."
}
```

**Process:**
1. Verify Turnstile token server-side.
2. Validate domain against `NEXT_PUBLIC_COLLEGE_EMAIL_DOMAIN`.
3. Reject if `college_email` already exists in `members` (409).
4. Throttle: max 3 sends per email per 10 min (429).
5. Generate 6-digit OTP → store `sha256(otp + JWT_SECRET)` in `otp_challenges` (`purpose='registration'`, expiry `OTP_EXPIRY_MINUTES`).
6. Send via **Resend**; log to `email_logs` (`email_type='otp_registration'`, `provider='resend'`).

**Response 200:** `{ "success": true, "challenge_id": "uuid", "expires_in": 600 }`
**Response 409:** `{ "success": false, "error": "This college email is already registered" }`

---

### 1.3 POST `/api/otp/verify`
Verifies the inline OTP. On success the form unlocks its Submit button.

**Request:** `{ "challenge_id": "uuid", "otp": "123456" }`

**Process:** check expiry → check `attempts < OTP_MAX_ATTEMPTS` (increment on miss) → compare hash → set `verified=true`.

**Response 200:**
```json
{ "success": true, "verification_token": "uuid" }
```
**Response 400:** `{ "success": false, "error": "Invalid OTP", "attempts_left": 2 }`

---

### 1.4 POST `/api/register`
Creates the team. Only callable with a **verified** challenge — this is how "OTP before submit" is enforced server-side.

**Request:**
```json
{
  "honeypot": "",
  "challenge_id": "uuid",
  "verification_token": "uuid",
  "team_name": "Code Crafters",
  "members": [
    {
      "name": "Rahul Sharma",
      "email": "rahul@gmail.com",
      "college_email": "rahul@college.edu.in",
      "phone": "9876543210",
      "section": "A",
      "department": "CSE",
      "is_team_lead": true
    }
  ]
}
```

**Validation (Zod 4):**
- `honeypot` must be `""`.
- `challenge_id` + `verification_token` must match a row with `verified=true`, `purpose='registration'`, not expired — and its `email` must equal the **lead's** `college_email`.
- `team_name`: 3–50 chars. `members`: 1–3, exactly one lead, lead first.
- All member college emails: whitelist domain, unique among themselves, not already in `members`.
- `phone`: `/^[6-9]\d{9}$/`.
- **No password field.**

**Process:** `generate_team_code()` → insert `teams` (status `payment_pending`) → insert `members` (lead gets `email_verified=true`) → insert `payments` (amount from env `FEE_*` by size) → insert `team_round_access` (all rounds, locked) → **delete the consumed otp_challenge** → send "registration received" email to lead via **SMTP** → respond.

**Response 200:**
```json
{
  "success": true,
  "team_code": "MNV-482",
  "payment_amount": 180,
  "redirect": "/payment?team=MNV-482"
}
```

---

### 1.5 GET `/api/payment/status?team=MNV-482`
Payment page data. QR is generated on demand from env `UPI_ID`/`UPI_PAYEE_NAME`.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "team_code": "MNV-482",
    "amount": 180,
    "payment_status": "pending",
    "qr_image": "data:image/png;base64,..."
  }
}
```

---

## 2. Event-Day Login (OTP, no password)

### 2.1 POST `/api/auth/login/request-otp`

**Request:** `{ "team_code": "MNV-482" }`

**Gates (checked BEFORE sending, to protect Resend quota):**
1. Today (IST) must equal env `EVENT_DATE` → else 403 `"Login opens on event day."`
2. Team must exist → else 401 `"Invalid team code"` (generic).
3. `is_payment_verified` must be true → else 403 `"Payment verification pending. Contact organizers."`

**Process:** create `otp_challenges` row (`purpose='login'`, `team_id`) → send OTP to the **team lead's college email** via **Resend** → log (`email_type='otp_login'`).

**Response 200:**
```json
{ "success": true, "challenge_id": "uuid", "sent_to": "ra•••@college.edu.in", "expires_in": 600 }
```

### 2.2 POST `/api/auth/login/verify`

**Request:** `{ "challenge_id": "uuid", "otp": "123456" }`

**Process:** same hash/expiry/attempts checks → delete challenge → sign `session_token` JWT → set cookie.

**Response 200:**
```json
{
  "success": true,
  "team": { "id": "uuid", "team_code": "MNV-482", "team_name": "Code Crafters" }
}
```

### 2.3 POST `/api/auth/logout`
Clears `session_token`. **Response:** `{ "success": true }`

---

## 3. Panel Auth (admin + attendance, single password box)

### 3.1 POST `/api/panel/login`

**Request:** `{ "panel": "admin", "password": "..." }` or `{ "panel": "attendance", "password": "..." }`

**Process:** constant-time compare against `ADMIN_PASSWORD` / `ATTENDANCE_PASSWORD` env var → sign `panel_session` JWT with `scope` claim → set cookie. Rate limited (10/min/IP). Generic error on failure. **No IP whitelist.**

**Response 200:** `{ "success": true, "scope": "admin" }`
**Response 401:** `{ "success": false, "error": "Incorrect password" }`

### 3.2 POST `/api/panel/logout`
Clears `panel_session`.

---

## 4. Admin Endpoints (cookie: `panel_session`, scope=`admin`)

### 4.1 GET `/api/admin/teams`
Roster with members, payment, and read-only attendance summary.

**Query params:** `status`, `search`, `page` (default 1), `limit` (default 50)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "teams": [
      {
        "id": "uuid",
        "team_code": "MNV-482",
        "team_name": "Code Crafters",
        "team_size": 2,
        "status": "verified",
        "is_payment_verified": true,
        "members": [ ... ],
        "payment": { "status": "verified", "amount": 180 },
        "attendance": [
          { "checkpoint": "ROUND_1", "members_present": 2 },
          { "checkpoint": "ROUND_2", "members_present": 1 }
        ]
      }
    ],
    "pagination": { "page": 1, "limit": 50, "total": 20 }
  }
}
```
> Attendance here is **read-only** — marking happens only on `/attendance`.

### 4.2 POST `/api/admin/payments/verify`

**Request:** `{ "team_id": "uuid", "verified": true, "admin_notes": "UPI ref 4021..." }`

**Process on verify:**
1. `payments.status='verified'` (+`verified_at`, notes) → DB trigger syncs `teams`.
2. Generate attendance QR: JWT `{team_id, type:'attendance'}` signed with `ATTENDANCE_QR_SECRET` → store as `teams.qr_token`.
3. Email **all members** via **SMTP**: WhatsApp link (env), venue/date/time (env), embedded QR PNG. Log each send.

**Process on unverify:** `status='pending'`, null out `teams.qr_token`, notice email to lead via SMTP.

**Response 200:** `{ "success": true, "message": "Payment verified. QR generated, 2 emails sent." }`

### 4.3 GET `/api/admin/rounds`
All rounds with status + live counters (`teams_unlocked`, `teams_completed`).

### 4.4 POST `/api/admin/rounds/toggle`

**Request:** `{ "round_id": 1, "action": "unlock" }`

- `unlock`: `rounds.status='active'`, `starts_at=now()`, `ends_at=now()+time_allotted`; set `team_round_access.is_locked=false` for all teams with `is_payment_verified=true`; broadcast `round_unlocked` on Realtime channel `round_status`.
- `lock`: reverse.

**Response 200:** `{ "success": true, "affected_teams": 20 }`

### 4.5 POST `/api/admin/rounds/extend`

**Request:** `{ "round_id": 1, "additional_minutes": 5 }` → pushes `rounds.ends_at` forward, broadcasts `round_extended`.

---

## 5. Attendance Endpoints (cookie: `panel_session`, scope=`attendance`)

**These are NOT admin endpoints.** They live under `/api/attendance/*` and require the attendance-scope cookie.

### 5.1 GET `/api/attendance/checkpoints`
The dropdown source.

**Response 200:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "code": "ROUND_1", "label": "Round 1 — Forest & Grasslands", "day": 1 },
    { "id": 4, "code": "ROUND_4_PHASE_1", "label": "Round 4 — Phase 1", "day": 2 }
  ]
}
```

### 5.2 POST `/api/attendance/resolve`
Resolves a **camera QR scan** (JWT) or **manual team code** to a team card.

**Request (either field):**
```json
{ "qr_token": "eyJhbGciOiJIUzI1NiIs..." }
```
```json
{ "team_code": "MNV-482" }
```

**Process:** if `qr_token`: verify signature with `ATTENDANCE_QR_SECRET` **and** match against `teams.qr_token` (revocation check). If `team_code`: direct lookup. Return team + existing per-checkpoint records.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "team_id": "uuid",
    "team_code": "MNV-482",
    "team_name": "Code Crafters",
    "team_size": 2,
    "is_payment_verified": true,
    "members": [ { "name": "Rahul Sharma", "is_team_lead": true } ],
    "records": [ { "checkpoint_id": 1, "checkpoint_code": "ROUND_1", "members_present": 2 } ]
  }
}
```
**Response 400:** `{ "success": false, "error": "Invalid or revoked QR code" }`

### 5.3 POST `/api/attendance/mark`

**Request:**
```json
{
  "team_id": "uuid",
  "checkpoint_id": 1,
  "members_present": 2,
  "method": "qr_scan"
}
```

**Validation:** `0 <= members_present <= team_size`; checkpoint must exist; team must be payment-verified (warn-but-allow flag otherwise: response carries `"warning"`).

**Process:** upsert `attendance_records` on `(team_id, checkpoint_id)`. If a row already existed, `"updated": true` is returned so the UI can show "updated existing mark".

**Response 200:**
```json
{ "success": true, "updated": false, "message": "MNV-482 marked: 2/2 present at Round 1" }
```

### 5.4 GET `/api/attendance/report?checkpoint_id=1`
Per-checkpoint totals (teams marked, heads counted) + CSV export via `?format=csv`.

---

## 6. Team Endpoints (cookie: `session_token`)

### 6.1 GET `/api/team/me`
Team + members + payment + attendance records.

### 6.2 GET `/api/team/dashboard`
Round states for the dashboard.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "day1": [
      { "round_id": 1, "name": "Forest & Grasslands", "status": "locked",
        "is_locked": true, "time_allotted": 45, "starts_at": null, "ends_at": null }
    ],
    "day2": { "visible": false, "message": "Day 2 unlocks tomorrow" }
  }
}
```

### 6.3 GET `/api/team/qr`
Re-displays the team's attendance QR (regenerated as PNG from `teams.qr_token`). 404 if payment not yet verified.

---

## 7. Error Codes

| HTTP | Code | Meaning |
|------|------|---------|
| 200 | — | Success |
| 400 | BAD_REQUEST | Validation / bad OTP / expired challenge |
| 401 | UNAUTHORIZED | Missing/invalid cookie, unknown team code, wrong panel password |
| 403 | FORBIDDEN | Wrong event date, payment not verified, wrong panel scope |
| 404 | NOT_FOUND | Team/resource not found |
| 409 | CONFLICT | Duplicate college email |
| 429 | RATE_LIMITED | OTP throttle / registration throttle / login attempts |
| 500 | INTERNAL_ERROR | Server error |

Error shape is always `{ "success": false, "error": "human message", "field": "optional" }`.

---

## 8. Realtime (Supabase Broadcast)

**Channel:** `round_status` — subscribed by dashboards with the anon key (no table access; RLS is deny-all).

| Event | Payload | Emitted by |
|-------|---------|-----------|
| `round_unlocked` | `{ round_id, name, starts_at, ends_at }` | `/api/admin/rounds/toggle` |
| `round_locked` | `{ round_id }` | `/api/admin/rounds/toggle` |
| `round_extended` | `{ round_id, ends_at }` | `/api/admin/rounds/extend` |

Dashboards also poll `GET /api/team/dashboard` every 10 s as a fallback.

---

## 9. Data Flow Diagrams

### 9.1 Registration (OTP inline, pre-submit)
```
[/register form]
  lead types college email → click "Verify Email"
      → POST /api/otp/send   (Turnstile + domain check + dup check)
      → Resend delivers OTP
  lead types OTP inline
      → POST /api/otp/verify → verification_token, Submit unlocks
  fill rest of the form → click Submit
      → POST /api/register   (honeypot + verified-challenge check)
      → create teams + members + payments + team_round_access
      → SMTP: "registration received" to lead
      → redirect /payment?team=MNV-XXX
```

### 9.2 Payment verification
```
Admin (/admin, cookie scope=admin) clicks Verify
  → POST /api/admin/payments/verify
  → payments.status='verified'  → trigger → teams.is_payment_verified=true
  → sign QR JWT → teams.qr_token
  → SMTP to ALL members: WhatsApp + venue + date + QR image
```

### 9.3 Event-day login (OTP)
```
Team enters team code → POST /api/auth/login/request-otp
  gate: today == EVENT_DATE?      → no → 403
  gate: is_payment_verified?      → no → 403
  → Resend OTP to lead college email
Team enters OTP → POST /api/auth/login/verify
  → session_token cookie → /dashboard (all rounds locked until admin unlocks)
```

### 9.4 Per-round attendance
```
Volunteer opens /attendance (cookie scope=attendance)
  → picks checkpoint (e.g., ROUND_2)
  → camera scans team QR  → POST /api/attendance/resolve
     (or types MNV-482 manually)
  → team card shows: members, size, previous marks
  → selects members_present (0..team_size)
  → POST /api/attendance/mark → upsert (team, checkpoint)
  → repeat for every team, every round, every Round-4 phase
```
