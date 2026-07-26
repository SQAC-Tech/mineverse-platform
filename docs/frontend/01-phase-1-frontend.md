# Phase 1 Frontend — Every Page, Every Button (already built)

Phase 1 is done and live. This doc walks every real route, what's on screen, and which file owns it — read it side by side with the actual code. Read [00-how-the-frontend-works.md](./00-how-the-frontend-works.md) first for the conventions (Server/Client split, forms, state).

## Visual language note

Public-facing pages (`/`, `/register`, `/login`, `/payment`) use a hand-styled **Minecraft block theme**: pixelated borders (`imageRendering: 'pixelated'`), wood/parchment textures, a custom Minecraft-style font, and blocky drop shadows — all done with inline `style={}` objects, not Tailwind classes, because the look needs pixel-precise borders Tailwind's utility classes don't easily express. Admin (`/admin/**`) and attendance (`/attendance/**`) are plain, dark, utilitarian shadcn UI — organizers and volunteers need speed and legibility, not theming, especially under venue lighting.

## `/` and `/landing` — Landing page

**File:** `features/landing-registration/minecraft-landing.tsx`, rendered from `app/page.tsx`. (`app/landing/page.tsx` also exists as an alternate entry.)

What's on screen:
- Big "MINEVERSE" hero title
- An info strip: **DATE**, **VENUE** ("ONLINE + SELECT VENUES"), **WHO CAN JOIN** ("OPEN FOR ALL CODERS!")
- Event details pulled from `GET /api/event/config` (env-var-backed — see [../backend/01-phase-1-backend.md](../backend/01-phase-1-backend.md))
- **Register Now** and **Login** call-to-action buttons, linking to `/register` and `/login`
- Rules/FAQ and contact footer sections

This page is (mostly) a Server Component — it's static/marketing content, no form state needed here.

## `/register` — Registration

**Files:** `app/register/page.tsx` (thin wrapper + "BACK TO HOME" button) → `features/landing-registration/registration-form.tsx` (`'use client'`, the entire real thing).

This is **the reference pattern for the whole app** — if you're building any nontrivial form later, copy its structure. Walking it top to bottom, in the order a user experiences it:

