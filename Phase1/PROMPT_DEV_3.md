# PROMPT: Developer 3 — OTP Login, Sessions, `proxy.ts`, Dashboard & Round Controls
## For: Codex / Claude Code / Antigravity

**Context:** You are building Phase 1 of the MINEVERSE platform — a **Next.js 16 (App Router) + Supabase + Tailwind CSS v4** project. You are Developer 3. Your scope: the **passwordless event-day login (team code + OTP)**, JWT team sessions, the **`proxy.ts`** request guard (Next 16 replaced `middleware.ts` — use the new file name and export), the team dashboard (Day 1 / Day 2 round cards + Realtime updates + QR re-view), and the **admin round controls** (page + API).

**Tech Stack (latest — July 2026):** Next.js 16.2.x, React 19, Tailwind v4, shadcn/ui (CLI v4), Zod 4, `@supabase/supabase-js` 2.110+, jose 6. **No bcrypt — there are no passwords in this system.**

**Critical Rules:**
- **Login is OTP-only.** Team enters their team code → OTP goes to the **team lead's college email** → verify → session. No password field exists.
- Login gates, checked **before** sending the OTP (protects the Resend free tier): (1) today (IST) equals env `EVENT_DATE`; (2) team exists; (3) `teams.is_payment_verified = true`. **Attendance does NOT gate login** (it's per-round now, handled by Dev 2's `/attendance` panel).
- You never call email providers directly — only the frozen façade `lib/email/index.ts` (`sendOtpEmail`, purpose `'login'`). Dev 2 implements it (Resend).
- Sessions: `session_token` JWT cookie — httpOnly, Secure, SameSite=Strict, 24 h, signed with `JWT_SECRET` via jose.
- **`proxy.ts`** (project root) guards team routes AND both panels (using the frozen `lib/panel/session.ts`). It runs on the Node.js runtime in Next 16.
- Dashboard rounds all start Locked; unlock only via your admin rounds toggle; broadcast over Supabase Realtime channel `round_status` + 10 s polling fallback.
- Round unlock targets all teams with `is_payment_verified = true` (there is no `attended` status anymore).
- OTP rows live in `otp_challenges` (`purpose='login'`), hashed with `sha256(otp + JWT_SECRET)` — same helper pattern as Dev 1 (keep your own copy in your files; do not import from Dev 1's directories).

---

## THE ZERO-CONFLICT CONTRACT (read first)

Dev 1's Day-0 foundation is frozen: `package.json` (your deps are installed — add nothing), `lib/env.ts`, `lib/supabase/*`, `lib/panel/session.ts`, `lib/email/index.ts` (signatures), `app/admin/layout.tsx` (its nav already links to your `/admin/rounds` page), `components/ui/**`, `types/**`.

```
YOURS (DEV 3):
  proxy.ts                                  ← Next 16 file (NOT middleware.ts)
  lib/auth/session.ts  lib/auth/otp.ts
  app/login/page.tsx
  app/dashboard/**                          (layout, page, qr/page.tsx)
  app/api/auth/login/request-otp/route.ts
  app/api/auth/login/verify/route.ts
  app/api/auth/logout/route.ts
  app/api/team/me/route.ts  app/api/team/dashboard/route.ts  app/api/team/qr/route.ts
  app/admin/rounds/page.tsx                 (your file inside the admin tree — no conflict)
  app/api/admin/rounds/route.ts  app/api/admin/rounds/extend/route.ts
  components/dashboard/**  components/rounds/**  components/forms/login-form.tsx
  tests/unit/dev3/**

NOT YOURS (never touch):
  app/register, app/payment, app/api/otp/**, app/api/register, app/api/event/** (Dev 1)
  app/admin/{page,login,payments,teams}, app/attendance/**, app/api/admin/{teams,payments}/**,
  app/api/attendance/**, app/api/panel/**, lib/email/**, lib/qr/** (Dev 2)
  package.json, lib/env.ts, lib/panel/session.ts, app/admin/layout.tsx, types/** (frozen)
```

---

## PART A: Sessions & OTP helpers

### A.1 `lib/auth/session.ts`

```typescript
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
export const SESSION_COOKIE = 'session_token';

export async function createSessionToken(teamId: string, teamCode: string) {
  return new SignJWT({ team_id: teamId, team_code: teamCode, kind: 'team' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(SECRET);
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET, { clockTolerance: 60 });
    if (payload.kind !== 'team') return null;
    return { team_id: payload.team_id as string, team_code: payload.team_code as string };
  } catch {
    return null;
  }
}

export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24,
    path: '/',
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}
```

### A.2 `lib/auth/otp.ts`

```typescript
import { createHash } from 'crypto';

export const hashOtp = (otp: string) =>
  createHash('sha256').update(otp + process.env.JWT_SECRET!).digest('hex');

export const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const maskEmail = (email: string) => {
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}•••@${domain}`;
};

