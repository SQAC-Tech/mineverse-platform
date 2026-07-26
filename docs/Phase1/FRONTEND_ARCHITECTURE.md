# MINEVERSE — Frontend Architecture
## Phase 1 Specification (v1.0)

**Framework:** Next.js 16.2.x (App Router, Turbopack) + React 19.2.x + TypeScript 5 (strict)
**Styling:** Tailwind CSS v4 (CSS-first, `@theme` in `globals.css`, no `tailwind.config.ts`) + shadcn/ui CLI v4
**Forms:** react-hook-form 7 + `@hookform/resolvers` + Zod 4
**Realtime:** Supabase Realtime Broadcast (`round_status` channel) + 10 s polling fallback
**Routing guard:** `proxy.ts` (Next 16's replacement for `middleware.ts`)

Companion docs: `PRD (1).md` (product spec), `API_GUIDE.md` (endpoint contracts), `DATABASE.md` (schema), `MASTER.md` §16 (file ownership matrix — authoritative for who owns what).

---

## 1. Route Map

| Route | Type | Auth | Owner | Notes |
|-------|------|------|-------|-------|
| `/` | Server Component | Public | Dev 1 | Landing |
| `/register` | Client (form) | Public | Dev 1 | Inline-OTP registration |
| `/payment` | Server + client island | Public (team code in query) | Dev 1 | UPI QR |
| `/login` | Client (2-step) | Public | Dev 3 | Team code → OTP |
| `/dashboard/**` | Server + client islands | `session_token` | Dev 3 | Team view |
| `/admin/login` | Client | Public | Dev 2 | Single password box |
| `/admin/**` | Server + client islands | `panel_session` scope=admin | Dev 2 (Dev 3 owns `/admin/rounds` only) | |
| `/attendance/login` | Client | Public | Dev 2 | Single password box |
| `/attendance/**` | Client, mobile-first | `panel_session` scope=attendance | Dev 2 | Standalone panel, not under `/admin` |

`proxy.ts` enforces the auth column above (redirects unauth → the relevant `/login` variant; redirects authed users away from login pages). No page component re-checks auth beyond reading the already-verified cookie payload for display (e.g., team name) — the proxy is the single source of truth for access control. See `API_GUIDE.md` §"proxy.ts routing rules" for the exact path table.

---

## 2. Directory Structure (frontend-relevant subset)

```
mineverse/
├── proxy.ts                        # DEV 3 — route guards
├── app/
│   ├── layout.tsx, globals.css     # FROZEN — root shell, Tailwind theme
│   ├── page.tsx                    # DEV 1 — landing
│   ├── register/page.tsx           # DEV 1
│   ├── payment/page.tsx            # DEV 1
│   ├── login/page.tsx              # DEV 3
│   ├── dashboard/
│   │   ├── layout.tsx              # DEV 3 — header + sidebar shell
│   │   ├── page.tsx                # DEV 3 — round cards
│   │   └── qr/page.tsx             # DEV 3
│   ├── admin/
│   │   ├── layout.tsx              # FROZEN — nav lists all 4 pages up front
│   │   ├── login/page.tsx          # DEV 2
│   │   ├── page.tsx                # DEV 2 — counters
│   │   ├── payments/page.tsx       # DEV 2
│   │   ├── teams/page.tsx          # DEV 2
│   │   └── rounds/page.tsx         # DEV 3 — own file inside admin, no conflict
│   └── attendance/
│       ├── login/page.tsx          # DEV 2
│       └── page.tsx                # DEV 2 — scanner + stepper
├── components/
│   ├── ui/**                       # FROZEN — shadcn primitives, installed Day 0
│   ├── forms/**                    # DEV 1 — registration-form.tsx, otp-input.tsx
│   ├── admin/**                    # DEV 2
│   ├── attendance/**               # DEV 2
│   ├── rounds/**                   # DEV 3
│   └── dashboard/**                # DEV 3
├── lib/
│   ├── supabase/{server,client}.ts # FROZEN
│   ├── panel/session.ts            # FROZEN
│   └── validation/**                # DEV 1 — shared Zod schemas, client + server
└── types/{index,supabase}.ts       # FROZEN
```

Component ownership mirrors route ownership: whoever owns a page owns the client components it renders. Cross-cutting UI (buttons, inputs, cards, dialogs) lives only in `components/ui/**`, installed once via shadcn and frozen — nobody hand-rolls a second `<Button>`.

---

## 3. Rendering Model

- **Default to Server Components.** Pages fetch data server-side (direct Supabase service-role query, or reading `lib/env` for env-backed content like `/`) and pass plain props down. No client-side data-fetching library (no SWR/React Query) — Phase 1's data volume doesn't need it.
- **Client Components (`"use client"`) are islands**, used only where interactivity requires it:
  - Forms (registration, OTP input, login steps).
  - The attendance scanner + stepper.
  - The admin payments table (search/filter/toggle) and rounds controls (timers).
  - The dashboard round cards (Realtime subscription).
- **API routes (`app/api/**`) are the only way client components mutate data.** Client components never call Supabase directly — the anon key is used only for Realtime subscriptions (RLS is deny-all on all tables; see `DATABASE.md`).
- Loading UI: route-level `loading.tsx` where a Server Component does a non-trivial fetch (dashboard, admin tables). Client-side async actions (OTP send, form submit, payment verify) show inline button-spinner state, not route-level suspense.

---

## 4. Design System

### 4.1 Theming (Tailwind v4, CSS-first)

No `tailwind.config.ts`. All theme tokens live in `app/globals.css` under `@theme` (or `@theme inline` for font/CSS-var passthrough), following the shadcn v4 init output. Foundation (frozen) ships with the default shadcn neutral palette and Geist Sans/Mono; Dev 1 extends `@theme` with the MINEVERSE brand palette (Minecraft-adjacent greens/browns/stone grays) during the Day-0 foundation commit — this file becomes frozen immediately after, so brand colors are decided once, up front, not per-page.

```css
@import "tailwindcss";

@theme {
  --color-brand-grass: ...;
  --color-brand-stone: ...;
  --color-brand-accent: ...;
  /* extend, do not replace, the shadcn --color-* tokens */
}
```

Dark mode: shadcn's `dark:` variant convention (class-based, not `prefers-color-scheme` only) so the admin/attendance panels can force a fixed theme if needed for outdoor/venue screen glare — decide in Day-0 commit and keep consistent across all panels.

### 4.2 Component primitives

`components/ui/**` is the full shadcn set installed once on Day 0: `button input label card select badge accordion sonner dialog table`, plus anything a dev needs added *before* the foundation freeze. Adding a new shadcn primitive after Day 0 requires a group call (same rule as `package.json`).

- **Toasts:** `sonner`, one `<Toaster />` mounted in root `layout.tsx`. Used for: OTP send confirmation, form errors, admin verify/unverify results, attendance "already marked" confirms.
- **Dialogs:** shadcn `Dialog` for destructive/confirm actions (unverify payment, overwrite an existing attendance mark).

### 4.3 Typography & spacing

Geist Sans (UI) / Geist Mono (team codes, OTP digits, JWT-ish strings) via `next/font/google`, wired in the frozen root layout. Team codes and OTP inputs always render in mono for scannability.

---

## 5. Forms & Validation

- **react-hook-form** + `zodResolver` on every form. Each form's schema is imported from `lib/validation/**` (Dev 1-owned, shared) so client and server (`app/api/**`) validate against the identical Zod 4 schema — no drift between what the form allows and what the API accepts.
- **The registration form (`components/forms/registration-form.tsx`) is the reference pattern** for the inline-OTP UX:
  1. Field-level "Verify Email" triggers `POST /api/otp/send`, not the form's own submit.
  2. Verified state is local component state (`verified: boolean`, `verificationToken: string`), not form state — it gates the Submit button's `disabled` prop directly.
  3. Zod schema requires `verification_token` present at submit time; the resolver alone can't enforce the OTP-before-submit rule, so the submit handler double-checks `verified` before calling `onSubmit`.
- Error display: inline field errors from `formState.errors`, network/API errors surfaced via `sonner` toast (never a blocking `alert()`).

---

## 6. State Management

Phase 1 has no global client state library (no Redux/Zustand/Context-heavy state). State is scoped to where it's needed:

| Kind of state | Mechanism |
|---|---|
| Form state | react-hook-form (per-form, local) |
| OTP verification flag | `useState` in the form component |
| Auth/session identity | Read server-side from the cookie in the page/layout Server Component, passed as props — never re-derived client-side |
| Round unlock status | Supabase Realtime channel subscription (`round_status`) in a client island, with `useState` for the current round list, reconciled every 10 s by polling `GET /api/team/dashboard` as a fallback |
| Attendance checkpoint selection | `localStorage`, read on mount, so a volunteer picks the checkpoint once per shift |
| Admin table filters/search | URL search params (`useSearchParams`) so filtered views are shareable/back-button-safe, with debounce on the search input |

---

## 7. Realtime Pattern (Dashboard & Admin Rounds)

```
Client island mounts
  → subscribe to Supabase Realtime channel "round_status" (anon key, broadcast-only — no table grants)
  → on "round_unlocked" / "round_locked" / "round_extended": patch local round state, toast "Round X unlocked!"
  → setInterval(10s): GET /api/team/dashboard as a correctness fallback in case a broadcast was missed
  → unsubscribe on unmount
```

The same channel is consumed by `/dashboard` (Dev 3) and emitted by `/admin/rounds` (Dev 3-owned file) — both sides live in Dev 3's ownership slice, so the contract (event names + payload shape in `API_GUIDE.md` §8) only needs one dev to keep in sync.

---

## 8. Mobile & Responsive Rules

- **`/attendance` is mobile-first, full stop** — designed for a volunteer's phone in one hand at a venue desk. Large tap targets (min 44px), the manual team-code input is always visible (never hidden behind a "camera not working?" toggle), and the "members present" control is a stepper/segmented control, not a dropdown.
- All other public pages (`/`, `/register`, `/payment`, `/login`, `/dashboard`) are responsive mobile → desktop, breakpoints via Tailwind defaults (`sm md lg`).
- `/admin/**` is desktop-first (organizers run it from a laptop) but must not break on a tablet — no fixed-px layouts.
- Camera permission UX (`/attendance`): request on first scanner mount, show a persistent inline notice (not a blocking modal) if denied, with the manual input as the immediate fallback — never a dead end.

---

## 9. Performance

- Turbopack is the default dev/build bundler in Next 16 — no webpack config needed.
- Server Components keep client JS minimal; only the islands listed in §3 ship interactivity.
- QR images are generated server-side as base64 PNG (`qrcode` lib) and rendered as plain `<img>` — no client-side canvas generation.
- `next/font` (Geist) self-hosts fonts at build time — no runtime Google Fonts request.
- Target: page load < 2 s, camera scan decode < 1 s (per `PRD (1).md` §5 NFRs).

---

## 10. Accessibility

- All shadcn primitives (Radix-based) ship correct ARIA out of the box — don't override roles/labels on them.
- Every form field has a visible `<Label>` (shadcn), not placeholder-as-label.
- The attendance stepper and QR scan result must be screen-reader announced (`aria-live="polite"` region) since the volunteer may be interacting one-handed without looking at the screen constantly.
- Color is never the sole signal for round/payment status (Locked/Active/Completed, Pending/Verified) — pair badges with text, not just color.

---

## 11. Ownership Recap

This doc describes shared conventions; it does not change who owns which file. `MASTER.md` §16 is authoritative. In short: Dev 1 = landing/register/payment + `components/forms/**` + `lib/validation/**`; Dev 2 = admin (except rounds) + attendance + `components/admin/**` + `components/attendance/**`; Dev 3 = login/dashboard/admin-rounds + `proxy.ts` + `components/rounds/**` + `components/dashboard/**`. `components/ui/**`, root layout/globals.css, and admin layout are frozen after the Day-0 foundation commit.

---

**Last Updated:** 2026-07-12
**Status:** Draft — ratify alongside the Day-0 foundation commit (`MASTER.md` §1.6)
