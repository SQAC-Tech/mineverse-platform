# Next.js and TypeScript, explained for someone who has never used either

If you've built websites with plain HTML/CSS/JS, or even done a basic React tutorial, this doc bridges the gap to what's actually in this repo. No prior Next.js knowledge assumed.

## 1. What even is React (30-second refresher)

React lets you build a webpage out of reusable pieces called **components**. A component is a JavaScript function that returns what should appear on screen.

```tsx
function Greeting() {
  return <h1>Hello, MINEVERSE!</h1>;
}
```

That weird HTML-inside-JavaScript is called **JSX**. It's not a string, it's not HTML — it compiles into regular JavaScript that builds the page. You'll get used to reading it in about a day.

## 2. What Next.js adds on top of React

Plain React only handles "what shows on screen." It doesn't decide which URL shows which page, and it doesn't know how to talk to a database. **Next.js is a framework built on top of React that adds:**

- **Routing** — which URL (`/register`, `/dashboard`, `/admin/payments`) shows which component. In this project, the *folder structure decides the URL*. More on this below — it's the single most important thing to understand.
- **A server** — Next.js doesn't just run in the browser. Some of your code runs on a server (Vercel, in our case) where it's safe to talk to the database and use secret keys. Other code runs in the browser like normal React.
- **API routes** — a way to write backend endpoints (like `POST /api/register`) in the same project, same language, same repo. You are not going to write a separate Express/Django backend. The backend *is* Next.js.

### The single most important mental model: the App Router

This project uses Next.js's **App Router**, which lives in the `app/` folder. The rule is simple:

> **A folder inside `app/` becomes a URL segment. A `page.tsx` file inside that folder is what renders at that URL.**

```
app/
├── page.tsx                → https://mineverse.tech/
├── register/
│   └── page.tsx             → https://mineverse.tech/register
├── admin/
│   ├── page.tsx             → https://mineverse.tech/admin
│   └── payments/
│       └── page.tsx         → https://mineverse.tech/admin/payments
```

There is no router config file to edit, no `<Route path="...">` list to maintain. **You want a new page at `/foo/bar`? You create the file `app/foo/bar/page.tsx`.** That's it. That's the whole trick.

A few more special filenames you'll see inside route folders:

| File | Purpose |
|---|---|
| `page.tsx` | The actual page content for that URL |
| `layout.tsx` | A wrapper that stays on screen across multiple pages under it (e.g. `app/dashboard/layout.tsx` renders the sidebar + header once, and swaps out just the inner page) |
| `route.ts` | **Not a page — a backend API endpoint.** This is how the "folder = URL" rule extends to the backend. `app/api/register/route.ts` becomes the backend endpoint `POST /api/register`. |

### Server Components vs. Client Components — the other big idea

By default, every component in `app/` runs **on the server**, not in the browser. It renders once, and the finished HTML is sent down. This is called a **Server Component**. It's great for things like "fetch this team's data from the database and show it" because the database credentials never have to leave the server.

But a server-rendered component can't respond to a button click, can't use `useState`, can't run code *after* the page has loaded. For that, a component needs to run in the browser. You opt into that by putting this literal string at the very top of the file:

```tsx
'use client';
```

That one line is the entire difference. No `'use client'` → runs on the server, can talk to the database directly, cannot have interactivity. Has `'use client'` → runs in the browser, can have `onClick`, `useState`, `useEffect`, **cannot** talk to the database directly (no secret keys in the browser!) — it has to `fetch()` an API route instead.

**Rule of thumb for this project:** pages default to Server Components. Only the specific piece that needs a button, a form, or a live update becomes a small `'use client'` component (we call these "islands") embedded inside the server-rendered page. You'll see this pattern everywhere — e.g. `app/register/page.tsx` is a plain server component that just renders `<RegistrationForm />`, and `features/landing-registration/registration-form.tsx` has `'use client'` at the top because it's a form with buttons, OTP input, loading spinners, etc.

## 3. What TypeScript adds on top of JavaScript

TypeScript is JavaScript with **types** — you tell the compiler what shape your data is supposed to be, and it yells at you *before* the code runs if you get it wrong, instead of the app quietly breaking in front of a user at 2 AM on event day.