/** Event-day check in IST regardless of server timezone. */
export const isEventDay = () => {
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return istNow.toISOString().slice(0, 10) === process.env.EVENT_DATE;
};
```

---

## PART B: `proxy.ts` (Next 16 — replaces middleware.ts)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth/session';
import { verifyPanelToken, PANEL_COOKIE } from '@/lib/panel/session';

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isApi = path.startsWith('/api/');

  const deny = (redirectTo: string) =>
    isApi
      ? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      : NextResponse.redirect(new URL(redirectTo, request.url));

  // 1. Admin pages + admin APIs (login endpoints excluded)
  if ((path.startsWith('/admin') && path !== '/admin/login') || path.startsWith('/api/admin')) {
    const token = request.cookies.get(PANEL_COOKIE)?.value;
    if (!token || !(await verifyPanelToken(token, 'admin'))) return deny('/admin/login');
    return NextResponse.next();
  }

  // 2. Attendance pages + attendance APIs
  if ((path.startsWith('/attendance') && path !== '/attendance/login') || path.startsWith('/api/attendance')) {
    const token = request.cookies.get(PANEL_COOKIE)?.value;
    if (!token || !(await verifyPanelToken(token, 'attendance'))) return deny('/attendance/login');
    return NextResponse.next();
  }

  // 3. Team dashboard + team APIs
  if (path.startsWith('/dashboard') || path.startsWith('/api/team')) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token || !(await verifySessionToken(token))) return deny('/login');
    return NextResponse.next();
  }

  // 4. Authenticated teams skip /login
  if (path === '/login') {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (token && (await verifySessionToken(token))) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*', '/login',
    '/admin/:path*', '/attendance/:path*',
    '/api/team/:path*', '/api/admin/:path*', '/api/attendance/:path*',
  ],
};
```

> The exported function is named **`proxy`** and the file is **`proxy.ts`** — `middleware.ts` is deprecated in Next 16.

---

## PART C: OTP Login

### C.1 `app/api/auth/login/request-otp/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { sendOtpEmail } from '@/lib/email';          // frozen façade (Dev 2 implements)
import { generateOtp, hashOtp, maskEmail, isEventDay } from '@/lib/auth/otp';
import { rateLimit } from '@/lib/rate-limit';

