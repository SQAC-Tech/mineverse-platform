# Phase 2 Frontend — Day 1 Gameplay UI (planning stage — this is what you'll build)

> **Partly superseded by [`../REMOVED_SYSTEMS.md`](../REMOVED_SYSTEMS.md) (14 Aug 2026).** Structures,
> negative world events, and platform-recorded offline games were removed. Where this document
> describes any of them, it is a record of what was planned, not of what exists.

**Status: not built yet.** This translates the UI-relevant parts of `PHASE2_MASTER.md` and the three `PROMPT_DEV_*.md` files into a page-by-page tour. Those `PROMPT_DEV_*.md` files are the actual binding file-path contract for whoever builds this — if a path here and there ever disagree, the `PROMPT_DEV` file wins.

Read [00-how-the-frontend-works.md](./00-how-the-frontend-works.md) and [../backend/02-phase-2-backend.md](../backend/02-phase-2-backend.md) first — every screen below is a thin UI layer over the routes and tables described there.

## New top-level routes and who builds them

```
app/(game)/round/[round_id]/          Dev 4 — the round shell every team plays inside
app/leaderboard/                       Dev 4 — public leaderboard
app/qualification/page.tsx             Dev 3 — team-facing Day 2 qualification result
app/admin/game-ops/page.tsx            Dev 5 — organizer console for grading/events/PvP/offline
```

