# Phase 2 Backend — Day 1 Gameplay (planning stage — this is what you'll build)

**Status: not built yet.** This doc translates `../Phase 2/PHASE2_MASTER.md`, `PHASE2_API.md`, `PHASE2_DATABASE.md`, and `PHASE2_PVP.md` into plain language so you can start writing code without first parsing four dense spec documents. When you need an exact field name, exact error code, or an edge case not covered here, go to those files — they are the binding contract, this is the tour guide.

Read [00-how-the-backend-works.md](./00-how-the-backend-works.md) and [01-phase-1-backend.md](./01-phase-1-backend.md) first. **Nothing about Phase 1's stack, cookies, or database access pattern changes.** Phase 2 is purely additive: new tables, new routes, reusing the exact same `session_token` / `panel_session` cookies and the exact same deny-all-RLS-via-service-role pattern.

## What Phase 2 actually is, in one sentence

Day 1 has 3 rounds (Round 1 Forest, Round 2 Cave, Round 3 Mountain). Teams answer questions, earn/spend Minecraft-themed resources (Wood, Stone, Iron, Gold, Diamond, Emerald, Obsidian), craft progression items, fight "guardians," and the top half of teams (by Iron Armor + winning a private 1v1 question duel) qualify for Day 2. **Day 2 itself is out of scope for Phase 2** — that's Phase 3.

## The three people building this, and what they own

This is the load-bearing decision for avoiding merge conflicts across a 3-person sub-team. Each person owns a *vertical slice* — their own tables, their own routes, their own UI folders — and touches nothing outside it.

| Dev | Owns | Does NOT own |
|---|---|---|
| **Dev 4** | Questions & submissions, the resource ledger (read model), crafting, the public leaderboard, the team-facing side of the Round 3 PvP duel | Guardians, structures, marketplace, grading, admin operations |
| **Dev 3** | Guardians, structures (bases + upgrades + repairs), marketplace, "choice" events (pick-one decisions), Day 2 qualification decision | The round shell/submissions, resources/crafting, grading/admin ops |
| **Dev 5** | Grading (auto + Groq LLM + manual override), world events (rain, gold rush, etc.), offline/physical-game result entry, **admin-side PvP operations** (selecting teams, pressing Start), manual resource adjustments | Team-facing gameplay UI, crafting logic |

If your task touches a table or route not in your column, it belongs to someone else — coordinate instead of editing it.

## New database tables (three migration files, one per dev, applied in order)

```
teams (existing, Phase 1) ──< submissions >── questions ──> rounds (existing)
  │
  ├── resources ──< resource_ledger        [Dev 4 — the balance + its audit trail]
  ├── crafting_log                          [Dev 4 — one row per item ever crafted]
  ├── structures ──< structure_repairs      [Dev 3 — base building + upgrades]
  ├── guardian_battles                      [Dev 3 — attempt history per guardian]
  ├── transactions ──< item_uses            [Dev 3 — marketplace buy now / use later]
  ├── choice_decisions                      [Dev 3 — one-time pick-one events]
  ├── team_game_state                       [Dev 3 — the Phase 3 handoff row: Nether
  │                                           Core count, qualified_for_day2, etc.]
  ├── team_event_effects >── world_events   [Dev 5 — active modifiers from admin-
  │                                           triggered events like Heavy Rain]
  ├── offline_results                       [Dev 5 — volunteer-verified physical games]
  └── pvp_matches → pvp_match_teams,        [Dev 5 creates/owns matches; Dev 4 owns the
        pvp_match_questions,                 team-facing read/submit side; the result
        pvp_match_submissions → pvp_results  feeds Dev 3's qualification decision]
```

**The single most important rule in this whole phase:** no route handler ever updates `resources` directly. Every award or deduction goes through one shared server-side function that, in a single transaction: locks the team's resource row → checks the idempotency key hasn't been used before → verifies the balance won't go negative → writes both the `resources` update and a new `resource_ledger` row → returns the new balance and the ledger row's id. If you're writing a route that changes a team's Wood/Stone/Iron/etc., you call that function — you do not write your own `UPDATE resources SET ...`.

Everything (like Phase 1) is deny-all RLS — service role only, through server routes.

## Team-facing routes (mostly Dev 4, guardians/structures/marketplace = Dev 3)

All require the Phase 1 `session_token` cookie — no new team login mechanism.