const schema = z.object({ team_code: z.string().regex(/^MNV-\d{3}$/i) });

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid team code format' }, { status: 400 });
  }
  const teamCode = parsed.data.team_code.toUpperCase();

  // Gates BEFORE burning Resend quota
  if (!isEventDay()) {
    return NextResponse.json(
      { success: false, error: 'Login opens on event day. See you there!' }, { status: 403 });
  }

  if (!rateLimit(`login-otp:${teamCode}`, 3, 10 * 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many OTP requests. Wait a few minutes.' }, { status: 429 });
  }

  const { data: team } = await supabaseServer
    .from('teams')
    .select('id, team_code, is_payment_verified, members(college_email, is_team_lead)')
    .eq('team_code', teamCode)
    .single();

  if (!team) {
    return NextResponse.json({ success: false, error: 'Invalid team code' }, { status: 401 });
  }
  if (!team.is_payment_verified) {
    return NextResponse.json(
      { success: false, error: 'Payment verification pending. Contact organizers.' }, { status: 403 });
  }

  const lead = team.members.find((m) => m.is_team_lead)!;
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + Number(process.env.OTP_EXPIRY_MINUTES ?? 10) * 60_000);

  // one live login challenge per team
  await supabaseServer.from('otp_challenges')
    .delete().eq('team_id', team.id).eq('purpose', 'login');

  const { data: challenge } = await supabaseServer.from('otp_challenges')
    .insert({
      email: lead.college_email, otp_hash: hashOtp(otp), purpose: 'login',
      team_id: team.id, expires_at: expiresAt.toISOString(),
    })
    .select('id').single();

  await sendOtpEmail({ to: lead.college_email, otp, purpose: 'login', team_id: team.id });

  return NextResponse.json({
    success: true,
    challenge_id: challenge!.id,
    sent_to: maskEmail(lead.college_email),
    expires_in: 600,
  });
}
```

### C.2 `app/api/auth/login/verify/route.ts`

Zod: `{ challenge_id: z.uuid(), otp: z.string().regex(/^\d{6}$/) }` →
1. Fetch challenge (`purpose='login'`); 400 if missing/expired.
2. `attempts >= OTP_MAX_ATTEMPTS` → delete + 400 "Too many attempts. Request a new OTP."
3. Hash-compare; miss → increment attempts, return `attempts_left`.
4. Hit → delete challenge (single-use) → fetch team → `createSessionToken` → `setSessionCookie` → return `{ success: true, team: { id, team_code, team_name } }`.

### C.3 `app/api/auth/logout/route.ts`

`clearSessionCookie()` → `{ success: true }`.

### C.4 `app/login/page.tsx` + `components/forms/login-form.tsx`

Two-step client form, **no password field**:
1. **Step 1:** team code input (`MNV-` prefix hint, uppercase) → "Send OTP" → shows `sent_to` masked email.
2. **Step 2:** 6-digit OTP input (autofocus, numeric, paste-friendly) + 60 s resend countdown + "wrong team code? go back".
3. On verify success → `router.push('/dashboard')`. Show API error strings verbatim (they're already safe: date gate / payment gate / generic invalid).

---

## PART D: Dashboard

### D.1 `app/dashboard/layout.tsx` (server)

`getSession()` → `redirect('/login')` if null. Fetch team + members. Header (team code, name, logout button posting to `/api/auth/logout`), sidebar `components/dashboard/team-sidebar.tsx` (members list with lead badge, payment ✅). Link to `/dashboard/qr`.

### D.2 `app/api/team/dashboard/route.ts`

Session-authed. Rounds joined with this team's `team_round_access`, shaped per API_GUIDE §6.2 (day1 array + day2 visibility). Status resolution: `is_locked ? 'locked' : rounds.status`.

### D.3 `app/dashboard/page.tsx` (client)

- Initial fetch + Supabase Realtime subscribe (anon client from `lib/supabase/client.ts`):

```typescript
const channel = supabaseClient
  .channel('round_status')
  .on('broadcast', { event: 'round_unlocked' }, refetch)
  .on('broadcast', { event: 'round_locked' }, refetch)
  .on('broadcast', { event: 'round_extended' }, refetch)
  .subscribe();