1. **Team Name** field.
2. **Member 1 (Team Leader)** block: Full Name, Personal Email, College Email + a dedicated **OTP** button next to the college-email field (not the form's submit — see [00-how-the-frontend-works.md §3](./00-how-the-frontend-works.md#3-forms-react-hook-form--zod-one-schema-shared-client-and-server)). Clicking it calls `POST /api/otp/send`; the college-email field then **locks** (`disabled`) and a green ✓ replaces the button once verified.
3. Once OTP is sent, an inline **6-digit code input + VERIFY button** appears; it calls `POST /api/otp/verify`.
4. WhatsApp No. and Dept (a native `<select>`) fields for that member.
5. An **ADD MEMBER** button (up to 3 total) appends another member block via `useFieldArray`; each added member gets a trash-icon **remove** button.
6. **Once the lead's email is OTP-verified**, a Payment section appears: it fetches `GET /api/payment/qr?size=<member count>` and shows a UPI QR code + amount to scan and pay *before* submitting (see the payment-flow note in the backend doc — this is a pay-first design). Below the QR: **UPI Transaction ID** and **Sender's Name (on UPI account)** fields, for the team to self-report what they just paid.
7. A Cloudflare **Turnstile** captcha widget.
8. The big **REGISTER NOW** submit button — disabled until `isSubmitting` is false AND `otpVerified` is true AND the Turnstile token exists. On success: toast, then `router.push()` to `/payment?team=MNV-XXX`.
9. A hidden honeypot input (`display:none`-equivalent, `tabIndex={-1}`) — a bot filling every visible field will also fill this one, and the server silently rejects it.

## `/payment` — Payment status (read-only)

**File:** `app/payment/page.tsx` (client component, wrapped in `<Suspense>` since it reads `?team=` from the URL).

Shows: team code, amount due, a status pill (PENDING / VERIFIED / REJECTED, color-coded), and — while pending — the transaction ID and sender name the team already submitted during registration (so they can double check what they typed). Polls `GET /api/payment/status?team=...` every 15 seconds while status is `pending`, so it flips to VERIFIED without the user refreshing once an admin acts. On VERIFIED it tells the user to check their email for the attendance QR + WhatsApp link.

## `/login` — Team login

**File:** `app/login/page.tsx` (`'use client'`, two-step form in one component via a `step` state of `1 | 2`).

Step 1: **TEAM CODE** input (auto-uppercased as typed) + **SEND OTP** button → `POST /api/auth/login/request-otp`. On success, moves to step 2 and shows the masked lead email (`ra•••@college.edu.in`) it was sent to.

Step 2: **6-digit OTP** input + **ENTER DASHBOARD** button → `POST /api/auth/login/verify`; on success, redirects to `/dashboard`. A **BACK** text link returns to step 1 (e.g. if they mistyped the team code).

## `/dashboard` and `/dashboard/qr` — Team view

**Files:** `app/dashboard/layout.tsx` (shared header/sidebar + logout), `app/dashboard/page.tsx` → `features/dashboard/dashboard-view.tsx`; `app/dashboard/qr/page.tsx` → `features/dashboard/team-qr-view.tsx`.

`/dashboard` shows: "Welcome, {team name}", then a card per round with a status badge (Locked / Active / Completed). Round data comes from `GET /api/dashboard/data`. This is also where the **realtime pattern** lives — the round cards subscribe to the Supabase `round_status` broadcast channel so an admin unlocking a round updates every team's screen live, with a 10-second poll as a fallback (see [../backend/00-how-the-backend-works.md §6](../backend/00-how-the-backend-works.md#6-realtime-how-the-dashboard-updates-without-refreshing)).

`/dashboard/qr` re-displays the team's attendance QR (fetched fresh, not cached client-side) so a team can pull it back up if they closed the original email.

## `/admin/login` and `/admin/**` — Organizer panel

**Files:** `app/admin/login/page.tsx` (single password box), `app/admin/(panel)/layout.tsx` (shared nav — **frozen**, lists all admin pages up front), and the pages inside `app/admin/(panel)/`.

- **`/admin` (Overview)** — `app/admin/(panel)/page.tsx`. A row of stat cards (teams / verified / pending counters) plus a couple of summary cards. Read-only.
- **`/admin/payments`** — `app/admin/(panel)/payments/page.tsx`. A table of every payment with a **Verify** button per row (`onClick` → `POST /api/admin/payments`). This is the highest-stakes admin action in Phase 1: it triggers QR generation and an email blast to the whole team, so the button should never fire twice by accident — check the loading/disabled state if you touch this file.
- **`/admin/teams`** — `app/admin/(panel)/teams/page.tsx`. The full team roster, including each team's read-only attendance summary (marking itself only happens on `/attendance`, never here).
- **`/admin/rounds`** — `app/admin/(panel)/rounds/page.tsx`. One card per round with three buttons: a primary **toggle** button (Unlock when locked, styled red/"Lock" when active — same `handleToggle` handler, the label just reflects current state), and an **Extend** button (adds minutes to `ends_at`) shown only while active. This file is owned by Dev 3 even though it lives inside Dev 2's `admin/` folder — it's called out separately in the ownership table specifically so editing it doesn't require touching anyone else's files.

## `/attendance/login` and `/attendance` — Volunteer scanner panel

**Files:** `app/attendance/login/page.tsx` (single password box, "Scanner Login" / "Enter Scanner Mode" button), `app/attendance/page.tsx` (`'use client'`, mobile-first) using `components/attendance/scanner.tsx` for the camera piece.

Flow on screen:
1. A checkpoint dropdown (persisted to `localStorage` so a volunteer only picks it once per shift) sourced from `GET /api/attendance/checkpoints`.
2. `<Scanner onScan={handleScan} />` — a **live camera QR scanner** (the `qr-scanner` package; deliberately not `html5-qrcode`, which is unmaintained). A manual team-code text input sits alongside it at all times as a fallback, never hidden behind a "camera not working?" toggle.
3. On a successful scan or manual code entry → `POST /api/attendance/resolve` → a team card appears: team name/code, member count, and any previous per-checkpoint marks.
4. A **headcount stepper** (0 up to `team_size`) — not a per-member checkbox list, since volunteers only report *how many* are present.
5. **Cancel** and a primary **Mark Attendance** button (`handleMarkAttendance`) → `POST /api/attendance/mark`. If that checkpoint was already marked for this team, the response flags it so the UI can show "mark updated" rather than silently duplicating.

## File ownership (mirrors the backend doc — matches routes 1:1)

| Area | Files | Owner |
|---|---|---|
| Landing, Register, Payment | `app/page.tsx`, `app/register/**`, `app/payment/**`, `features/landing-registration/**` | Dev 1 |
| Login, Dashboard | `app/login/**`, `app/dashboard/**`, `features/dashboard/**` | Dev 3 |
| Admin (except rounds) | `app/admin/(panel)/{page,payments,teams}/**`, `app/admin/login/**`, `components/admin/**` | Dev 2 |
| Admin rounds | `app/admin/(panel)/rounds/page.tsx` | Dev 3 |
| Attendance | `app/attendance/**`, `components/attendance/**` | Dev 2 |
| Everything under `components/ui/**`, root `layout.tsx`/`globals.css`, `admin/(panel)/layout.tsx` | shared UI primitives + shells | FROZEN |

Next up: [02-phase-2-frontend.md](./02-phase-2-frontend.md) for what you'll actually be building.