`(game)` is a route group (parentheses folder — doesn't appear in the URL, see [../02-repo-tour.md](../02-repo-tour.md)), used here to give the round pages a shared layout without it showing up as `/game/round/2`.

Component folders (all new): `components/game/questions/**`, `components/game/resources/**`, `components/game/crafting/**`, `components/game/round-shell/**`, `components/game/pvp/**` (Dev 4); `components/game/guardian/**`, `components/game/structures/**`, `components/game/marketplace/**`, `components/game/qualification/**` (Dev 3); `components/admin/grading/**`, `components/admin/event-ops/**` (Dev 5). **Never create a flat file like `components/game/guardian-battle.tsx`** — it must go inside `components/game/guardian/`. This nesting is what lets three devs' UI merge without touching the same file.

## The round shell (Dev 4) — every team round lives inside this

`app/(game)/round/[round_id]/page.tsx` + `layout.tsx`, with `components/game/round-shell/**`. This is the container every other piece of Round 1/2/3 UI mounts inside. It's mobile-first and must show, at all times:

- An **authoritative countdown**, driven by the server's `ends_at` — never a client-only timer that could drift or be manipulated
- The **question list** with each question's status (draft / submitted / graded)
- The **resource bar** (Dev 4's `components/game/resources/**`) — current balance + active modifiers, refreshed on a 10-second poll with Realtime as a nice-to-have on top
- A manual refresh action, for when a team suspects they've missed a broadcast

If a Dev 3- or Dev 5-owned feature (guardian fight, a triggered world event) isn't reachable for some reason, the round shell shows a **bounded "unavailable" state** — it must never reimplement that feature itself just to fill the gap.

### Questions and submissions

`components/game/questions/**` renders each question by type (crossword, aptitude, output-prediction, debugging, code-completion, coding) and lets a team save/revise an answer while the round is open. Submitting never shows a score immediately — grading is a separate, later step (Dev 5's pipeline). Once the round locks, question fields become read-only and a 403 from the server is expected/handled gracefully, not treated as a bug.

### Resources and crafting

`components/game/resources/**`: a balance display (Wood/Stone/Iron/Gold/Diamond/Emerald/Obsidian) plus a paginated history list — "why do I have this many diamonds," in UI form. `components/game/crafting/**`: shows available recipes with real-time eligibility (enough resources? right round?) and a **Craft** button per item:

| Item | Cost shown | What crafting it does |
|---|---|---|
| Wooden Pickaxe | 60 Wood | Unlocks Round 2 |
| Stone Pickaxe | 10 Wood + 45 Stone + 25 Iron | Unlocks Round 3 |
| Iron Armor | 40 Iron + 25 Gold | Marks PvP eligibility (does not by itself qualify a team for Day 2) |

If a team has built the Forge structure (Dev 3's feature), displayed costs must already reflect the 10%/20% discount — the UI must never show one number and have the server charge a different one, so both sides round the same way (round each discounted resource cost **up**).

### Public leaderboard

`app/leaderboard/page.tsx`. Read-only, refreshes every 30 seconds, shows a last-updated timestamp. **This page must not visually imply it decides qualification** — qualification is a separate, admin-confirmed decision (below). Only organizer-approved, non-sensitive fields are shown.

### Team-side private PvP screen (Dev 4 builds the UI; Dev 5's admin console starts the match)

`components/game/pvp/**`, reading `GET /api/team/pvp/current`. Three states to design for:

1. **Not yet started / waiting** — the team knows they might be selected but sees no questions yet, just a waiting state.
2. **Live** — shows the sealed question pack (same questions both teams got, frozen at match start), a server-driven deadline/countdown, and the team's own answer/submission state. It polls every 5 seconds (tighter than the usual 10s, because this is time-critical). It never shows the opponent's identity, answers, or progress.
3. **Resolved** — shows the final result and the team's own award, only after the server has resolved the match. A page refresh or reconnect must land back on the exact same state — the client never computes or guesses the outcome itself.

## Strategy layer UI (Dev 3)

### Guardians

`components/game/guardian/**`. One screen per guardian fight (Forest Guardian in Round 1, Skeleton Archer in Round 2, Blaze Guardian in Round 3 — the mandatory one, required before PvP eligibility). Each shows: current state (not attempted / in progress / won / lost-with-cooldown), a safe countdown while a cooldown is active, the attempt's questions, and a clear **Retry** action once the 3-minute cooldown clears (or immediately if a retry-token consumable is used). Victory/defeat feedback shows the reward or penalty that was actually applied — never a client-guessed number.

### Structures

`components/game/structures/**`. A base-structure picker (free — one choice per team per relevant round):

| Round | Choice | What it does |
|---|---|---|
| 2 | Bat Cave | Reveals one bonus challenge; protects against Creeper Explosion's resource loss |
| 2 | Forge | 10% off all future crafting (used by Dev 4's crafting UI) |
| 3 | Bastion | Protects against negative Round 3 events while active |
| 3 | TNT Storage | Skip one question once, receive 50% of its reward |

Plus post-round **upgrade** buttons (Echo Bat Cave, Master Forge, Reinforced Bastion, Mega TNT Storage) shown only once the base structure exists, and a **Repair** action when a structure shows a `damaged` state (repair costs are fixed per the event brief — 8 Stone for Creeper damage, varying costs for Ghast damage depending on which structure got hit). A damaged, unrepaired structure's ability/protection must visibly read as inactive — don't let the UI imply protection that isn't currently working.

### Marketplace and choice events

`components/game/marketplace/**`: a shop screen listing the canonical item list only (no invented items), with **Buy** deducting Emeralds atomically, and a separate **Use** action for consumables bought earlier (Totem, Retry Token, Revival Potion, Strength Potion) — buying and using are always two different clicks, never one.

Choice events are one-time, explicit decisions, each needing its own small screen/modal that clearly shows all options before commit (since these can't be undone):

- **Ancient Shrine** (after Round 2): 10 Wood→2 Emeralds, or 5 Iron→15 Stone, or Ignore (costs 5 Wood + 3 Stone)
- **Piglin Merchant** (Round 3): 10 Gold→3 Emeralds, or 4 Emeralds→18 Gold, or Ignore (costs 5 Gold)

### Qualification (`app/qualification/page.tsx`)

The team-facing result screen — deliberately simple: a clear "You Qualified for Day 2!" or a respectful thank-you/eliminated message. All the actual decision logic (eligibility checks, the top-50% cutoff, freezing the list) happens in Dev 3's admin-scoped API, not here — this page just displays the outcome.

## Organizer console (Dev 5) — `app/admin/game-ops/page.tsx`

One page, several sections (using `components/admin/grading/**` and `components/admin/event-ops/**`):

- **Grading** — lock the round (reuses Phase 1's existing round-lock control, doesn't reimplement it), start a grading run, watch progress (queued/running/completed/failed/manual-review counts), and apply a manually-reasoned override on any one submission.
- **World events** — six buttons, one per canonical event key (`heavy_rain`, `fertile_marsh`, `creeper_explosion`, `gold_rush`, `lava_eruption`, `ghast_bombardment`) — deliberately not a free-text "trigger any effect" input, since only these six are real.
- **Offline results** — a form to record a volunteer-verified physical-game outcome: team, activity, outcome, volunteer name, submitted with an idempotency key so a double-submit can't double-pay.
- **PvP operations** — select exactly two eligible teams + an approved question pack → **Start PvP** (this button is the one that actually begins the live match teams see). Also: monitor live matches (safe status only, no answer leakage even to the admin's own screen beyond what's needed to operate), and **Void** (requires a typed reason) for a broken/unfair match.
- **Manual resource adjustments** — a signed delta + required reason, with a before/after confirmation shown before it's applied. This action explicitly **cannot** set qualification status — that's a hard line, not just a convention, enforced server-side too.

## Design consistency note

Phase 1's Minecraft-block visual theme (see [01-phase-1-frontend.md](./01-phase-1-frontend.md)) should extend naturally into the team-facing round/guardian/crafting screens — they're the most player-facing part of the whole product. The admin game-ops console can stay closer to the plain, utilitarian shadcn style of the existing `/admin` panel, since speed of operation matters more than theming when an organizer is running live event-day operations.

## File ownership recap

| Dev | Frontend paths |
|---|---|
| Dev 4 | `app/(game)/round/**`, `app/leaderboard/**`, `components/game/questions/`, `resources/`, `crafting/`, `pvp/`, `round-shell/` |
| Dev 3 | `app/qualification/page.tsx`, `components/game/guardian/`, `structures/`, `marketplace/`, `qualification/` |
| Dev 5 | `app/admin/game-ops/page.tsx`, `components/admin/grading/`, `event-ops/` |

Never add a file outside your nested subtree, and never edit `app/dashboard/**`, `app/admin/(panel)/layout.tsx`, or `components/ui/**` — same frozen list as Phase 1.