const poll = setInterval(refetch, 10_000);   // fallback
```

- Day 1 section: 3 × `components/dashboard/round-card.tsx` — Locked (gray, "Waiting for admin…"), Active (green, "Enter Round" + countdown to `ends_at`), Completed (blue).
- Day 2 section: locked placeholder.
- Resource bar placeholder (zeros).

### D.4 `app/dashboard/qr/page.tsx` + `GET /api/team/qr/route.ts`

API: session-authed → read `teams.qr_token` → 404 with "QR available after payment verification" if null → generate PNG data-URL server-side with `qrcode` (`QRCode.toDataURL(qr_token)`) → return. Page shows the QR full-width ("show this at every round checkpoint") + download button.

> Generate the data-URL with the `qrcode` package directly in your route — do not import Dev 2's `lib/qr` (ownership boundary); the token already lives in the DB.

---

## PART E: Admin Round Controls

### E.1 `app/api/admin/rounds/route.ts`

Cookie-authed (verify `panel_session` scope=`admin` via frozen `lib/panel/session.ts` — same defense-in-depth pattern as Dev 2's routes).

**GET:** rounds ordered by day/sequence + counters (`teams_unlocked` = count of `team_round_access` rows unlocked for the round; `teams_completed` = `completed_at not null`).

**POST** `{ round_id, action: 'unlock' | 'lock' }`:

- **unlock:**
  1. `rounds`: `status='active'`, `starts_at=now()`, `ends_at=now()+time_allotted minutes`.
  2. `team_round_access.is_locked=false, started_at=now()` for all teams with `is_payment_verified=true` (**not** an `attended` status — that concept is gone; join through `teams`).
  3. Broadcast:
     ```typescript
     const ch = supabaseServer.channel('round_status');
     await ch.send({ type: 'broadcast', event: 'round_unlocked',
                     payload: { round_id, name, starts_at, ends_at } });
     await supabaseServer.removeChannel(ch);
     ```
- **lock:** reverse (`status='locked'`, re-lock access rows, broadcast `round_locked`).

### E.2 `app/api/admin/rounds/extend/route.ts`

`{ round_id, additional_minutes }` (Zod: int 1–30) → `ends_at = ends_at + interval` → broadcast `round_extended` with the new `ends_at`. **This must actually work in Phase 1** (it's the event-day emergency button), not an alert stub.

### E.3 `app/admin/rounds/page.tsx`

Client table (your file inside the admin tree — the frozen layout already links to it): per round — name/day/duration, status badge, live countdown for active rounds (from `ends_at`), Unlock/Lock button with confirm dialog, "+5 min" button (active rounds only), counters column. Refetch after each action; cookie auth means plain `fetch` — **no admin key headers anywhere**.

---

## PART F: Acceptance Criteria

- [ ] File is `proxy.ts` with exported `proxy` function (no `middleware.ts` in the repo)
- [ ] `/login` is a two-step team-code → OTP flow; **no password input exists**
- [ ] Request-otp refuses before `EVENT_DATE` (403), for unknown codes (401, generic), and for unverified payment (403) — **without sending any email**
- [ ] OTP arrives via the frozen façade (`sendOtpEmail`, purpose `login`); works with Dev 2's stub replaced or not
- [ ] Wrong OTP 3× kills the challenge; resend throttled (3/10 min per team)
- [ ] Successful verify sets `session_token` (httpOnly, Strict) and lands on `/dashboard`
- [ ] Unauthed `/dashboard` → `/login`; authed `/login` → `/dashboard`; unauthed `/admin/*` → `/admin/login`; unauthed `/attendance/*` → `/attendance/login`
- [ ] Dashboard shows 3 locked Day-1 cards; admin unlock flips them to Active within 10 s (Realtime or poll)
- [ ] Unlock affects exactly the payment-verified teams; counters correct
- [ ] "+5 min" extends `ends_at`, dashboards' countdowns update
- [ ] `/dashboard/qr` re-displays the attendance QR; 404-safe before verification
- [ ] Logout clears the cookie and redirects

**Do NOT build:** registration, payment page, email providers, admin payments/teams pages, the `/attendance` panel. Do not edit `package.json`, `app/admin/layout.tsx`, `lib/email/index.ts`, or any frozen file.
