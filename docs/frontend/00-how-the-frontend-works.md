# How the MINEVERSE Frontend Works (read this before touching any page)

This explains the conventions every phase's frontend follows. Read [../01-nextjs-and-typescript-for-beginners.md](../01-nextjs-and-typescript-for-beginners.md) first if "Server Component vs Client Component" is still fuzzy.

## 1. Where a page's actual content lives — the two-file pattern

Almost every route follows the same pattern: a thin file in `app/**/page.tsx`, and the real content in `features/**/*.tsx`.

```tsx
// app/register/page.tsx  — thin, server-rendered, no 'use client'
import { RegistrationForm } from '@/features/landing-registration/registration-form';

export default function RegisterPage() {
  return (
    <div className="...background/layout...">
      <RegistrationForm />
    </div>
  );
}
```

```tsx
// features/landing-registration/registration-form.tsx — the real thing
'use client';
export function RegistrationForm() {
  const [otpVerified, setOtpVerified] = useState(false);
  // ...all the actual form logic, state, and fetch() calls...
}
```

**Why split it this way?** The `page.tsx` file can stay a Server Component (fast, no client JS shipped for the static background/layout), while only the interactive part (`'use client'`) ships JavaScript to the browser. It also matches file ownership: whoever owns a route's feature folder owns everything about that page's behavior.

**Rule of thumb for where new code goes:**
- A whole new page's real content, or a big stateful chunk (a form, a scanner, a dashboard view) → `features/<your-area>/`
- A small, reusable, mostly-presentational piece (a button, a badge, a card layout used in 3+ places) → `components/<area>/`, or `components/ui/` if it's generic enough to be a design-system primitive
- Anything already in `components/ui/` (Button, Card, Input, Label, Select, Badge, Dialog, Table) → **reuse it, don't rebuild it**

## 2. Every interactive piece is a small, focused Client Component ("island")

You don't put `'use client'` at the top of `app/register/page.tsx` itself. You put it on the smallest component that actually needs interactivity, and let everything around it stay server-rendered. In this repo that means: forms, the OTP input, the QR camera scanner, the admin tables (search/filter/toggle), the round countdown timers, the dashboard's realtime round cards. Static marketing content, layout chrome, and anything that's "just read data and print it" stays a plain Server Component.

## 3. Forms: react-hook-form + Zod, one schema shared client and server

Every form in this project is built with **react-hook-form** for form state, and **Zod** (`lib/validation/schemas.ts`) for validation — the *same* schema object is imported by both the form component and the matching API route, so the rules can never drift apart.

`features/landing-registration/registration-form.tsx` is the reference pattern for anything more complex than a plain field — study it before building a new form:

```tsx
const { register, control, handleSubmit, watch, setValue, formState } = useForm<FormValues>({
  resolver: zodResolver(registrationSchema),   // ties Zod into RHF
  defaultValues: { ... },
});

// A field-level async action (like "Verify Email") is a SEPARATE button
// from the form's own submit — it calls fetch() directly, not handleSubmit
const handleSendOtp = async () => {
  const res = await fetch('/api/otp/send', { method: 'POST', body: JSON.stringify({...}) });
  ...
};

// Verified-ness is plain useState, not form state — because it needs to
// directly gate the Submit button's `disabled` prop, and Zod alone can't
// express "this button must have been clicked and succeeded first"
const [otpVerified, setOtpVerified] = useState(false);

<button type="submit" disabled={isSubmitting || !otpVerified || !turnstileToken}>
  {isSubmitting ? 'PROCESSING...' : 'REGISTER NOW'}
</button>
```

Error display convention: **inline** field errors under each input (`errors.fieldName?.message`), and **toast** (`sonner`) for anything that isn't tied to one field — network failures, server-rejected submissions, "please fix the highlighted fields." Never use a blocking `alert()`.

## 4. How a button click actually changes the database

There is exactly one path, always:

```
Button onClick / form onSubmit
  → fetch('/api/whatever', { method: 'POST', body: JSON.stringify(data) })
  → await res.json()
  → if (result.success) { update local state / toast / router.push(...) }
    else { toast.error(result.error) }
```

No client component ever imports `lib/supabase/server.ts` or queries the database. If a component seems to need direct database access, the actual fix is "there needs to be (or already is) an API route for that" — see [../backend/00-how-the-backend-works.md](../backend/00-how-the-backend-works.md).

## 5. State management — deliberately minimal

There is no Redux, no Zustand, no heavy global Context. State lives at the smallest scope that makes sense:

| Kind of state | Where it lives |
|---|---|
| Form fields | react-hook-form, local to that form |
| A one-off UI flag (OTP verified, is-sending, is-loading) | `useState` in that component |
| "Who am I logged in as" | Read from the cookie **server-side**, in a Server Component, passed down as a prop. Never re-derived on the client |
| Live data that changes without user action (round unlock status) | A Supabase Realtime subscription in a client island, `useState` for the current value, reconciled every 10s by polling the matching `GET` endpoint as a fallback |
| A volunteer's chosen attendance checkpoint | `localStorage`, read once on mount (so they don't have to re-pick it every scan) |
| Admin table filters/search | URL search params (`useSearchParams`), so a filtered view is shareable and survives the back button |

## 6. Design system: shadcn/ui + Tailwind v4 + a Minecraft skin on top

`components/ui/**` is the shadcn primitive set (Button, Card, Input, Label, Select, Badge, Accordion, Dialog, Table, the `sonner` toaster). These are installed once and are **frozen** — adding a new one requires `npx shadcn add <name>`, not hand-rolling a lookalike.

On top of that, several pages (landing, register, payment, dashboard) apply a heavy **Minecraft-block visual theme** directly with inline styles — pixelated borders, wood/parchment textures, blocky drop shadows, a custom Minecraft-style font (`var(--font-minecraft)`). This is intentional and consistent — when building a new themed page, match the existing look (see `features/landing-registration/registration-form.tsx` for the `woodBg` / `parchmentBg` / `inputBg` style objects as a copyable reference) rather than introducing a different visual language. Admin/attendance panels are more utilitarian (plain shadcn), since organizers/volunteers need speed and legibility over theming.

Tailwind v4 has no `tailwind.config.ts` — theme tokens live in `app/globals.css` under `@theme`. That file is frozen after the foundation commit; don't add ad-hoc colors per-page, extend the shared tokens instead.

## 7. Mobile vs. desktop expectations

- `/attendance` is **mobile-first, full stop** — a volunteer holding a phone in one hand. Big tap targets, the manual team-code entry always visible (never hidden behind a toggle), a stepper/segmented control for headcount rather than a dropdown.
- `/`, `/register`, `/payment`, `/login`, `/dashboard` are responsive across phone → desktop.
- `/admin/**` is desktop-first (organizers run it from a laptop) but must not visibly break on a tablet.

## 8. Loading and error states

- A Server Component doing a non-trivial fetch gets a route-level `loading.tsx`.
- A client-side async action (form submit, OTP send, admin verify click) shows an inline spinner/disabled-button state instead — no full-page spinner for a button click.
- Every fetch has a `try/catch` and shows a `toast.error(...)` on network failure — the user should never see a page that just silently does nothing after a click.

---

Next: read your phase's frontend doc — [01-phase-1-frontend.md](./01-phase-1-frontend.md), [02-phase-2-frontend.md](./02-phase-2-frontend.md), or [03-phase-3-frontend.md](./03-phase-3-frontend.md).
