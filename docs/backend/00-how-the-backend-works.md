# How the MINEVERSE Backend Works (read this before touching any `route.ts`)

This doc explains the architecture that every phase (1, 2, and 3) builds on. It doesn't change per phase — learn it once.

## 1. There is no separate backend server

There's no Express app, no separate repo, no separate deployment for "the API." **The backend is a set of `route.ts` files inside `app/api/`, running as part of the same Next.js project, deployed to the same place (Vercel).** Each `route.ts` file is one endpoint. That's the entire backend.

```
Browser  --fetch()-->  app/api/register/route.ts  --query-->  Supabase (Postgres database)
   ^                          |
   |__________ JSON response _|
```

## 2. The database: Supabase (Postgres) — and the browser can't touch it

Supabase is just managed Postgres plus some extras (auth helpers we don't use, realtime broadcast which we do use, generated types). Two important decisions:

- **Row Level Security (RLS) is turned on for every table, with zero policies defined.** In Postgres terms this means: nobody — not even a logged-in user — can read or write a table directly except through a special all-access "service role" key. We call this **deny-all RLS**. It's a deliberate simplification: instead of writing careful per-row permission rules in the database, *all* permission logic lives in our own `route.ts` files, in plain TypeScript, where it's easy to read and reason about.
- **The service-role key only ever exists on the server** (`lib/supabase/server.ts`, imported only by `route.ts` files and other server-only `lib/` code). It is never sent to the browser. The browser only ever gets a much weaker "anon" key, used for exactly one thing: subscribing to realtime broadcast notifications (see §6) — which grants no table access at all.

**Consequence you must internalize:** a `'use client'` component can never import `lib/supabase/server.ts` or query the database directly. If you find yourself doing that, you've made a security hole — the fix is always "add or use an API route instead."

## 3. Three cookies, three kinds of identity

There is no single "logged in user." There are three separate, non-overlapping identities, each with its own cookie:

| Cookie | Who gets it | Set by | Proves | Lifetime |
|---|---|---|---|---|
| `session_token` | A **team** (i.e. participants) | `POST /api/auth/login/verify` | "I am team X" | 24 hours |
| `panel_session` (scope `admin`) | An **organizer** | `POST /api/panel/login` with the admin password | "I'm allowed to see/manage all teams" | 12 hours |
| `panel_session` (scope `attendance`) | A **volunteer** at the door | `POST /api/panel/login` with the attendance password | "I'm allowed to mark attendance only" | 24 hours |

All three are **JWTs** — a signed, tamper-proof token. "Signed" means the server can verify nobody edited it (using a secret key only the server knows), even though the browser can see its contents. All three cookies are `httpOnly` (JavaScript in the browser literally cannot read them, only the browser sends them automatically with each request) and `Secure`/`SameSite=Strict` (extra anti-hijacking protections). **There are no team passwords anywhere in this system** — teams authenticate purely by proving they control the team lead's college email inbox (via OTP).

Critically: **admin and attendance are different scopes even though they share a cookie name.** An admin's cookie will *not* pass an attendance-only check, and vice versa. This is enforced in `lib/panel/session.ts` and checked by `proxy.ts` before a request even reaches your route handler.

## 4. `proxy.ts` — the bouncer that runs before everything

`proxy.ts` (at the root of `mineverse/`) runs on every request that matches its `config.matcher` list, **before** the actual page or API route executes. Its whole job: look at the URL, decide which cookie should be required, check it, and either let the request through or reject it.

```ts
// Simplified shape of what it does today:
if (path.startsWith('/api/admin'))       require panel_session, scope 'admin'
if (path.startsWith('/api/attendance'))  require panel_session, scope 'attendance'
if (path.startsWith('/api/dashboard'))   require session_token
if (path.startsWith('/admin') && not /admin/login)       require admin scope, else redirect to /admin/login
if (path.startsWith('/attendance') && not /attendance/login) require attendance scope, else redirect
if (path.startsWith('/dashboard'))       require session_token, else redirect to /login
```

**Because of this, your `route.ts` files under `/api/admin/**`, `/api/attendance/**`, and `/api/dashboard/**` don't need to re-check the cookie themselves for basic access — `proxy.ts` already guaranteed it got that far.** (Phase 2 and 3 add new protected prefixes like `/api/team/**` — when you add a new protected route family, you extend `proxy.ts`'s matcher and checks, or add the check inside the route itself if it's more specific than "any team member.")

Public routes (`/`, `/register`, `/payment`, `/login`, `/api/event/*`, `/api/otp/*`, `/api/register`, `/api/auth/*`, `/api/panel/login`) have no gate at all — anyone can hit them.

## 5. What a typical `route.ts` looks like, step by step

Here's the real `POST /api/register` handler (trimmed for teaching), which is the best reference example in the codebase:

```ts
export async function POST(req: Request) {
  // 1. Rate limit FIRST, before doing any real work — protects against abuse
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit('reg:' + ip, 5, 60 * 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many...' }, { status: 429 });
  }

  // 2. Parse and validate the body with the SAME Zod schema the form uses
  const body = await req.json();
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: '...' }, { status: 400 });
  }

  // 3. Re-verify anything the client claimed, server-side — never trust the client
  //    (here: that the OTP challenge was actually verified, and matches the lead's email)
  const { data: challenge } = await supabaseServer.from('otp_challenges')...

  // 4. Do the actual database work using supabaseServer (the service-role client)
  const { data: team } = await supabaseServer.from('teams').insert({ ... }).select().single();

  // 5. Side effects (send an email) happen after the data is safely written
  await sendRegistrationReceivedEmail({ ... });

  // 6. Always return a consistent shape
  return NextResponse.json({ success: true, team_code: teamCode, redirect: '/payment?...' });
}
```

Every route in this project follows that shape: **rate-limit → validate → re-verify trust boundaries → mutate the database → side effects → respond.** The response is always `{ success: true, ... }` or `{ success: false, error: "human-readable message" }`. Copy this pattern for new routes rather than inventing a new shape.

## 6. Realtime: how the dashboard updates without refreshing

When an admin unlocks a round, every team's dashboard should update within seconds, without the team refreshing the page. This uses **Supabase Realtime Broadcast**:

```
Admin clicks "Unlock Round 2"
  → POST /api/admin/rounds/action
  → route.ts updates the `rounds` row in the database
  → route.ts also broadcasts a message on a channel named "round_status":
      { event: "round_unlocked", payload: { round_id: 2, ends_at: "..." } }

Every team's dashboard (a 'use client' component) is subscribed to that same
"round_status" channel using the weak anon key (broadcast needs no table access)
  → receives the message, updates its local state, shows a toast "Round 2 unlocked!"
```

Broadcasts can be missed (a phone loses signal for a second). So every screen that relies on realtime **also polls** the equivalent `GET` endpoint every 10 seconds as a backup. Realtime is a nice-to-have for snappiness; polling is what guarantees correctness. Always build both — never realtime-only.

## 7. Idempotency — building things that survive being clicked twice

From Phase 2 onward, almost every action changes a resource balance (Wood, Stone, Iron...) and must never apply twice. The pattern:

1. The client generates a random ID (a UUID) once per logical action and sends it as an `Idempotency-Key` header (or `idempotency_key` in the body).
2. The server checks: "have I already completed an action with this exact key?" If yes, it returns the *original* result again without redoing the mutation.
3. If no, it performs the mutation and the idempotency key inside the same database transaction, so a crash between the two can't happen.

You'll see this everywhere in the Phase 2/3 docs as "idempotent" — it just means safe-to-retry, using the recipe above.

## 8. The append-only ledger pattern (Phase 2/3 — worth understanding now)

Instead of just storing "Team X has 40 Wood" as a single number that gets overwritten, Phase 2 introduces a `resource_ledger` table: every award or deduction is inserted as its own row (`+60 Wood, reason: "crafted wooden pickaxe"`), and a team's current balance is the sum of their ledger rows (kept in sync via a cached `resources` row for fast reads). This means:

- You can always answer "why does this team have this many Diamonds?" by reading history — critical for resolving disputes on event day.
- A bug that double-awards something is visible and fixable (delete/counter the bad row) instead of silently baked into one mutable number.

No route handler is ever allowed to `UPDATE resources SET wood = wood + 60` directly — it always goes through one shared server-side function that locks the row, checks idempotency, and writes both the ledger row and the balance update together.

## 9. File ownership — why you should never edit someone else's route

With no strict PR-review pipeline and a small team on a deadline, this project avoids merge conflicts by **convention**: every file has exactly one owner, written down in the phase's master doc. A shared, "frozen" set of files (`lib/env.ts`, `lib/supabase/**`, `lib/panel/session.ts`, `types/**`, `package.json`) is not to be edited by anyone after the initial foundation commit without a group call — every other dev depends on their exact signatures staying stable. If two features need to share behavior, they share it through **a documented API response or database contract**, never by one dev editing another dev's file.

See each phase's backend doc for the exact ownership table.

---

Next: read your phase's backend doc — [01-phase-1-backend.md](./01-phase-1-backend.md), [02-phase-2-backend.md](./02-phase-2-backend.md), or [03-phase-3-backend.md](./03-phase-3-backend.md).
