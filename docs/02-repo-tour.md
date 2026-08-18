# Repo Tour: what's in every folder

This is a guided walk through the actual repository as it exists today. Read [01-nextjs-and-typescript-for-beginners.md](./01-nextjs-and-typescript-for-beginners.md) first if "folder = URL" doesn't make sense yet.

## Top level of the whole repo (not just the app)

```
mineverse-platform/
├── mineverse/               ← THE ACTUAL NEXT.JS APP. Everyone codes inside here.
└── docs/                    ← Everything else — all reference material, in one place
    ├── README.md, 01-*, 02-*         ← you are here
    ├── backend/, frontend/            ← the teaching docs
    ├── Phase1/                        ← Spec docs for what's already built (contract, not tutorial)
    ├── Phase 2/                       ← Spec docs for Day 1 gameplay (not built yet — you may build this)
    ├── Phase 3/                       ← Spec docs for Day 2 gameplay (not built yet)
    ├── event details/                 ← The actual event rules (rewards, timings, mechanics) — ground truth
    └── DESIGN and images/             ← Visual references
```

**Everything you `npm install`, `npm run dev`, and edit day-to-day is inside `mineverse/`.** Absolutely everything else in the repo — every spec doc, every planning file, every design reference — lives under `docs/` now. If it's not code for the app, it's reference material, and it's in `docs/`.

## Inside `mineverse/` — the app

```
mineverse/
├── proxy.ts                 # the "bouncer" — checks login cookies before every protected page/route
├── app/                     # every PAGE and every API ROUTE lives here (folder = URL, see doc 01)
├── components/               # reusable UI pieces, shared across pages
├── features/                 # bigger, page-specific chunks of UI (forms, dashboards, round games)
├── lib/                      # backend/shared logic that isn't a page or a component
├── types/                    # shared TypeScript type definitions
├── supabase/migrations/      # the database schema, as ordered SQL files
└── public/                   # static files served as-is (images, icons)
```

Walk through each one:

### `app/` — pages and API routes

Everything here follows the folder-is-a-URL rule. Two kinds of files matter:

- `page.tsx` → a page a human sees in the browser
- `route.ts` → a backend endpoint, no visible UI, only ever called via `fetch()`

Current pages (Phase 1, already built):

```
app/
├── page.tsx                      → /            landing page
├── register/page.tsx             → /register    registration form
├── payment/page.tsx              → /payment      payment status (read-only, polls)
├── login/page.tsx                → /login        team login (code + OTP)
├── dashboard/
│   ├── layout.tsx                  shared header/sidebar for everything under /dashboard
│   ├── page.tsx                  → /dashboard    round cards
│   └── qr/page.tsx               → /dashboard/qr  re-view your attendance QR
├── admin/
│   ├── login/page.tsx            → /admin/login
│   └── (panel)/                    a route "group" — the (parens) folder does NOT
│       ├── layout.tsx               appear in the URL, it's just an organizing folder
│       ├── page.tsx               → /admin       counters/overview
│       ├── payments/page.tsx      → /admin/payments
│       ├── teams/page.tsx         → /admin/teams
│       └── rounds/page.tsx        → /admin/rounds
└── attendance/
    ├── login/page.tsx            → /attendance/login
    └── page.tsx                  → /attendance   scanner + stepper
```

> Aside: `(panel)` is a folder wrapped in parentheses. In the App Router, a `(name)` folder is a **route group** — it lets you nest a shared `layout.tsx` around several pages without that folder name showing up in the URL. `/admin/(panel)/payments/page.tsx` is still just `/admin/payments`.

Current API routes (Phase 1, already built) — every one of these is a `route.ts` file:

```
app/api/
├── event/config/            GET  — public event info (dates, fees, venue) read from env vars
├── otp/send/                POST — sends the registration OTP
├── otp/verify/              POST — checks the registration OTP
├── register/                POST — creates the team, members, payment row
├── payment/qr/               GET  — pre-registration UPI QR (pay-before-submit)
├── payment/status/           GET  — payment verification status for /payment page
├── auth/login/request-otp/  POST — event-day login, step 1
├── auth/login/verify/       POST — event-day login, step 2 (sets session cookie)
├── auth/logout/             POST — clears the team session cookie
├── panel/login/              POST — admin/attendance password login (sets panel cookie)
├── panel/logout/             POST — clears the panel cookie
├── admin/teams/               GET  — team roster for admin panel
├── admin/payments/            GET/POST — payments list + verify/reject action
├── admin/rounds/               GET  — round list + live counters
├── admin/rounds/action/       POST — lock/unlock/extend a round
├── attendance/checkpoints/    GET  — dropdown source for /attendance
├── attendance/resolve/        POST — turns a QR scan or team code into a team card
├── attendance/mark/           POST — records how many members are present
└── dashboard/data/             GET  — a team's own round states, for /dashboard
```

