# MINEVERSE Team Docs — Start Here

This folder exists for one reason: **most of you have never touched Next.js or TypeScript before, and you need to be productive in this repo fast.** These docs assume nothing. If a word looks like jargon, it gets explained the first time it shows up.

Read in this order:-

1. **[01-nextjs-and-typescript-for-beginners.md](./01-nextjs-and-typescript-for-beginners.md)** — What Next.js and TypeScript actually are, in plain words. Read this even if you "kind of know React." 20 minutes.
2. **[02-repo-tour.md](./02-repo-tour.md)** — A guided walk through every folder in `mineverse/`, what lives where, and how to find "the file I need to edit" without asking in the group chat.
3. **[backend/00-how-the-backend-works.md](./backend/00-how-the-backend-works.md)** — The big picture: how a request travels from a button click to the database and back. Read once, refer back forever.
4. **[frontend/00-how-the-frontend-works.md](./frontend/00-how-the-frontend-works.md)** — Same, but for pages, components, and buttons.

Then jump to whichever phase you're building:

| Phase | What it is | Status | Backend doc | Frontend doc |
|---|---|---|---|---|
| **Phase 1** | Registration, payment, login, dashboard, admin panel, attendance scanning | ✅ **Already built** — read the code alongside the doc | [backend/01-phase-1-backend.md](./backend/01-phase-1-backend.md) | [frontend/01-phase-1-frontend.md](./frontend/01-phase-1-frontend.md) |
| **Phase 2** | Day 1 gameplay: Round 1 (Forest), Round 2 (Cave), Round 3 (Mountain) — questions, resources, crafting, guardians, PvP | 📝 Planned, not built yet — this is what most of you will build next | [backend/02-phase-2-backend.md](./backend/02-phase-2-backend.md) | [frontend/02-phase-2-frontend.md](./frontend/02-phase-2-frontend.md) |
| **Phase 3** | Day 2 gameplay: Round 4 (Nether Portal Repair), Round 5 (The End), Final Boss, winner certification | 📝 Planned, not built yet | [backend/03-phase-3-backend.md](./backend/03-phase-3-backend.md) | [frontend/03-phase-3-frontend.md](./frontend/03-phase-3-frontend.md) |

## Why do these docs exist alongside `Phase1/`, `Phase 2/`, `Phase 3/`?

Those folders (`Phase1/MASTER.md`, `PHASE2_API.md`, `PHASE2_DATABASE.md`, etc.) are the **specification** — precise, contract-style documents written for someone who already knows Next.js and just needs the exact rules. They are still the source of truth for exact field names, error codes, and edge cases. Nobody is deleting them.

`docs/` is the **teaching layer** on top of that spec. It exists to answer the question the spec docs don't answer: *"I don't know what an API route even is — where do I start, and what do I actually type?"*

If something in `docs/` and something in `Phase1/`, `Phase 2/`, or `Phase 3/` ever disagree, **the phase folder wins** — it's the contract. `docs/` should be corrected to match. If you spot a mismatch, flag it to the project lead, don't just pick one silently.

## Ground rules that apply to every phase

These are non-negotiable, and they show up in every doc below, so learn them once:

- **No passwords for teams, ever.** Teams log in with a team code + a one-time code (OTP) emailed to them. Only the admin panel and the attendance panel have passwords (one shared password each, not per-person).
- **The browser never talks to the database directly.** Every single read or write goes through an API route (`app/api/**`) running on the server. The database (Supabase/Postgres) is configured to refuse all direct access from a browser — this is called "deny-all RLS" and you'll see it mentioned constantly. If you're tempted to call Supabase from a component with `"use client"` at the top, stop — you're doing it wrong.
- **Every "change something" request must be safe to retry.** Phones drop signal, admins double-click buttons, WiFi at the venue is bad. Every mutation is written so that doing it twice by accident has the same effect as doing it once. You'll see this called "idempotency" — don't panic, it just means "safe to repeat."
- **File ownership is real and enforced by convention, not by tooling.** Each dev owns a set of files. Do not edit a file someone else owns, even to "quickly fix" something — ping them instead. This is how a 3–5 person team avoids merge conflicts without a strict branching workflow. The exact ownership map is in each phase's backend doc.

If you only read one more thing after this page, make it `01-nextjs-and-typescript-for-beginners.md`.
Done