```ts
// Plain JavaScript — nothing stops you from passing garbage
function sendOtp(email) { ... }
sendOtp(12345); // silently broken, blows up somewhere downstream

// TypeScript — the editor screams at you immediately
function sendOtp(email: string) { ... }
sendOtp(12345); // red squiggly line: "Argument of type 'number' is not assignable to parameter of type 'string'"
```

A few TypeScript things you'll see constantly in this repo:

- **`type` / `interface`** — a named shape for an object. `type FormValues = { team_name: string; members: Member[] }` means "a FormValues is an object with exactly these fields, with exactly these types."
- **`.ts` vs `.tsx`** — same language. `.tsx` is used when the file contains JSX (components); `.ts` is for plain logic (validation, database helpers, config) with no HTML-like markup.
- **Zod schemas** (`lib/validation/schemas.ts`) — TypeScript types only exist while coding; they vanish at runtime and can't stop a malicious user from sending bad data straight to your API. **Zod** is a library that defines the *same* shape as a runtime check: `z.string().email()` actually validates real incoming data at request time, and can also generate the matching TypeScript type. This is why you'll see the same schema imported both in a form component (client-side validation, instant feedback) and in an API route (server-side validation, the one that actually matters for security — never trust the client).

You don't need to become a TypeScript expert to contribute. You mostly need to: read the red squiggly line, and match the shape it's asking for. The editor (VS Code) will autocomplete field names for you once a type is defined — lean on that constantly.

## 4. How a page actually gets its data (put it all together)

Here's the full picture using the real registration flow, tying together everything above:

```
1. Browser requests https://mineverse.tech/register
2. Next.js finds app/register/page.tsx (folder → URL)
3. That's a Server Component — it renders on the server, returns HTML
4. Embedded inside is <RegistrationForm />, which has 'use client' —
   it "hydrates" in the browser and becomes interactive
5. User fills the form, clicks "Verify Email"
6. The client component calls fetch('/api/otp/send', { method: 'POST', ... })
7. Next.js finds app/api/otp/send/route.ts (folder → URL, but for an API)
8. That route.ts runs ONLY on the server. It validates the request with a
   Zod schema, talks to the database (Supabase) using a secret key,
   sends an email, and returns JSON back to the browser
9. The client component reads the JSON response and updates the screen
   (e.g. shows the OTP input, or a toast error)
```

That request/response loop — browser calls `fetch()` on an API route, API route touches the database, API route returns JSON — is **the only way data moves in this app**. Once this clicks, the rest of the codebase reads as "which folder has the piece I need to change."

## 5. A few Next.js-specific words you'll hear that don't exist in plain React

| Term | Plain-English meaning |
|---|---|
| **Route handler** | The formal name for a `route.ts` file — a backend endpoint. |
| **`proxy.ts`** | A special file that runs *before* any page or API route, on every matching request. Ours checks "does this visitor have a valid login cookie for the page they're trying to reach?" and redirects/blocks if not. Think of it as a bouncer at the door, before you even get to the page. (In older Next.js versions this file was called `middleware.ts` — same idea, new name in the version we're on.) |
| **Server Action / API route** | Two different ways Next.js lets you run server code from a button click. This project uses API routes (`route.ts` + `fetch()`) everywhere, not Server Actions, so you don't need to learn that second mechanism at all. |
| **Hydration** | The moment a server-rendered page "wakes up" in the browser and client components become clickable. You'll never write hydration code yourself, just know the word if it comes up in an error message. |
| **Turbopack** | The tool that runs `npm run dev` fast and rebuilds instantly when you save a file. You don't configure it, you just benefit from it. |
| **`npx shadcn@latest add <thing>`** | How new pre-built UI pieces (buttons, dialogs, tables) get added to `components/ui/`. Already-installed ones should not be hand-rewritten — reuse `<Button>`, `<Card>`, etc. |

## 6. Where to actually go next

Read [02-repo-tour.md](./02-repo-tour.md) next — it walks the real folders in this real repo, not toy examples.