**When someone says "add an endpoint," this is where it goes**: a new folder under `app/api/` with a `route.ts` inside, exporting a function named after the HTTP method (`GET`, `POST`, etc.).

### `components/` — small, reusable, dumb UI pieces

```
components/
├── ui/            shadcn primitives: Button, Card, Input, Select, Badge, Dialog...
│                  DO NOT hand-roll a second button. Reuse these everywhere.
├── admin/          pieces specific to the admin panel (tables, toggles)
└── attendance/     pieces specific to the attendance panel (scanner UI)
```

Rule of thumb: if it's a small, generic piece of UI (a button, a card, a badge) it either already exists in `components/ui/` or should be added there via `npx shadcn add <name>`. If it's a bigger chunk of logic tied to one specific feature, it goes in `features/` instead (next section).

### `features/` — the big, page-specific building blocks

```
features/
├── landing-registration/
│   ├── minecraft-landing.tsx    the landing page content
│   └── registration-form.tsx    the entire registration form (the reference pattern — read this one)
├── dashboard/
│   ├── video-background.tsx     the dashboard scene — this is what /dashboard renders
│   ├── progress-panel.tsx       crafted items, PvP/Day 2 status, portal requirements
│   ├── resource-ledger.tsx      paginated resource history modal
│   ├── types.ts                 the shape of GET /api/dashboard/data
│   └── team-qr-view.tsx         the "re-show my attendance QR" view
├── round-1/  round-2/  round-3/   ← EMPTY except a README. This is where Phase 2 team-facing
├── round-4/  round-5/               gameplay UI goes. If you're building Round 2's question screen,
                                      your files go in features/round-2/.
```

This is the folder that will grow the most in Phase 2 and Phase 3. Each round gets its own subfolder so different devs never edit the same file.

### `lib/` — logic that isn't UI

```
lib/
├── env.ts                # reads and validates every environment variable at startup —
│                            if a required env var is missing, the app refuses to build/start
├── supabase/
│   ├── server.ts          # the database client used by API routes (has full access — SERVER ONLY)
│   └── client.ts          # the limited browser client (only used for realtime subscriptions)
├── auth/
│   ├── session.ts         # team login: create/verify the session_token cookie
│   └── otp.ts             # OTP generation/hashing helpers
├── panel/
│   └── session.ts         # admin/attendance login: create/verify the panel_session cookie
├── email/
│   ├── index.ts           # the ONE function every route calls to send an email — routes to...
│   ├── resend.ts          # ...Resend (OTP emails only)
│   └── smtp.ts            # ...personal SMTP/Nodemailer (every other email)
├── validation/
│   └── schemas.ts         # every Zod schema, shared between forms and API routes
├── rate-limit.ts          # simple in-memory rate limiter used by public endpoints
└── textures.ts / utils.ts  # small helpers (Minecraft block textures, className merging, etc.)
```

**If you're writing backend logic that isn't "handle this one HTTP request," it almost certainly belongs in `lib/`, not inside a `route.ts` file.** Keep route handlers thin: validate input, call a `lib/` function, return a response.

### `types/` — shared shapes

`types/supabase.ts` is **auto-generated** from the real database schema (via `npx supabase gen types typescript`) — never hand-edit it, regenerate it after a migration changes. `types/index.ts` holds hand-written shared types that aren't database rows.

### `supabase/migrations/` — the database, as files

Each `.sql` file is one ordered step that builds up the database schema. They run in filename order (`001_teams.sql`, `002_members.sql`, ...). **Never edit an old migration file once it's been applied anywhere** — add a new one instead, same as you'd never edit a merged git commit. Phase 2 and Phase 3 will add their own new, additive migration files here.

## How to find "the file I need to touch" for a task

1. **"I need to change what a user sees on some page"** → find the URL, map it to a folder in `app/`, open `page.tsx`, follow the import to whichever file in `features/` or `components/` actually renders the content.
2. **"I need to add/change an API endpoint"** → find or create the matching folder under `app/api/`, edit `route.ts`.
3. **"I need to change a validation rule"** → `lib/validation/schemas.ts`.
4. **"I need to change what's stored in the database"** → add a new file in `supabase/migrations/`, never edit an existing one.
5. **"I need a new button/input/dialog style"** → check `components/ui/` first; if it doesn't exist, `npx shadcn add <thing>`.
6. **"I don't know who owns this file"** → check the ownership table in [backend/01-phase-1-backend.md](./backend/01-phase-1-backend.md) (Phase 1) or the phase 2/3 backend docs — every file has exactly one owner, on purpose, to avoid merge conflicts.

Next: [backend/00-how-the-backend-works.md](./backend/00-how-the-backend-works.md).