| Route | What it does |
|---|---|
| `GET /rounds/[round_id]/questions` | The question list for the *current team's* active, unlocked round. Never includes the answer key, rubric, or hidden test cases — those stay server-only forever |
| `POST /submissions` | Save or revise an answer while the round is still open. Locking happens automatically once the round is locked (Phase 1's existing round-lock mechanism) — a submission never "self-awards," grading happens separately |
| `GET /team/resources`, `GET /team/resources/history` | Current balance + active modifiers; paginated ledger history for "why do I have this many diamonds" |
| `GET /team/craft/recipes`, `POST /team/craft` | List what's craftable (with any active discount applied) and craft one atomically. Body is just `{ "item": "stone_pickaxe" }` — server derives the real cost, checks the balance, and does the deduction + unlock in one transaction |
| `GET/POST /team/guardian/**` | Start a guardian fight, submit the attempt, see the result. A failed attempt has a 3-minute cooldown (`429` with `retry_after` while it's active); a victory can be claimed exactly once |
| `GET/POST /team/structures/**` | Choose a free base structure (one per team per round), upgrade it, repair storm/creeper damage, use a TNT-style ability |
| `GET/POST /team/marketplace/**` | Browse and buy server-defined items; buying and using are separate actions (buy now, use later — e.g. a "revival token") |
| `GET/POST /team/choices/**` | Commit to a one-time pick-one decision (e.g. "Ancient Shrine" choice) |
| `GET /leaderboard` | Public, organizer-approved ranking — never leaks anything sensitive |
| `GET/POST /team/pvp/**` | See your own private Round 3 match and submit your answers (see the PvP section below) |

Every mutating route requires an idempotency key (see [00 §7](./00-how-the-backend-works.md#7-idempotency--building-things-that-survive-being-clicked-twice)).

## Admin-facing routes (mostly Dev 5, qualification = Dev 3)

All require the Phase 1 `panel_session` cookie, scope `admin` — every one of these routes **independently checks that scope itself**, it does not just trust that `proxy.ts` already gated the page.

| Route | What it does |
|---|---|
| `POST /admin/grade/runs`, `GET /admin/grade/runs/[id]` | Create/resume a grading run for a locked round; deterministic questions grade instantly, rubric/free-text ones queue for an LLM (Groq) with a durable job — never "fire and forget," so a crashed request doesn't lose grading work |
| `POST /admin/grade/overrides` | Manually override one submission's score, with a required non-empty reason; only the *difference* from the previous score is applied to the ledger, never the whole score again |
| `POST /admin/events/trigger` | Trigger a canonical world event by key only — `heavy_rain`, `fertile_marsh`, `creeper_explosion`, `gold_rush`, `lava_eruption`, `ghast_bombardment`. The admin cannot invent an arbitrary effect from the browser; only these six keys exist |
| `POST /admin/offline/results` | Record a volunteer-verified physical/offline game result, paid exactly once (idempotency key) |
| `POST /admin/pvp/matches`, `.../[id]/start`, `GET .../[id]`, `.../[id]/void` | The whole PvP admin lifecycle — see next section |
| `POST /admin/resources/adjustments` | A manual, audited resource correction (signed delta + required reason). This endpoint can change a balance, but it can never set qualification status |
| `GET/POST /admin/qualification/**` | Review who's eligible, then **freeze** the Day 2 qualified list with an explicit cutoff + reason. Once frozen it's immutable — a later correction is a new, separately audited decision, never a silent edit |

## Round 3's online PvP — read this carefully, it's the trickiest part of Phase 2

Round 3 (Mountain) requires Iron Armor before a team can PvP. This is **not** a public matchmaking system. There is no queue, no bracket, no player-initiated challenge. It is entirely organizer-driven:

```
Admin picks exactly 2 eligible teams + one approved question pack
  → POST /admin/pvp/matches
      server rejects: same team twice, missing Iron Armor, missing the
      mandatory Blaze Guardian requirement, a team already in another
      active match, a team with an existing final PvP result, Round 3
      not active, or a pack not approved for PvP
      → creates a 'draft' match with a sealed (frozen) snapshot of the
        question pack — this snapshot is what both teams will actually see

Admin presses "Start PvP"
  → POST /admin/pvp/matches/[id]/start
      → server sets started_at and deadline_at (both server clock, never
        client-supplied), match becomes 'live', ONLY the two selected
        teams are notified

Both teams now see the same sealed questions at the same moment
  → each team: GET /team/pvp/current (only ever their own match — a team
    can never fetch or see the other team's match, answers, or progress)
  → POST /team/pvp/submissions to answer, one question at a time,
    each with an idempotency key

Server declares a winner ONLY when a team has answered every required
question correctly — the winner is whoever's last-correct-answer
timestamp (server clock) is earliest. Client clocks are never trusted
and clients never compute the result themselves.
  → single atomic transaction: locks the match, records winner + loser,
    awards the winner (Nether Core x1, +20 Gold, +15 Iron, +25 Stone,
    +4 Emerald — the loser gets nothing), writes the immutable pvp_results row
```

Edge cases you need to handle (all specified in `PHASE2_PVP.md §6`): a brief disconnect just resumes against the same server deadline; nobody finishing before the deadline marks the match `expired` with no award; an admin can `void` an unfair/broken match with a required reason (never overwrites a match that already resolved); a "redo" is always a brand-new match linked to the voided one, never an edit to history.

## Realtime + polling for Phase 2

Same pattern as Phase 1 (see [00 §6](./00-how-the-backend-works.md#6-realtime-how-the-dashboard-updates-without-refreshing)): broadcasts (`resource_changed`, `grading_completed`, `world_event_started`, `world_event_expired`, `guardian_resolved`, `structure_changed`, `pvp_match_started`, `pvp_match_resolved`, `round_changed`) are treated as "something changed, go re-fetch" — never as the source of truth by themselves. Every screen also polls its underlying `GET` endpoint on a fallback timer (10s generally, 5s specifically for the live PvP screen, since that one is time-critical).

## Error shape

Same idea as Phase 1 but with a structured `code` so the client can branch on it, not just display the message:

```json
{ "success": false, "error": { "code": "ROUND_LOCKED", "message": "This round is no longer accepting submissions." } }
```

## Shared/frozen files — still off-limits without a group call

`package.json`, `lib/env.ts`, `lib/supabase/**`, `lib/auth/**`, `lib/panel/session.ts`, `types/**`, `app/dashboard/**`, `app/admin/(panel)/layout.tsx`, `components/ui/**` — same list as Phase 1, unchanged. Phase 2 code integrates with these through their existing exported functions/cookies, never by editing them.

## Before you start building

Get the current, organizer-approved event mechanics from `../event details/Mineverse_Full_Event_Details.md` — it is the ground truth for every reward number, cost, and rule. If `PHASE2_MASTER.md` or this doc ever seems to disagree with that file on an actual game number, the event-details file wins.
